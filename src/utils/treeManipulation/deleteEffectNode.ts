import type { NimbleBaseItem } from '../../documents/item/base.svelte.js';
import { flattenEffectsTree } from './flattenEffectsTree.js';
import { markEffectNodesForRemoval } from './markEffectNodesForRemoval.js';
import { reconstructEffectsTree } from './reconstructEffectsTree.js';
import type { EffectNode } from '#types/effectTree.js';

export async function deleteEffectNode(
	document: NimbleBaseItem,
	tree: EffectNode[],
	nodeId: string,
): Promise<void> {
	const flattened: EffectNode[] = flattenEffectsTree(tree);
	const nodesToRemove = markEffectNodesForRemoval(nodeId, flattened);

	document.update({
		'system.activation.effects': reconstructEffectsTree(
			flattened.filter((node) => !nodesToRemove.has(node.id)),
		),
	} as Record<string, unknown>);
}
