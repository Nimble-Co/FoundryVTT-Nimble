import type { NimbleBaseItem } from '../../documents/item/base.svelte';
import { flattenEffectsTree } from './flattenEffectsTree';
import { markEffectNodesForRemoval } from './markEffectNodesForRemoval';
import { reconstructEffectsTree } from './reconstructEffectsTree';
import type { EffectNode } from '#types/effectTree';

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
	});
}
