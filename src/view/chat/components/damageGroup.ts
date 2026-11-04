import type { EffectNode } from '#types/effectTree.js';

const CARD_TYPES_WITH_EFFECTS = ['feature', 'monsterFeature'];

/**
 * `groupNodes` collects every damage node of a card into one group, so a
 * group made up entirely of them is the card's damage. It gets a single
 * Apply Damage control: the GM applies the whole attack at once, which is
 * what lets the target's per-attack reductions resolve only once.
 */
export function isDamageGroup(nodeGroup: readonly { type: string }[]): boolean {
	return nodeGroup.every((node) => node.type === 'damage' || node.type === 'damageOutcome');
}

/** True when the card draws a damage section, the place of its roll controls. */
export function cardHasDamageSection(
	message: { effectNodes?: EffectNode[][]; system?: unknown } | undefined,
): boolean {
	const featureType = (message?.system as { featureType?: string } | undefined)?.featureType;
	if (featureType && !CARD_TYPES_WITH_EFFECTS.includes(featureType)) return false;
	return (message?.effectNodes ?? []).some((group) => group.length > 0 && isDamageGroup(group));
}
