import type { MoveNode } from '#types/effectTree.js';

export function createMoveNode(
	parentNode: string | null = null,
	context: string | null = null,
): MoveNode {
	return {
		id: foundry.utils.randomID(),
		type: 'move',
		kind: 'free',
		recipient: 'self',
		distance: '@speed',
		distanceBySize: {},
		ignoreDifficultTerrain: false,
		direction: 'any',
		chooser: 'mover',
		parentContext: context,
		parentNode,
	};
}
