import { attackDeliveryFromAttackType } from '../damage/attackDelivery.js';
import { isAttackRoll } from '../heldChange/heldChange.js';
import { flattenEffectsTree } from '../treeManipulation/flattenEffectsTree.js';
import { type ConditionRollMode, conditionRollModes } from './conditionRollModes.js';

interface WindowActivation {
	targets?: { attackType?: string } | null;
	acquireTargetsFromTemplate?: boolean;
	template?: { shape?: string } | null;
	effects?: unknown[];
}

type Creature = Parameters<typeof conditionRollModes>[0]['roller'];

/**
 * The condition lines of an attack roll. None when the roll is not an
 * attack; no target lines for an area or with no sole target (Core:1403).
 */
export function attackConditionLines(
	roller: Creature,
	activation: WindowActivation | null | undefined,
	soleTarget: Creature,
): ConditionRollMode[] {
	const damage = flattenEffectsTree((activation?.effects ?? []) as never).find(
		(node) => node.type === 'damage',
	) as { canCrit?: boolean; canMiss?: boolean } | undefined;
	if (!activation || !isAttackRoll(activation.targets?.attackType, damage)) return [];
	const area = !!activation.acquireTargetsFromTemplate && !!activation.template?.shape;
	return conditionRollModes({
		kind: 'attack',
		roller,
		target: area ? null : soleTarget,
		delivery: attackDeliveryFromAttackType(activation.targets?.attackType),
	});
}
