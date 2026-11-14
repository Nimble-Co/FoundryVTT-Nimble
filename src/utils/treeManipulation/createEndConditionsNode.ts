import type { EndConditionsNode } from '#types/effectTree.js';

export function createEndConditionsNode(
	parentNode: string | null = null,
	context: string | null = null,
): EndConditionsNode {
	return {
		id: foundry.utils.randomID(),
		type: 'endConditions',
		recipient: 'self',
		which: 'negative',
		conditions: [],
		parentContext: context,
		parentNode,
	};
}
