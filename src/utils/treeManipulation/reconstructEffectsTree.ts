import type { EffectNode } from '#types/effectTree';

export function reconstructEffectsTree(flattened: EffectNode[]) {
	const rootNodes: EffectNode[] = [];
	const nodeMap: Map<string, EffectNode> = new Map();

	// First pass: create a map of all nodes
	for (const node of flattened) {
		nodeMap.set(node.id, foundry.utils.deepClone(node));
	}

	// Second pass: establish parent-child relationships
	for (const node of flattened) {
		const newNode = nodeMap.get(node.id);
		if (!newNode) throw new Error(`Node with id ${node.id} not found`);

		const parentNode = nodeMap.get(node.parentNode ?? '') ?? null;

		if (newNode.type === 'damage' || newNode.type === 'savingThrow') {
			newNode.on ??= {};
		}

		if (newNode.type === 'savingThrow') {
			newNode.sharedRolls ??= [];
		}

		if (parentNode === null) {
			rootNodes.push(newNode);
			continue;
		}

		const parentType = parentNode.type;
		const parentContext = node.parentContext;

		if (parentType !== 'damage' && parentType !== 'savingThrow') continue;

		if (parentContext === 'sharedRolls') {
			if (parentType !== 'savingThrow' || newNode.type !== 'damage') continue;

			parentNode.sharedRolls ??= [];
			parentNode.sharedRolls.push(newNode);
		} else if (parentContext) {
			parentNode.on ??= {};
			parentNode.on[parentContext] ??= [];
			parentNode.on[parentContext].push(newNode);
		}
	}

	return rootNodes;
}
