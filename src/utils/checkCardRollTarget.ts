import constructD20Term from '../dice/constructD20Term.js';
import type { OneDieRoll } from '../dice/oneDieReroll.js';
import type { IncomingReactionEntry, RerollRecord } from './incomingReactionEntry.js';
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
import { rerollWithRule } from './rerollStep.js';
import type { CheckRollKind } from './rollToReroll.js';

type CheckRoll = { kind: CheckRollKind; key: string };

/** Any roll class: saves and skill checks use NimbleRoll, ability checks a plain Roll. */
type AnyRoll = Roll<any>;

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

interface DieLike {
	faces?: number;
	results?: Array<{ result?: number; active?: boolean }>;
}

const CHECK_CARD_KEYS = {
	savingThrow: { kind: 'save', keyField: 'saveKey' },
	skillCheck: { kind: 'skillCheck', keyField: 'skillKey' },
	abilityCheck: { kind: 'abilityCheck', keyField: 'abilityKey' },
} as const;

const LEADING_D20 = /^\s*\d*d20(?!\d)((?:[a-z]+\d*)*)/i;

/** The check a card of this type holds, or null when it is not a check card. */
function checkRollOfCard(type: string, system: Record<string, unknown>): CheckRoll | null {
	const card = CHECK_CARD_KEYS[type as keyof typeof CHECK_CARD_KEYS];
	if (!card) return null;
	const key = system[card.keyField];
	return typeof key === 'string' && key ? { kind: card.kind, key } : null;
}

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

/** The kept d20 result in a roll's terms, or null. */
function keptD20(terms: unknown[]): number | null {
	const die = terms.find((term) => (term as DieLike | null)?.faces === 20) as DieLike | undefined;
	const kept = (die?.results ?? []).filter(
		(result) => result.active !== false && typeof result.result === 'number',
	);
	if (kept.length === 0) return null;
	return kept.reduce((sum, result) => sum + (result.result ?? 0), 0);
}

function rollClassNamed(name: unknown): RollClass {
	const found = CONFIG.Dice.rolls.find((cls) => cls.name === name);
	return (found ?? foundry.dice.Roll) as unknown as RollClass;
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

/** The roll target of a check card: its first roll. */
function checkCardRollTarget(card: CheckCard): RerollRollTarget<AnyRoll> {
	const context = () =>
		checkRollContext(card.roller(), card.roll, alliesOnCard(card.incomingReactions()));
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
				keepChoice: (roll) => ({
					total: Number((roll as { total?: number }).total) || 0,
					outcome: null,
				}),
				prepare: async (roll, entries) => ({
					context: context(),
					entries,
					write: async (changes) => {
						await card.update({
							rolls: [JSON.stringify(roll.toJSON()), ...card.rollsSource().slice(1)],
							system: {
								incomingReactions: changes.incomingReactions,
								rerolls: changes.rerolls,
								pendingKeep: null,
								rollMode: netRollMode(roll.options as Record<string, unknown>),
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
}): Promise<{
	roll: AnyRoll;
	incomingReactions: IncomingReactionEntry[];
	rerolls: RerollRecord[];
	refund: () => Promise<void>;
}> {
	const context = checkRollContext(
		input.roller,
		input.check,
		scanRerollAllies(rollerTokenOf(input.roller)),
	);
	const found = collectRerollEntries(context);
	const stamped: IncomingReactionEntry[] = [];
	const rerolls: RerollRecord[] = [];
	const refunds: Array<() => Promise<void>> = [];
	let roll = input.roll;

	let next = nextAutomaticReroll(found.automatic, stamped, context);
	while (next) {
		const target = checkReroll(liveRollSource(roll), input.rollMode);
		const result = await rerollWithRule({
			rule: next.rule,
			entry: next.entry,
			rollKind: input.check.kind,
			payer: next.rule.actor as Actor | null | undefined,
			replaced: target.replaced,
			previousResult: target.previousResult,
			makeRoll: target.makeRoll,
			readNewDie: target.readNewDie,
			earlierCritTriggers: false,
		});
		if (result.status === 'failed') {
			console.error('Nimble | An automatic reroll failed.', result.error);
		}
		if (result.status !== 'done') break;

		roll = result.roll;
		rerolls.push(result.reroll);
		refunds.unshift(result.refund);
		stamped.push({ ...next.entry, used: true });
		next = nextAutomaticReroll(found.automatic, stamped, context);
	}

	return {
		roll,
		incomingReactions: withNewRerollEntries(stamped, found.manual),
		rerolls,
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
		rollMode: number;
	};
	refund: () => Promise<void>;
}

/** A check card's roll and reroll fields from its roller, when the card is posted. */
async function checkCardRerollData<TRoll extends AnyRoll>(
	roller: RerollingActor & { token?: { uuid?: string } | null },
	roll: TRoll,
	check: CheckRoll,
	rollMode: number,
): Promise<CheckCardRerollData<TRoll>> {
	const result = await collectCheckRerolls({ roller, roll, check, rollMode });
	return {
		roll: result.roll as TRoll,
		system: {
			actorUuid: roller.uuid ?? null,
			tokenUuid: roller.token?.uuid ?? null,
			incomingReactions: result.incomingReactions,
			rerolls: result.rerolls,
			rollMode:
				result.rerolls.length > 0
					? netRollMode(result.roll.options as Record<string, unknown>)
					: rollMode,
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
	checkRollOfCard,
	createCheckCard,
	type CheckCard,
	type CheckCardRerollData,
	type CheckRoll,
};
