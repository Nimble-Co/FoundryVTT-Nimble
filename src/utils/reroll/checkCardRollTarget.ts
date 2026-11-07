import type { AnyRoll } from '#types/anyRoll.d.ts';
import type { ResultChange } from '#types/resultChange.d.ts';
import type { StatChoice } from '#types/rollStat.d.ts';
import constructD20Term from '../../dice/constructD20Term.js';
import type { OneDieRoll } from '../../dice/oneDieReroll.js';
import type {
	IncomingReactionEntry,
	RerollRecord,
	RollChange,
} from '../incomingReactions/incomingReactionEntry.js';
import localize from '../localize.js';
import { failsOnNaturalOne, resultOfCheckRoll } from '../rolls/checkResult.js';
import {
	naturalResultChangeOfRoll,
	resultTotal,
	retireResultChanges,
	standingResultChanges,
} from '../rolls/resultChanges.js';
import { chainAutomaticRerolls } from './automaticRerolls.js';
import { type CheckRoll, keptD20 } from './checkRollOfCard.js';
import { alliesOnCard, rollerTokenOf, scanRerollAllies } from './rerollAllies.js';
import {
	collectRerollEntries,
	nextAutomaticReroll,
	type RerollAlly,
	type RerollingActor,
	type RerollRollContext,
	withNewRerollEntries,
} from './rerollEntries.js';
import type { RerollableRoll, RerollRollTarget } from './rerollRollTarget.js';
import { moveLabelledModifier, ROLL_STATS } from './rollStat.js';

type RollClass = new (
	formula: string,
	data?: Record<string, unknown>,
	options?: Record<string, unknown>,
) => AnyRoll;

/** The save, skill check or ability check card the check roll target reads and writes. */
interface CheckCard {
	roll: CheckRoll;
	/** The roll mode the card's first roll used. */
	rollMode(): number;
	/** The actor that made the check. */
	roller(): RerollingActor | null;
	/** The card's `rolls` source. */
	rollsSource(): string[];
	/** The card's incoming reaction entries. */
	incomingReactions(): IncomingReactionEntry[];
	/** The card's Change a Result clicks, in order. */
	resultChanges(): ResultChange[];
	/** The DC the card knows, if any. */
	dc?(): number | null | undefined;
	update(changes: Record<string, unknown>): Promise<unknown>;
}

/** A check roll, live or serialized, as a reroll reads it. */
interface CheckRollSource {
	formula: string;
	options: Record<string, unknown>;
	data: Record<string, unknown>;
	terms: unknown[];
	rollClass: RollClass;
}

const LEADING_D20 = /^\s*\d*d20(?!\d)((?:[a-z]+\d*)*)/i;

/** The roll slot of a check card's d20, the one roll on the card. */
const CHECK_ROLL_SLOT = 'check';

/** `formula` with its leading d20 term rebuilt for `rollMode`; the rest is kept. */
function d20FormulaWithRollMode(formula: string, rollMode: number): string {
	const match = formula.match(LEADING_D20);
	if (!match) throw new Error(`A check reroll needs a formula that starts with a d20: ${formula}`);
	const minRoll = Number(match[1].match(/min(\d+)/i)?.[1] ?? 1);
	return constructD20Term({ minRoll, rollMode }) + formula.slice(match[0].length);
}

function netRollMode(options: Record<string, unknown>): number {
	const sources = options.rollModeSources;
	if (Array.isArray(sources)) {
		return sources.reduce<number>((sum, n) => sum + (Number.isFinite(n) ? Number(n) : 0), 0);
	}
	return Number(options.rollMode) || 0;
}

function rollClassNamed(name: unknown): RollClass {
	const found = CONFIG.Dice.rolls.find((cls) => cls.name === name);
	return (found ?? foundry.dice.Roll) as unknown as RollClass;
}

/** The stat a check roll uses now: a key the card holds, or the stat a reroll picked. */
function currentCheckStat(check: CheckRoll, options: Record<string, unknown>): string {
	if (typeof options.statUsed === 'string') return options.statUsed;
	if (check.kind === 'skillCheck') {
		return (CONFIG.NIMBLE.defaultSkillAbilities as Record<string, string>)[check.key] ?? '';
	}
	return check.key;
}

/** What a stat is worth on this check: its save modifier on a save, else the stat itself. */
function checkStatValue(
	check: CheckRoll,
	stat: string,
	rollData: Record<string, unknown>,
): number | null {
	const value = rollData[check.kind === 'save' ? `${stat}Save` : stat];
	return typeof value === 'number' ? value : null;
}

/** The label of a check's modifier in its formula, as `ModifierManager` writes it. */
function checkModifierLabel(check: CheckRoll, stat: string): string {
	const { abilityScores, savingThrows, skills } = CONFIG.NIMBLE;
	if (check.kind === 'save') {
		return localize('NIMBLE.modifiers.savingThrow', {
			saveType: (savingThrows as Record<string, string>)[stat] ?? stat,
		});
	}
	if (check.kind === 'skillCheck') {
		return localize('NIMBLE.modifiers.skillCheck', {
			skill: (skills as Record<string, string>)[check.key] ?? check.key,
		});
	}
	return localize('NIMBLE.modifiers.abilityCheck', {
		ability: (abilityScores as Record<string, string>)[stat] ?? stat,
	});
}

/** The other stats a player can pick for a new roll of this check. */
function checkStatChoices(
	check: CheckRoll,
	options: Record<string, unknown>,
	roller: RerollingActor | null,
): StatChoice[] {
	if (check.kind === 'initiative') return [];
	const rollData = roller?.getRollData?.() ?? {};
	const current = currentCheckStat(check, options);
	return ROLL_STATS.flatMap((stat) => {
		const mod = stat === current ? null : checkStatValue(check, stat, rollData);
		return mod === null ? [] : [{ stat, mod }];
	});
}

/**
 * A reroll of a check roll. The new roll uses the same class, data and
 * modifiers; its d20 term is rebuilt from the roll mode and the reroll's change.
 */
function checkReroll(
	source: CheckRollSource,
	cardRollMode: number,
): Omit<RerollableRoll<AnyRoll>, 'prepare'> {
	const rollMode =
		typeof source.options.rollMode === 'number' ? source.options.rollMode : cardRollMode;
	return {
		slot: CHECK_ROLL_SLOT,
		replaced: { formula: source.formula, options: { ...source.options, rollMode } },
		previousResult: keptD20(source.terms),
		makeRoll: async (formula, options) => {
			const net = netRollMode(options);
			const roll = new source.rollClass(d20FormulaWithRollMode(formula, net), source.data, {
				...options,
				rollMode: net,
			});
			await roll.evaluate();
			return roll;
		},
		readNewDie: (roll) => ({ faces: 20, value: keptD20(roll.terms as unknown[]) }),
	};
}

function checkRollContext(
	roller: RerollingActor | null,
	check: CheckRoll,
	allies: RerollAlly[],
): RerollRollContext {
	return { attacker: roller, targets: [], allies, roll: check, outcome: null, forcedMiss: false };
}

function liveRollSource(roll: AnyRoll): CheckRollSource {
	return {
		formula: roll.formula,
		options: { ...(roll.options as Record<string, unknown>) },
		data: (roll.data ?? {}) as Record<string, unknown>,
		terms: roll.terms as unknown[],
		rollClass: roll.constructor as RollClass,
	};
}

function serializedRollSource(json: string | undefined): CheckRollSource | null {
	if (!json) return null;
	try {
		const data = JSON.parse(json) as Record<string, unknown>;
		if (typeof data.formula !== 'string') return null;
		return {
			formula: data.formula,
			options: { ...((data.options as Record<string, unknown> | undefined) ?? {}) },
			data: (data.data as Record<string, unknown> | undefined) ?? {},
			terms: Array.isArray(data.terms) ? data.terms : [],
			rollClass: rollClassNamed(data.class),
		};
	} catch {
		return null;
	}
}

/** The total and terms the dice gave on the card's first roll, as they were stored. */
function storedRoll(json: string | undefined): { total: number; terms: unknown[] } {
	if (!json) return { total: 0, terms: [] };
	try {
		const data = JSON.parse(json) as { total?: unknown; terms?: unknown };
		return { total: Number(data.total) || 0, terms: Array.isArray(data.terms) ? data.terms : [] };
	} catch {
		return { total: 0, terms: [] };
	}
}

const readsTheDie = (change: ResultChange) =>
	change.automatic === true && change.change === 'countsAsNat20';

/**
 * The card's changes after a new roll: a new roll takes the standing ones off,
 * and a change of a die keeps them, but a natural 20 made by itself is read again.
 */
function changesAfterRoll(
	resultChanges: readonly ResultChange[],
	rollTotal: number,
	isNewRoll: boolean,
	added: readonly ResultChange[],
): ResultChange[] | null {
	const standing = standingResultChanges(resultChanges);
	const staleAutomatic = !isNewRoll && standing.some(readsTheDie);
	if (added.length === 0 && !staleAutomatic && (!isNewRoll || standing.length === 0)) return null;
	const kept = isNewRoll
		? retireResultChanges(rollTotal, resultChanges)
		: resultChanges.filter((change) => change.retired || !readsTheDie(change));
	return [...kept, ...added];
}

/** The roll target of a check card: its first roll. */
function checkCardRollTarget(card: CheckCard): RerollRollTarget<AnyRoll> {
	const shownTotal = () =>
		resultTotal(storedRoll(card.rollsSource()[0]).total, card.resultChanges());
	const context = (): RerollRollContext => {
		const roller = card.roller();
		const stored = storedRoll(card.rollsSource()[0]);
		const kept = keptD20(stored.terms);
		return {
			...checkRollContext(roller, card.roll, alliesOnCard(card.incomingReactions())),
			card: {
				total: shownTotal(),
				changes: card.resultChanges(),
				roller: roller as NonNullable<RerollRollContext['card']>['roller'],
				result: resultOfCheckRoll({
					kind: card.roll.kind,
					rollTotal: stored.total,
					terms: stored.terms,
					changes: card.resultChanges(),
					dc: card.dc?.(),
				}),
				rollModifier: kept === null ? 0 : stored.total - kept,
				naturalOneFails: failsOnNaturalOne({
					kind: card.roll.kind,
					terms: stored.terms,
					changes: card.resultChanges(),
				}),
			},
		};
	};
	return {
		context,
		findRoll: () => {
			const source = serializedRollSource(card.rollsSource()[0]);
			if (!source) return null;
			return {
				...checkReroll(source, card.rollMode()),
				current: () =>
					foundry.dice.Roll.fromData(JSON.parse(card.rollsSource()[0])) as unknown as OneDieRoll,
				pickDropped: true,
				shownTotal,
				statChoices: () => checkStatChoices(card.roll, source.options, card.roller()),
				withStat: (found, stat) => {
					const rollData = card.roller()?.getRollData?.() ?? {};
					const from = currentCheckStat(card.roll, source.options);
					const before = checkStatValue(card.roll, from, rollData);
					const after = checkStatValue(card.roll, stat, rollData);
					if (from === stat || before === null || after === null) return null;
					return {
						...found,
						replaced: {
							...found.replaced,
							formula: moveLabelledModifier(
								found.replaced.formula ?? source.formula,
								checkModifierLabel(card.roll, from),
								checkModifierLabel(card.roll, stat),
								after - before,
							),
							options: { ...(found.replaced.options ?? {}), statUsed: stat },
						},
					};
				},
				keepChoice: (roll) => ({
					total:
						naturalResultChangeOfRoll(card.roller(), card.roll, roll as AnyRoll)?.value ??
						(Number((roll as { total?: number }).total) || 0),
					outcome: null,
				}),
				prepare: async (roll, entries) => ({
					context: context(),
					entries,
					write: async (changes) => {
						const natural = naturalResultChangeOfRoll(card.roller(), card.roll, roll);
						const resultChanges = changesAfterRoll(
							card.resultChanges(),
							storedRoll(card.rollsSource()[0]).total,
							changes.rerolls.at(-1)?.use !== 'change',
							[
								...(natural ? [natural] : []),
								...(changes.resultChange ? [changes.resultChange] : []),
							],
						);
						await card.update({
							rolls: [JSON.stringify(roll.toJSON()), ...card.rollsSource().slice(1)],
							system: {
								incomingReactions: changes.incomingReactions,
								rerolls: changes.rerolls,
								rollChanges: changes.rollChanges,
								pendingKeep: null,
								rollMode: netRollMode(roll.options as Record<string, unknown>),
								...(resultChanges ? { resultChanges } : {}),
							},
						});
					},
				}),
			};
		},
	};
}

/**
 * The roller's reroll entries for a check about to be posted. Automatic rules
 * run here first, by the same step as on the card; the roll that stands goes
 * on the card.
 */
async function collectCheckRerolls(input: {
	roller: RerollingActor | null;
	roll: AnyRoll;
	check: CheckRoll;
	rollMode: number;
	dc?: number | null | undefined;
}): Promise<{
	roll: AnyRoll;
	incomingReactions: IncomingReactionEntry[];
	rerolls: RerollRecord[];
	rollChanges: RollChange[];
	resultChanges: ResultChange[];
	refund: () => Promise<void>;
}> {
	const context = {
		...checkRollContext(input.roller, input.check, scanRerollAllies(rollerTokenOf(input.roller))),
		rollTimeOfCheck: true,
	};
	const found = collectRerollEntries(context);
	const stamped: IncomingReactionEntry[] = [];
	const rerolls: RerollRecord[] = [];
	const rollChanges: RollChange[] = [];
	const refunds: Array<() => Promise<void>> = [];
	let roll = input.roll;
	// A rule for a failed roll runs by itself only when this roll is known to fail.
	const runnableRerolls = () => {
		const failed =
			resultOfCheckRoll({
				kind: input.check.kind,
				rollTotal: Number(roll.total) || 0,
				terms: roll.terms as unknown[],
				changes: [],
				dc: input.dc,
			}) === 'failed' && !naturalResultChangeOfRoll(input.roller, input.check, roll);
		return found.automatic.filter(({ rule }) => rule.outcome !== 'failed' || failed);
	};

	await chainAutomaticRerolls<AnyRoll, ReturnType<typeof checkReroll>>({
		rollKind: input.check.kind,
		roller: input.roller,
		next: () => nextAutomaticReroll(runnableRerolls(), stamped, context),
		target: () => checkReroll(liveRollSource(roll), input.rollMode),
		appliedRollChanges: () => rollChanges,
		earlierCritTriggers: () => false,
		place: async (done, next, _target, added) => {
			roll = done.roll;
			rerolls.push(done.reroll);
			rollChanges.push(...added);
			refunds.unshift(done.refund);
			stamped.push({ ...next.entry, used: true });
		},
	});

	const natural = naturalResultChangeOfRoll(input.roller, input.check, roll);
	const ran = new Set(stamped.map((entry) => entry.id));
	const waitsForResult = found.automatic
		.filter(({ rule, entry }) => rule.outcome === 'failed' && !ran.has(entry.id))
		.map(({ entry }) => entry);
	return {
		roll,
		// A rule for a failed roll that did not run stays a row: the player knows the result.
		incomingReactions: withNewRerollEntries(stamped, [...found.manual, ...waitsForResult]),
		rerolls,
		rollChanges,
		resultChanges: natural ? [natural] : [],
		refund: async () => {
			for (const refund of refunds) await refund();
		},
	};
}

/** A check card's roll and reroll fields, and how to give back what its automatic rerolls paid. */
interface CheckCardRerollData<TRoll extends AnyRoll> {
	roll: TRoll;
	system: {
		actorUuid: string | null;
		tokenUuid: string | null;
		incomingReactions: IncomingReactionEntry[];
		rerolls: RerollRecord[];
		rollChanges: RollChange[];
		rollMode: number;
		resultChanges?: ResultChange[];
	};
	refund: () => Promise<void>;
}

/** A check card's roll and reroll fields from its roller, when the card is posted. */
async function checkCardRerollData<TRoll extends AnyRoll>(
	roller: RerollingActor & { token?: { uuid?: string } | null },
	roll: TRoll,
	check: CheckRoll,
	rollMode: number,
	dc: number | null = null,
): Promise<CheckCardRerollData<TRoll>> {
	const result = await collectCheckRerolls({ roller, roll, check, rollMode, dc });
	return {
		roll: result.roll as TRoll,
		system: {
			actorUuid: roller.uuid ?? null,
			tokenUuid: roller.token?.uuid ?? null,
			incomingReactions: result.incomingReactions,
			rerolls: result.rerolls,
			rollChanges: result.rollChanges,
			rollMode:
				result.rerolls.length > 0
					? netRollMode(result.roll.options as Record<string, unknown>)
					: rollMode,
			...(result.resultChanges.length > 0 ? { resultChanges: result.resultChanges } : {}),
		},
		refund: result.refund,
	};
}

/** Create a check card. When the card is not made, its automatic rerolls give their cost back. */
async function createCheckCard(
	chatData: object,
	rerolls: Pick<CheckCardRerollData<AnyRoll>, 'refund'>,
): Promise<ChatMessage | null> {
	let card: ChatMessage | undefined;
	try {
		card = await ChatMessage.create(chatData as ChatMessage.CreateData);
	} catch (error) {
		await rerolls.refund();
		throw error;
	}
	if (!card) await rerolls.refund();
	return card ?? null;
}

export {
	CHECK_ROLL_SLOT,
	checkCardRerollData,
	checkCardRollTarget,
	createCheckCard,
	type CheckCard,
	type CheckCardRerollData,
};
