import { endMark } from '#utils/actor/markLifecycle.ts';
import { type DefendRecord, damageAppliedTo, defendFor } from '#utils/defend/defendRecords.js';
import localize from '#utils/localize.js';
import { cardMarkingItem, liveMarksOf, markOnToken } from './cardMarks.ts';

type MarkCard = Parameters<typeof cardMarkingItem>[0];
type Mark = Parameters<typeof endMark>[1];

/**
 * The marks that the item which posted the card holds on its targets, and a
 * way for the item's owner to end one. Only one end runs at a time.
 */
export function createTargetMarksState(card: MarkCard) {
	const markingItem = cardMarkingItem(card);
	const marks = $derived(markingItem ? liveMarksOf(markingItem) : []);
	let ending = $state(false);

	async function endMarkOn(mark: Mark) {
		if (!markingItem || ending) return;
		ending = true;
		try {
			await endMark(markingItem, mark);
		} finally {
			ending = false;
		}
	}

	return {
		get ending() {
			return ending;
		},
		endLabel: localize('NIMBLE.chatTargets.endMark', {
			feature: (markingItem as { name?: string } | null)?.name ?? '',
		}),
		markOn: (token: Parameters<typeof markOnToken>[1]) => markOnToken(marks, token),
		endMarkOn,
	};
}

interface DefendRowToken {
	uuid?: string | null;
	actor?: { type?: string } | null;
}

/** The armor a Defend takes off, and the options it was made with. */
function defendTip(defend: DefendRecord, key: string): string {
	const tip = localize(key, { armor: String(defend.armor + defend.armorBonus) });
	const labels = [...new Set([defend.label, ...defend.options.map((use) => use.label)])].filter(
		(label) => !!label,
	);
	if (labels.length < 1) return tip;
	return `${tip} ${localize('NIMBLE.chat.defend.optionsUsed', { labels: labels.join(', ') })}`;
}

/**
 * The Defend of each hero row on the card, and whether the GM gets its Armor
 * toggle and Undo: only until that target's damage is applied.
 */
export function createTargetDefendsState(getSystem: () => unknown) {
	const applied = $derived(damageAppliedTo(getSystem()));

	return {
		defendOn(token: DefendRowToken | null | undefined): DefendRecord | null {
			if (token?.actor?.type !== 'character') return null;
			return defendFor(getSystem(), token.uuid ?? '');
		},
		controlsFor(defend: DefendRecord | null, token: DefendRowToken | null | undefined): boolean {
			return !!defend && game.user?.isGM === true && !applied.has(token?.uuid ?? '');
		},
		tip: defendTip,
	};
}
