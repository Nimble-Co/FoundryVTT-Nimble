import type { NimbleChatMessage } from '#documents/chatMessage.ts';
import type { ChoiceMenuSection } from '#types/components/ChoiceMenu.d.ts';
import type {
	IncomingReactionActorGroup,
	IncomingReactionPicking,
	IncomingReactionPlace,
} from '#types/components/IncomingReactionPrompts.d.ts';
import type { PrimaryDieBonusLine } from '#types/primaryDieBonus.d.ts';
import { requestIncomingAttackReaction } from '#utils/incomingReactions/incomingAttackReactions.js';
import type {
	DieOutcome,
	IncomingReactionEntry,
	PendingKeep,
	RerollRecord,
	RollUse,
} from '#utils/incomingReactions/incomingReactionEntry.ts';
import type { PickableDie } from '../../../dice/oneDieReroll.ts';
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
	let picking = $state<IncomingReactionPicking | null>(null);

	const atTheRoll = $derived(getPlace() !== 'options');
	const showsHistory = $derived(getPlace() === 'roll' || getPlace() === 'rollHistory');

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
	const text = createIncomingReactionText(() => rerolls);
	const cardPrimaryDieBonuses = $derived(
		(message?.reactive?.system as { primaryDieBonuses?: PrimaryDieBonusLine[] })
			?.primaryDieBonuses ?? [],
	);

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
			placeEntries.filter(
				(entry) =>
					!entry.used &&
					(!held.has(entry.id) || picking?.entry.id === entry.id) &&
					canUseEntry(entry),
			),
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
	// Only the GM sees the ally rerolls the scan left out.
	const leftOutEntries = $derived(
		showsHistory && game.user?.isGM
			? storedEntries.filter((entry) => entry.kind === 'reroll' && !entry.used && !!entry.leftOut)
			: [],
	);
	const primaryDieBonuses = $derived(getPlace() === 'roll' ? cardPrimaryDieBonuses : []);
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
	// The roll row's icon menu: the rerolls, then the changes, each under its heading.
	const rollMenu = $derived.by<ChoiceMenuSection[]>(() => {
		if (getPlace() !== 'rollButton') return [];
		const pending = pendingGroups.flatMap((group) => group.entries);
		const section = (id: RollUse, heading: string) => ({
			id,
			heading: localize(heading),
			items: pending
				.filter((entry) => (entry.use ?? 'reroll') === id)
				.map((entry) => ({ ...text.menuItem(entry), icon: text.icon(entry) })),
		});
		return [
			section('reroll', 'NIMBLE.chat.incomingReactions.verbs.reroll'),
			section('change', 'NIMBLE.chat.incomingReactions.rollMenu.change'),
			section('crit', 'NIMBLE.chat.incomingReactions.rollMenu.crit'),
		].filter((menuSection) => menuSection.items.length > 0);
	});
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
		const dice = message?.rerollDiceToPick?.(entry) ?? null;
		if (dice && dice.length > 1) {
			picking = { entry, dice, rolling: null, sent: false };
			return;
		}
		await sendReroll(entry, dice?.[0] ?? null);
	}

	/** A change picks its die, then its value when the rule sets one; an add with one die goes at once. */
	async function useChange(entry: IncomingReactionEntry): Promise<void> {
		const pick = message?.changeToPick?.(entry) ?? null;
		const dice = pick?.dice ?? [];
		if (pick && (dice.length > 1 || (pick.setsValue && dice.length === 1))) {
			picking = {
				entry,
				dice,
				rolling: null,
				sent: false,
				setsValue: pick.setsValue,
				valueDie: dice.length === 1 ? dice[0] : null,
			};
			return;
		}
		await sendReroll(entry, dice[0] ?? null);
	}

	/** Ask for the reroll or change. False when the player said no to the heroic reaction. */
	async function sendReroll(
		entry: IncomingReactionEntry,
		die: PickableDie | null,
		value: number | null = null,
	): Promise<boolean> {
		const forceHeroicReaction = await confirmRerollHeroicReaction(entry);
		if (forceHeroicReaction === null) return false;

		held.hold(entry.id);
		await requestIncomingAttackReaction({
			messageId: message?.id ?? '',
			entryId: entry.id,
			forceHeroicReaction,
			...(die ? { die: { term: die.term, result: die.result } } : {}),
			...(value === null ? {} : { value }),
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

	async function pickValue(value: number): Promise<void> {
		const die = picking?.valueDie;
		if (die) await sendPicked(die, value);
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
				if (entry.use === 'crit') await sendReroll(entry, null);
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
		get rollMenu() {
			return rollMenu;
		},
		get primaryOutcome() {
			return primaryOutcome;
		},
		useEntry,
		useEntryById,
		pickDie,
		pickValue,
		cancelPick,
	};
}
