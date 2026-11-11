import {
	CARD_SELF_READER,
	CARD_TARGETS_READER,
	describeLastsUntil,
	usedUpOf,
} from '#utils/lastsUntil/describeLastsUntil.js';
import type { Moment } from '#utils/lastsUntil/momentReached.js';
import localize from '#utils/localize.js';

/**
 * The Lasts Until of an item effect, as the Apply Effect card row reads it: "Until the end of their
 * next turn". `self` reads it for the creature that uses the item. Empty when nothing ends it.
 */
export function itemEffectLastsUntil(
	effect: { system?: unknown } | null | undefined,
	recipient: 'self' | 'targets',
): string {
	if (!effect) return '';
	const system = (effect.system ?? {}) as { lastsUntil?: Moment[]; escape?: { dc?: string } };
	return describeLastsUntil({
		moments: system.lastsUntil ?? [],
		usedUp: usedUpOf(system),
		escape: !!system.escape?.dc?.trim(),
		reader: recipient === 'self' ? CARD_SELF_READER : CARD_TARGETS_READER,
		localize,
		format: localize,
	});
}
