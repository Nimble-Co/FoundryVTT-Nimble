import type { ConditionCreature, ConditionRollMode } from '#types/conditionRollMode.d.ts';
import type { EffectNode } from '#types/effectTree.js';
import { type AttackDelivery, attackDeliveryFromAttackType } from '../damage/attackDelivery.js';
import { isAttackRoll } from '../heldChange/heldChange.js';
import { flattenEffectsTree } from '../treeManipulation/flattenEffectsTree.js';
import { conditionRollModes } from './conditionRollModes.js';

interface WindowActivation {
	targets?: { attackType?: string } | null;
	acquireTargetsFromTemplate?: boolean;
	template?: { shape?: string } | null;
	effects?: unknown[];
}

/**
 * The condition lines of an attack roll. None when the roll is not an
 * attack; no target lines for an area or with no sole target (Core:1403).
 */
export function attackConditionLines(
	roller: ConditionCreature | null | undefined,
	activation: WindowActivation | null | undefined,
	soleTarget: ConditionCreature | null | undefined,
	properties: readonly string[] = [],
): ConditionRollMode[] {
	const damage = flattenEffectsTree((activation?.effects ?? []) as EffectNode[]).find(
		(node) => node.type === 'damage',
	) as { canCrit?: boolean; canMiss?: boolean } | undefined;
	if (!activation || !isAttackRoll(activation.targets?.attackType, damage)) return [];
	const area = !!activation.acquireTargetsFromTemplate && !!activation.template?.shape;
	return conditionRollModes({
		kind: 'attack',
		roller,
		target: area ? null : soleTarget,
		delivery: conditionDelivery(activation.targets?.attackType, properties),
	});
}

/**
 * Melee or ranged, for Prone. With no attack type, a spell's Range or Reach
 * property says it (Core:1407); with both or neither, it is not known.
 */
export function conditionDelivery(
	attackType: string | null | undefined,
	properties: readonly string[] = [],
): AttackDelivery {
	const delivery = attackDeliveryFromAttackType(attackType);
	if (delivery) return delivery;
	const range = properties.includes('range');
	if (range === properties.includes('reach')) return null;
	return range ? 'ranged' : 'melee';
}
