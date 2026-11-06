import type { NimbleChatMessage } from '#documents/chatMessage.ts';
import type {
	IncomingReactionActorGroup,
	IncomingReactionPicking,
	IncomingReactionPlace,
} from '#types/components/IncomingReactionPrompts.d.ts';
import type { ResultChangeLine } from '#types/components/ResultChangeLines.d.ts';
import type { PrimaryDieBonusLine } from '#types/primaryDieBonus.d.ts';
import type { ResultChange } from '#types/resultChange.d.ts';
import { mayActHere } from '#utils/chat/cardOperations.js';
import { rerollIsUsedByDefend } from '#utils/defend/defendOptions.js';
import { cardTakesDefends } from '#utils/defend/defendRecords.js';
import {
	requestIncomingAttackReaction,
	requestResultRemoval,
} from '#utils/incomingReactions/incomingAttackReactions.js';
import type {
	DieOutcome,
	IncomingReactionEntry,
	PendingKeep,
	RerollRecord,
} from '#utils/incomingReactions/incomingReactionEntry.ts';
import { resultChangesOf } from '#utils/rolls/resultChanges.ts';
import type { PickableDie } from '../../../dice/oneDieReroll.ts';
import localize from '../../../utils/localize.js';
import {
	attackOutcomeTags,
	cardPrimaryRoll,
	primaryDieBonusNotAdded,
} from './attackOutcomeTags.ts';
import { createChangeThisRollState } from './ChangeThisRoll.svelte.ts';
import { confirmRerollHeroicReaction } from './confirmRerollHeroicReaction.js';
import { cardHasDamageSection } from './damageGroup.ts';
import { createHeldIncomingReactions } from './heldIncomingReactions.svelte.ts';
import { createIncomingReactionText } from './incomingReactionText.ts';
import { initiativeRowGain } from './initiativeCardText.ts';
import { sortByVerb } from './reactionVerbs.ts';
import { requestPoolSpendOffer } from './requestPoolSpendOffer.ts';
import { rerollAgainRecords, rerollHistoryLines } from './rerollHistoryLines.ts';
import { resultChangeLines, resultSumText } from './resultChangeLines.ts';
import { spendBaselineInterpose } from './spendBaselineInterpose.ts';

function changesTheRoll(entry: IncomingReactionEntry): boolean {
	return entry.kind === 'reroll';
}

/** Call during component setup: it registers effects. */
export function createIncomingReactionPromptsState(
	message: NimbleChatMessage | undefined,
	getPlace: () => IncomingReactionPlace,
) {
	const held = createHeldIncomingReactions(message);
	let busy = $state(false);
	let picking = $state<IncomingReactionPicking | null>(null);

	const showsHistory = $derived(getPlace() !== 'options');
	// Every row sits at the card's roll. A card with no damage section has only `options`.
	const ownsControl = $derived(getPlace() !== 'options' || !cardHasDamageSection(message));

	// Check cards post with no speaker; their roller is in the card data.
	const speakerUuid = $derived(
		(message?.system as { actorUuid?: string | null } | undefined)?.actorUuid ||
			(message as { speakerActor?: { uuid?: string } | null })?.speakerActor?.uuid ||
			'',
	);
	const storedEntries = $derived(
		(message?.reactive?.system as { incomingReactions?: IncomingReactionEntry[] })
			?.incomingReactions ?? [],
	);
	const rerolls = $derived(
		(message?.reactive?.system as { rerolls?: RerollRecord[] })?.rerolls ?? [],
	);
	const text = createIncomingReactionText(
		() => rerolls,
		(entry) => message?.resultUseOf?.(entry) ?? null,
		(entry) => {
			const use = entry.use === 'result' ? message?.resultUseOf?.(entry) : null;
			return use && message?.reactive ? initiativeRowGain(message.reactive, use) : '';
		},
	);
	const resultChanges = $derived(resultChangesOf(message?.reactive?.system));
	const rollTotal = $derived(Number(message?.reactive?.rolls?.[0]?.total) || 0);
	const cardPrimaryDieBonuses = $derived(
		(message?.reactive?.system as { primaryDieBonuses?: PrimaryDieBonusLine[] })
			?.primaryDieBonuses ?? [],
	);

	// Old cards can still hold the legacy `forceReroll` kind. Nothing resolves a
	// waiting one, and a used one wrote no reroll record, so it keeps its old line.
	// An attack card that takes Defends offers Interpose, and a reroll a Defend
	// option uses, in the Defend window.
	const takesDefends = $derived(cardTakesDefends(message?.reactive?.system));
	const entries = $derived(
		storedEntries.filter(
			(entry) =>
				entry.kind !== 'forceReroll' &&
				(entry.kind !== 'redirectToSelf' || entry.used || !takesDefends) &&
				(entry.kind !== 'reroll' ||
					entry.used ||
					!takesDefends ||
					!rerollIsUsedByDefend(entry.itemUuid)),
		),
	);
	const legacyRerollLines = $derived(
		showsHistory
			? storedEntries
					.filter((entry) => entry.kind === 'forceReroll' && entry.used)
					.map((entry) => ({
						id: entry.id,
						text: localize('NIMBLE.chat.incomingReactions.rerolledBy', {
							label: entry.label || (text.reactingActor(entry)?.name ?? ''),
						}),
					}))
			: [],
	);
	const rowEntries = $derived.by(() => {
		if (!ownsControl) return [];
		if (getPlace() === 'roll') return entries;
		return entries.filter((entry) => changesTheRoll(entry) === (getPlace() === 'checkRoll'));
	});
	const pendingGroups = $derived.by(() => {
		// A click or a Remove can bring a row back or take it away with no new entry.
		void resultChanges;
		return groupByActor(
			rowEntries.filter(
				(entry) =>
					!entry.used &&
					(!held.has(entry.id) || picking?.entry.id === entry.id) &&
					canUseEntry(entry),
			),
		);
	});
	const rowCount = $derived(
		pendingGroups.reduce((total, group) => total + group.entries.length, 0),
	);
	// A used reroll is told by the card's history line, not by its entry.
	const usedEntries = $derived(
		getPlace() === 'options' ? entries.filter((entry) => entry.used && !changesTheRoll(entry)) : [],
	);
	const historyLines = $derived(
		showsHistory
			? rerollHistoryLines({
					records: rerolls,
					speakerUuid,
					rerollAgain: rerollAgainRecords(
						rerolls,
						pendingGroups.flatMap((group) => group.entries),
					),
					documentName: text.documentName,
				})
			: [],
	);
	// Only the GM sees the ally rerolls the scan left out.
	const leftOutEntries = $derived(
		showsHistory && game.user?.isGM
			? storedEntries.filter((entry) => entry.kind === 'reroll' && !entry.used && !!entry.leftOut)
			: [],
	);
	const primaryDieBonuses = $derived(getPlace() === 'roll' ? cardPrimaryDieBonuses : []);
	const keptAmount = $derived(
		getPlace() === 'roll'
			? ((message?.reactive?.system as { keptAmount?: { label: string; amount: number } | null })
					?.keptAmount ?? null)
			: null,
	);
	const primaryRoll = $derived(cardPrimaryRoll(message?.reactive?.system));
	const outcomeTags = $derived(getPlace() === 'roll' ? attackOutcomeTags(primaryRoll) : []);
	const bonusNotAdded = $derived(
		primaryDieBonusNotAdded(primaryRoll?.options, rerolls, text.documentName),
	);
	const pendingKeep = $derived(
		showsHistory
			? ((message?.reactive?.system as { pendingKeep?: PendingKeep | null } | undefined)
					?.pendingKeep ?? null)
			: null,
	);
	const pendingLine = $derived(
		pendingKeep
			? rerollHistoryLines({
					records: [pendingKeep.reroll],
					speakerUuid,
					rerollAgain: new Set(),
					documentName: text.documentName,
				})[0]
			: null,
	);
	const resultLines = $derived(
		getPlace() !== 'options'
			? resultChangeLines({
					changes: resultChanges,
					rollTotal,
					speakerUuid,
					documentName: text.documentName,
					canRemove: canRemoveResult,
				})
			: [],
	);
	const resultSum = $derived(
		getPlace() === 'checkRoll' ? resultSumText(rollTotal, resultChanges) : null,
	);
	const primaryOutcome = $derived.by<DieOutcome>(() => {
		const system = message?.reactive?.system as
			| { isCritical?: boolean; isMiss?: boolean }
			| undefined;
		if (system?.isCritical) return 'crit';
		return system?.isMiss ? 'miss' : null;
	});

	// The picker closes once the picked reroll is on the card, or was refused.
	$effect(() => {
		const current = picking;
		if (!current?.sent) return;
		const stored = storedEntries.find((entry) => entry.id === current.entry.id);
		if (!stored || stored.used || !held.has(current.entry.id)) picking = null;
	});

	// A row can go away by a click, by a new draw, or by another client's update.
	$effect(() => {
		void rowCount;
		void picking;
		void control.open;
		void resultChanges;
		if (ownsControl) control.restoreFocus();
	});

	function canUseEntry(entry: IncomingReactionEntry): boolean {
		if (!mayActHere(text.reactingActor(entry))) return false;
		// A reroll the card no longer allows (outcome, side, cost) is hidden.
		if (entry.kind === 'reroll') return message?.canStillUseReroll(entry) ?? false;
		return true;
	}

	/**
	 * The user who can click the row of this change, and the GM. Not while a keep
	 * waits, and no damage stands once the damage is applied.
	 */
	function canRemoveResult(actorUuid: string, change: ResultChange): boolean {
		if (pendingKeep) return false;
		const system = message?.reactive?.system as { damageApplied?: boolean } | undefined;
		if (change.change === 'noDamage' && system?.damageApplied === true) return false;
		if (game.user?.isGM) return true;
		return (fromUuidSync(actorUuid) as Actor.Implementation | null)?.isOwner === true;
	}

	async function removeResultLine(line: ResultChangeLine): Promise<void> {
		if (held.has(line.id)) return;
		held.hold(line.id);
		control.expectFocusLoss(line.id);
		try {
			await requestResultRemoval({ messageId: message?.id ?? '', lineId: line.id });
		} catch (error) {
			held.release(line.id);
			console.error('Nimble | Failed to remove a change of a result', error);
			ui.notifications?.error(localize('NIMBLE.chat.incomingReactions.useFailed'));
		}
	}

	/** One group per actor, in the order the card lists them. */
	function groupByActor(list: IncomingReactionEntry[]): IncomingReactionActorGroup[] {
		const groups = new Map<string, IncomingReactionActorGroup>();
		for (const entry of list) {
			let group = groups.get(entry.actorUuid);
			if (!group) {
				// The card's header already names the one who rolled.
				group = {
					actorUuid: entry.actorUuid,
					name:
						entry.actorUuid === speakerUuid ? '' : (text.reactingActor(entry)?.name ?? '').trim(),
					entries: [],
				};
				groups.set(entry.actorUuid, group);
			}
			group.entries.push(entry);
		}
		return [...groups.values()].map((group) => ({ ...group, entries: sortByVerb(group.entries) }));
	}

	async function useSpendOffer(entry: IncomingReactionEntry): Promise<void> {
		const actor = text.reactingActor(entry);
		if (!actor) return;
		await requestPoolSpendOffer(entry, {
			actor,
			label: text.spendLabel(entry),
			messageId: message?.id ?? '',
			hold: held.hold,
		});
	}

	function rerollPicker(entry: IncomingReactionEntry): IncomingReactionPicking | null {
		const stats = message?.rerollStatsToPick?.(entry) ?? null;
		if (stats?.length) return { entry, dice: [], stats, rolling: null, sent: false };
		const several = message?.severalDiceToPick?.(entry) ?? null;
		if (several) {
			return {
				entry,
				dice: several.dice,
				rolling: null,
				sent: false,
				several: { max: several.max, manaPerDie: several.manaPerDie },
			};
		}
		const dice = message?.rerollDiceToPick?.(entry) ?? null;
		return dice && dice.length > 1 ? { entry, dice, rolling: null, sent: false } : null;
	}

	/** A change picks its die, then its value when the rule sets one; an add with one die goes at once. */
	function changePicker(entry: IncomingReactionEntry): IncomingReactionPicking | null {
		const pick = message?.changeToPick?.(entry) ?? null;
		const dice = pick?.dice ?? [];
		if (!pick || !(dice.length > 1 || (pick.setsValue && dice.length === 1))) return null;
		return {
			entry,
			dice,
			rolling: null,
			sent: false,
			setsValue: pick.setsValue,
			valueDie: dice.length === 1 ? dice[0] : null,
		};
	}

	function opensPicker(entry: IncomingReactionEntry): boolean {
		if (entry.kind !== 'reroll' || entry.use === 'crit' || entry.use === 'result') return false;
		return (entry.use === 'change' ? changePicker(entry) : rerollPicker(entry)) !== null;
	}

	async function useReroll(entry: IncomingReactionEntry): Promise<void> {
		const opened = rerollPicker(entry);
		if (opened) {
			picking = opened;
			return;
		}
		await sendReroll(entry, message?.rerollDiceToPick?.(entry)?.[0] ?? null);
	}

	async function useChange(entry: IncomingReactionEntry): Promise<void> {
		const opened = changePicker(entry);
		if (opened) {
			picking = opened;
			return;
		}
		await sendReroll(entry, message?.changeToPick?.(entry)?.dice[0] ?? null);
	}

	/** Ask for the reroll or change. False when the player said no to the heroic reaction. */
	async function sendReroll(
		entry: IncomingReactionEntry,
		die: PickableDie | null,
		value: number | null = null,
		stat: string | null = null,
		dice: readonly PickableDie[] | null = null,
	): Promise<boolean> {
		const forceHeroicReaction = await confirmRerollHeroicReaction(entry);
		if (forceHeroicReaction === null) return false;

		held.hold(entry.id);
		await requestIncomingAttackReaction({
			messageId: message?.id ?? '',
			entryId: entry.id,
			forceHeroicReaction,
			pick: {
				...(die ? { die: { term: die.term, result: die.result } } : {}),
				...(value === null ? {} : { value }),
				...(stat === null ? {} : { stat }),
				...(dice ? { dice: dice.map(({ term, result }) => ({ term, result })) } : {}),
			},
		});
		return true;
	}

	async function sendPicked(die: PickableDie, value: number | null): Promise<void> {
		const current = picking;
		if (!current || current.rolling || busy) return;
		busy = true;
		try {
			picking = { ...current, rolling: die };
			const sent = await sendReroll(current.entry, die, value);
			picking = sent && picking ? { ...picking, sent: true } : null;
		} catch (error) {
			picking = null;
			console.error('Nimble | Failed to use a chat card reaction', error);
			ui.notifications?.error(localize('NIMBLE.chat.incomingReactions.useFailed'));
		} finally {
			busy = false;
		}
	}

	async function pickDie(die: PickableDie): Promise<void> {
		const current = picking;
		if (current?.setsValue && !current.rolling) {
			picking = { ...current, valueDie: die };
			return;
		}
		await sendPicked(die, null);
	}

	async function pickSeveral(dice: PickableDie[]): Promise<void> {
		const current = picking;
		if (!current || current.rolling || busy || dice.length === 0) return;
		busy = true;
		try {
			picking = { ...current, rolling: dice[0] };
			const sent = await sendReroll(current.entry, null, null, null, dice);
			picking = sent && picking ? { ...picking, sent: true } : null;
		} catch (error) {
			picking = null;
			console.error('Nimble | Failed to use a chat card reaction', error);
			ui.notifications?.error(localize('NIMBLE.chat.incomingReactions.useFailed'));
		} finally {
			busy = false;
		}
	}

	async function pickValue(value: number): Promise<void> {
		const die = picking?.valueDie;
		if (die) await sendPicked(die, value);
	}

	async function pickStat(stat: string): Promise<void> {
		const current = picking;
		if (!current?.stats || current.sent || busy) return;
		busy = true;
		try {
			const sent = await sendReroll(current.entry, null, null, stat);
			picking = sent && picking ? { ...picking, sent: true } : null;
		} catch (error) {
			picking = null;
			console.error('Nimble | Failed to use a chat card reaction', error);
			ui.notifications?.error(localize('NIMBLE.chat.incomingReactions.useFailed'));
		} finally {
			busy = false;
		}
	}

	/** Closes the die picker. Returns the id of the entry it was open for. */
	function cancelPick(): string | null {
		const entryId = picking?.entry.id ?? null;
		picking = null;
		return entryId;
	}

	async function useEntry(entry: IncomingReactionEntry) {
		if (busy) return;
		busy = true;

		try {
			if (entry.kind === 'spendPoolForDamage') {
				await useSpendOffer(entry);
				return;
			}

			if (entry.kind === 'reroll') {
				if (entry.use === 'crit' || entry.use === 'result') await sendReroll(entry, null);
				else await (entry.use === 'change' ? useChange(entry) : useReroll(entry));
				return;
			}

			if (entry.kind === 'redirectToSelf' && entry.source === 'baseline') {
				const spent = await spendBaselineInterpose(entry);
				if (!spent) return;
			}

			await requestIncomingAttackReaction({
				messageId: message?.id ?? '',
				entryId: entry.id,
			});
		} catch (error) {
			console.error('Nimble | Failed to use a chat card reaction', error);
			ui.notifications?.error(localize('NIMBLE.chat.incomingReactions.useFailed'));
		} finally {
			busy = false;
		}
	}

	const control = createChangeThisRollState(message, () => ({
		count: rowCount,
		picking,
		opensPicker,
		useEntry,
		pickDie,
		pickSeveral,
		pickValue,
		pickStat,
		cancelPick,
	}));

	return {
		held,
		text,
		control,
		get ownsControl() {
			return ownsControl;
		},
		get busy() {
			return busy;
		},
		get picking() {
			return picking;
		},
		get pendingGroups() {
			return pendingGroups;
		},
		get usedEntries() {
			return usedEntries;
		},
		get legacyRerollLines() {
			return legacyRerollLines;
		},
		get primaryDieBonuses() {
			return primaryDieBonuses;
		},
		get keptAmount() {
			return keptAmount;
		},
		get outcomeTags() {
			return outcomeTags;
		},
		get bonusNotAdded() {
			return bonusNotAdded;
		},
		get historyLines() {
			return historyLines;
		},
		get leftOutEntries() {
			return leftOutEntries;
		},
		get pendingKeep() {
			return pendingKeep;
		},
		get pendingLine() {
			return pendingLine;
		},
		get primaryOutcome() {
			return primaryOutcome;
		},
		get resultLines() {
			return resultLines;
		},
		get resultSum() {
			return resultSum;
		},
		removeResultLine,
	};
}
