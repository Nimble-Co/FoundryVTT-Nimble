import type { EffectNode } from '#types/effectTree.js';
import type { ScalingDelta, ScalingOperation } from '#types/spellScaling.js';
import type { ApplyEffectMomentNumbers } from '#utils/spell/effectMomentNumbers.js';
import type { ApplyEffectRuleNumbers } from '#utils/spell/effectRuleNumbers.js';

export function createEmptyDelta(): ScalingDelta {
	return {
		operation: 'addFlatDamage',
		value: 1,
		dice: null,
		condition: null,
		targetEffectId: null,
		durationType: null,
		maxDieFaces: null,
		ruleId: null,
		ruleField: null,
		formula: null,
		momentIndex: null,
	};
}

/**
 * Reshapes a delta's payload fields so only the ones the new operation uses stay populated. A raise
 * starts on the first Apply Effect node, a lengthen on the first moment with a number; other
 * operations do not keep an Apply Effect node target.
 */
export function applyOperationDefaults(
	delta: ScalingDelta,
	operation: ScalingOperation,
	raiseTargets: ApplyEffectRuleNumbers[],
	effectNodes: EffectNode[],
	momentTargets: ApplyEffectMomentNumbers[] = [],
) {
	delta.operation = operation;
	delta.ruleId = null;
	delta.ruleField = null;
	delta.formula = null;
	delta.momentIndex = null;
	if (operation === 'raiseEffectRule') {
		delta.targetEffectId = raiseTargets[0]?.nodeId ?? null;
	} else if (operation === 'lengthenLastsUntil') {
		delta.targetEffectId = momentTargets[0]?.nodeId ?? null;
		delta.momentIndex = momentTargets[0]?.moments[0]?.index ?? null;
	} else if (
		effectNodes.some((node) => node.id === delta.targetEffectId && node.type === 'applyEffect')
	) {
		delta.targetEffectId = null;
	}

	if (operation === 'addDice') {
		delta.dice = delta.dice ?? { count: 1, faces: 6 };
		delta.value = null;
		delta.condition = null;
		delta.maxDieFaces = null;
	} else if (operation === 'addCondition') {
		delta.condition = delta.condition ?? '';
		delta.value = null;
		delta.dice = null;
		delta.maxDieFaces = null;
	} else if (operation === 'increaseDieSize') {
		delta.value = delta.value ?? 1;
		delta.maxDieFaces = delta.maxDieFaces ?? 12;
		delta.dice = null;
		delta.condition = null;
	} else {
		delta.value = delta.value ?? 1;
		delta.dice = null;
		delta.condition = null;
		delta.maxDieFaces = null;
	}
}
