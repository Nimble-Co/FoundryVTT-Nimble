import type { WoundNode } from '#types/effectTree.js';

export function createWoundNode(
	parentNode: string | null = null,
	context: string | null = null,
): WoundNode {
	return {
		id: foundry.utils.randomID(),
		type: 'wound',
		amount: 1,
		recipient: 'targets',
		parentContext: context,
		parentNode,
	};
}
