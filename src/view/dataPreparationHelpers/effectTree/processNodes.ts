import type { EffectNode } from '#types/effectTree.js';
import { flattenEffectsTree } from '../../../utils/treeManipulation/flattenEffectsTree.js';

export function processNodes(effects: EffectNode[], relevantNodes: EffectNode[]) {
	const nodes = foundry.utils.deepClone(relevantNodes);
	const flattened = flattenEffectsTree(effects);

	for (const node of nodes) {
		if (node.type === 'damageOutcome') {
			const parentNode = flattened.find((n) => n.id === node.parentNode);

			if (parentNode?.type === 'damage') {
				node.damageType = parentNode.damageType;
				node.targetDisposition = parentNode.targetDisposition;
				node.ignoreArmor = parentNode.ignoreArmor;
				if (parentNode.lowerArmorSteps) node.lowerArmorSteps = parentNode.lowerArmorSteps;
				if (parentNode.modifierOnly) node.modifierOnly = true;
				node.ignoreAllies = parentNode.ignoreAllies;
				node.roll = parentNode.roll;
				node.damageMultiplier = parentNode.damageMultiplier;
				if (parentNode.source) node.source = parentNode.source;
			}
		}
	}

	return nodes;
}
