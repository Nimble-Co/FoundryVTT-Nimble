import type { EffectNode } from '#types/effectTree.js';

export function findNodeById(nodes: EffectNode[], id: string): EffectNode | null {
	for (const node of nodes) {
		if (node.id === id) {
			return node;
		}

		// Check child nodes based on the node type
		if (node.type === 'damage' || node.type === 'savingThrow') {
			if (node.on) {
				for (const contextNodes of Object.values(node.on) as EffectNode[][]) {
					const found = findNodeById(contextNodes, id);
					if (found) return found;
				}
			}
		}

		if (node.type === 'savingThrow' && node.sharedRolls) {
			const found = findNodeById(node.sharedRolls, id);
			if (found) return found;
		}
	}

	return null;
}
