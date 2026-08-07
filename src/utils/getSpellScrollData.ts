import { SYSTEM_ID } from '#system';
import type { SpellScrollFlagData } from './createScrollFromSpell.js';

/**
 * The scroll data written onto an object by `createScrollFromSpell`, or null when
 * the item is not an inscribed spell scroll.
 *
 * Reads the flag through `SYSTEM_ID` so it resolves on the dev build too, where
 * the scope key is `nimble-dev`. Scrolls are created at runtime rather than
 * shipped in a pack, so the flag is always written under the running system's id.
 */
export default function getSpellScrollData(item: {
	type?: unknown;
	flags?: Record<string, unknown>;
}): SpellScrollFlagData | null {
	if (item.type !== 'object') return null;

	const scope = item.flags?.[SYSTEM_ID] as
		| { spellScroll?: Partial<SpellScrollFlagData> }
		| undefined;
	const scroll = scope?.spellScroll;

	if (!scroll || typeof scroll.school !== 'string' || typeof scroll.tier !== 'number') {
		return null;
	}

	return {
		spellUuid: typeof scroll.spellUuid === 'string' ? scroll.spellUuid : '',
		school: scroll.school,
		tier: scroll.tier,
	};
}
