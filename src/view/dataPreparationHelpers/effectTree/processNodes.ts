import type { EffectNode } from '#types/effectTree';
import { flattenEffectsTree } from '../../../utils/treeManipulation/flattenEffectsTree';

export function processNodes(effects: EffectNode[], relevantNodes: EffectNode[]) {
	const nodes = foundry.utils.deepClone(relevantNodes);
	const flattened = flattenEffectsTree(effects);

	for (const node of nodes) {
		if (node.type === 'damageOutcome') {
			const parentNode = flattened.find((n) => n.id === node.parentNode);

			if (parentNode?.type === 'damage') {
				node.damageType = parentNode.damageType;
				node.ignoreArmor = parentNode.ignoreArmor;
				node.ignoreAllies = parentNode.ignoreAllies;
				node.roll = parentNode.roll;
			}
		}
	}

	return nodes;
}
