import type { ApplyEffectNode } from '#types/effectTree.js';

export function createApplyEffectNode(
	parentNode: string | null = null,
	context: string | null = null,
	effectId: string | null = null,
): ApplyEffectNode {
	return {
		id: foundry.utils.randomID(),
		type: 'applyEffect',
		effectId,
		recipient: 'targets',
		tempHealingNodeId: null,
		parentContext: context,
		parentNode,
	};
}
