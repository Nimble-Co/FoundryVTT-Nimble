import { endMark } from '#utils/actor/markLifecycle.ts';
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
