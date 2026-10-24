import type { NimbleChatMessage } from '#documents/chatMessage.ts';
import type {
	IncomingReactionActorGroup,
	IncomingReactionPlace,
} from '#types/components/IncomingReactionPrompts.d.ts';
import type { RollRerollChoice } from '#types/components/RollRerollButton.d.ts';
import { requestIncomingAttackReaction } from '#utils/incomingAttackReactions.js';
import type { IncomingReactionEntry, RerollRecord } from '#utils/incomingReactionEntry.ts';
import localize from '../../../utils/localize.js';
import { confirmRerollHeroicReaction } from './confirmRerollHeroicReaction.js';
import { createHeldIncomingReactions } from './heldIncomingReactions.svelte.ts';
import { createIncomingReactionText } from './incomingReactionText.ts';
import { requestPoolSpendOffer } from './requestPoolSpendOffer.ts';
import { rerollAgainRecords, rerollHistoryLines } from './rerollHistoryLines.ts';
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

	const atTheRoll = $derived(getPlace() !== 'options');
	const showsHistory = $derived(getPlace() === 'roll' || getPlace() === 'rollHistory');

	const speakerUuid = $derived(
		(message as { speakerActor?: { uuid?: string } | null })?.speakerActor?.uuid ?? '',
	);
	const storedEntries = $derived(
		(message?.reactive?.system as { incomingReactions?: IncomingReactionEntry[] })
			?.incomingReactions ?? [],
	);
	const rerolls = $derived(
		(message?.reactive?.system as { rerolls?: RerollRecord[] })?.rerolls ?? [],
	);
	const text = createIncomingReactionText(() => rerolls);

	// Old cards can still hold the legacy `forceReroll` kind. Nothing resolves a
	// waiting one, and a used one wrote no reroll record, so it keeps its old line.
	const entries = $derived(storedEntries.filter((entry) => entry.kind !== 'forceReroll'));
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
	const placeEntries = $derived(entries.filter((entry) => changesTheRoll(entry) === atTheRoll));
	const pendingGroups = $derived(
		groupByActor(
			placeEntries.filter((entry) => !entry.used && !held.has(entry.id) && canUseEntry(entry)),
		),
	);
	// A used reroll is told by the card's history line, not by its entry.
	const usedEntries = $derived(
		placeEntries.filter((entry) => entry.used && entry.kind !== 'reroll'),
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
	const rerollChoices = $derived<RollRerollChoice[]>(
		getPlace() === 'rollButton'
			? pendingGroups
					.flatMap((group) => group.entries)
					.map((entry) => ({
						id: entry.id,
						label: text.label(entry),
						cost: text.cost(entry),
					}))
			: [],
	);

	function canUseEntry(entry: IncomingReactionEntry): boolean {
		const actor = text.reactingActor(entry);
		if (!game.user?.isGM && !actor?.isOwner) return false;
		// A reroll the card no longer allows (outcome, side, cost) is hidden.
		if (entry.kind === 'reroll') return message?.canStillUseReroll(entry) ?? false;
		return true;
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
		return [...groups.values()];
	}

	async function useSpendOffer(entry: IncomingReactionEntry): Promise<void> {
		const actor = text.reactingActor(entry);
		if (!actor) return;
		await requestPoolSpendOffer(entry, {
			actor,
			label: text.label(entry),
			messageId: message?.id ?? '',
			hold: held.hold,
		});
	}

	async function useReroll(entry: IncomingReactionEntry): Promise<void> {
		const forceHeroicReaction = await confirmRerollHeroicReaction(entry);
		if (forceHeroicReaction === null) return;

		held.hold(entry.id);
		await requestIncomingAttackReaction({
			messageId: message?.id ?? '',
			entryId: entry.id,
			forceHeroicReaction,
		});
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
				await useReroll(entry);
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

	function useEntryById(entryId: string): void {
		const entry = entries.find((candidate) => candidate.id === entryId);
		if (entry) useEntry(entry);
	}

	return {
		held,
		text,
		get busy() {
			return busy;
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
		get historyLines() {
			return historyLines;
		},
		get rerollChoices() {
			return rerollChoices;
		},
		useEntry,
		useEntryById,
	};
}
