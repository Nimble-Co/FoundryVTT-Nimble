import type { EffectNode } from '#types/effectTree.d.js';

/**
 * Traverses the tree and collects nodes based on the specified contexts.
 *
 * @param   nodes    - The tree nodes to traverse.
 * @param   contexts - The contexts to search for (e.g., hit, miss, critical hit).
 *
 * @returns An array of nodes that match any of the specified contexts.
 */
export function findNodesByContexts(
	nodes: EffectNode[],
	contexts: string[],
	includeBaseNodes = false,
	includeBaseDamageNodes = false,
): EffectNode[] {
	const result: EffectNode[] = [];

	function traverse(node: EffectNode) {
		if (!node.parentNode) {
			if (includeBaseDamageNodes && node.type === 'damage') {
				result.push(node);
			} else if (!includeBaseNodes && node.type !== 'damage') {
				result.push(node);
			}
		}

		if (node.type === 'damage' || node.type === 'savingThrow') {
			if (node.on) {
				for (const context of contexts) {
					if (node.on[context]) {
						result.push(...node.on[context]);
					}
				}
			}
		}

		if (node.type === 'savingThrow' && node.sharedRolls) {
			for (const sharedRoll of node.sharedRolls) {
				traverse(sharedRoll);
			}
		}

		if (node.type === 'damage' && node.on) {
			for (const key in node.on) {
				if (Object.hasOwn(node.on, key)) {
					for (const childNode of node.on[key]) {
						traverse(childNode);
					}
				}
			}
		}
	}

	for (const node of nodes) {
		traverse(node);
	}

	return result;
}
