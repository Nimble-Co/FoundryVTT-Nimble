import type { EffectNode } from '#types/effectTree.js';
import type { NimbleBaseItem } from '../../documents/item/base.svelte.js';
import { flattenEffectsTree } from './flattenEffectsTree.js';
import { markEffectNodesForRemoval } from './markEffectNodesForRemoval.js';
import { reconstructEffectsTree } from './reconstructEffectsTree.js';

export async function deleteEffectNode(
	document: NimbleBaseItem,
	tree: EffectNode[],
	nodeId: string,
): Promise<void> {
	const flattened: EffectNode[] = flattenEffectsTree(tree);
	const nodesToRemove = markEffectNodesForRemoval(nodeId, flattened);
	const kept = flattened.filter((node) => !nodesToRemove.has(node.id));

	await document.update({
		'system.activation.effects': reconstructEffectsTree(kept),
	} as object as Record<string, unknown>);
	await deleteUnusedItemEffects(document, flattened, kept);
}

/** An Apply Effect node owns its effect on the item: the effect goes when no node points at it. */
async function deleteUnusedItemEffects(
	document: NimbleBaseItem,
	before: EffectNode[],
	after: EffectNode[],
): Promise<void> {
	const effectIds = (nodes: EffectNode[]) =>
		new Set(
			nodes.flatMap((node) =>
				node.type === 'applyEffect' && node.effectId ? [node.effectId] : [],
			),
		);
	const kept = effectIds(after);
	const unused = [...effectIds(before)].filter((id) => !kept.has(id) && document.effects?.has(id));
	if (unused.length) await document.deleteEmbeddedDocuments('ActiveEffect', unused);
}
