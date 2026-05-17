import type { PoolNode } from '#types/effectTree.js';

export function createPoolNode(
	parentNode: string | null = null,
	context: string | null = null,
): PoolNode {
	return {
		id: foundry.utils.randomID(),
		type: 'pool',
		poolType: 'dice',
		action: 'rollDie',
		poolIdentifier: '',
		value: 1,
		predicate: {},
		parentContext: context,
		parentNode,
	};
}
