import localize from './localize.js';

/**
 * Resolve the display name for a damage type key. Unknown keys fall back to the
 * key itself so content authored against a type this build doesn't know about
 * still reads as something rather than disappearing.
 */
export default function getDamageTypeLabel(damageType: string): string {
	const key = (CONFIG.NIMBLE.damageTypes as Record<string, string>)[damageType];
	return key ? localize(key) : damageType;
}
