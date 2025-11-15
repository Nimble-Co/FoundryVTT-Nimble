import type { EffectNode } from '#types/effectTree';

export function markEffectNodesForRemoval(nodeId: string, flattened: EffectNode[]): Set<string> {
	const nodesToRemove: Set<string> = new Set();
	nodesToRemove.add(nodeId);

	for (const node of flattened) {
		if (node.parentNode === nodeId) {
			const childNodesToRemove = markEffectNodesForRemoval(node.id, flattened);

			for (const childNodeId of childNodesToRemove) {
				nodesToRemove.add(childNodeId);
			}
		}
	}

	return nodesToRemove;
}
