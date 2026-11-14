import {
	CARD_SELF_READER,
	CARD_TARGETS_READER,
	describeLastsUntil,
	usedUpOf,
} from '#utils/lastsUntil/describeLastsUntil.js';
import { hasEscape } from '#utils/lastsUntil/escapeEffect.js';
import { appliedLastsUntil } from '#utils/lastsUntil/statusLastsUntil.js';
import localize from '#utils/localize.js';

/**
 * The Lasts Until of an item effect, as the Apply Effect card row reads it: "Until the end of their
 * next turn". `self` reads it for the creature that uses the item. Empty when nothing ends it.
 */
export function itemEffectLastsUntil(
	effect: { system?: unknown; statuses?: Iterable<string> | null } | null | undefined,
	recipient: 'self' | 'targets',
): string {
	if (!effect) return '';
	const system = (effect.system ?? {}) as { escape?: { dc?: string; noDc?: boolean } };
	return describeLastsUntil({
		moments: appliedLastsUntil(effect),
		usedUp: usedUpOf(system),
		escape: hasEscape(system),
		reader: recipient === 'self' ? CARD_SELF_READER : CARD_TARGETS_READER,
		localize,
		format: localize,
	});
}
