import type { AppliedDamageTarget } from '#documents/chatMessage.ts';
import type { DefendRecord } from '#types/defend.d.ts';
import { endMark } from '#utils/actor/markLifecycle.ts';
import { damageAppliedTo, defendFor } from '#utils/defend/defendRecords.js';
import localize from '#utils/localize.js';
import { cardMarkingItem, liveMarksOf, markOnToken, marksAddedOnCard } from './cardMarks.ts';

type MarkCard = Parameters<typeof cardMarkingItem>[0];
type Mark = Parameters<typeof endMark>[1];

/**
 * The marks that the item which posted the card holds on its targets, and on
 * creatures the card marked that are not targets, and a way for the item's
 * owner to end one. Only one end runs at a time.
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
		addedOn: (targetUuids: readonly string[]) => marksAddedOnCard(marks, card?.id, targetUuids),
		endMarkOn,
	};
}

interface MarkRowToken {
	texture?: { src?: string | null } | null;
	object?: unknown;
}

/** The token of a mark that is not a target row, when it is still on a scene. */
export function tokenOfMark(mark: Mark): MarkRowToken | null {
	if (!mark.tokenUuid) return null;
	return fromUuidSync(mark.tokenUuid as Parameters<typeof fromUuidSync>[0]) as MarkRowToken | null;
}

interface DefendRowToken {
	uuid?: string | null;
	actor?: { type?: string } | null;
}

/** What the card removed from one target. Temp HP shows only when the hit took some. */
export function appliedDamageTip(applied: AppliedDamageTarget): string {
	const hp = {
		amount: String(applied.amount),
		before: String(applied.previousHp),
		after: String(applied.newHp),
	};
	if (applied.previousTempHp === applied.newTempHp) {
		return localize('NIMBLE.chatTargets.damageApplied', hp);
	}
	return localize('NIMBLE.chatTargets.damageAppliedWithTemp', {
		...hp,
		tempBefore: String(applied.previousTempHp),
		tempAfter: String(applied.newTempHp),
	});
}

/** The armor a Defend takes off, and the options it was made with. */
export function defendTip(defend: DefendRecord, key: string): string {
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
	};
}
