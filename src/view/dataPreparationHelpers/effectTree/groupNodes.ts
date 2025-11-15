import type { EffectNode } from '#types/effectTree';

export function groupNodes(nodes: EffectNode[]) {
	const damageNodes: EffectNode[] = [];
	const healingNodes: EffectNode[] = [];
	const conditionNodes: EffectNode[] = [];
	const savingThrowNodes: EffectNode[] = [];
	const textNodes: Map<string, EffectNode[]> = new Map([
		['flavor', []],
		['warning', []],
		['general', []],
		['reminder', []],
	]);

	for (const node of nodes) {
		if (node.type === 'damage' || node.type === 'damageOutcome') {
			damageNodes.push(node);
		} else if (node.type === 'healing') {
			healingNodes.push(node);
		} else if (node.type === 'condition') {
			conditionNodes.push(node);
		} else if (node.type === 'note') {
			const noteCategory = textNodes.get(node.noteType);

			if (!noteCategory) continue;

			noteCategory.push(node);
		} else if (node.type === 'savingThrow') {
			savingThrowNodes.push(node);
		}
	}

	return [
		Array.from(textNodes.values()).flat(),
		damageNodes,
		healingNodes,
		conditionNodes,
		// To ensure each saving throw is in its own group, wrap each node in an array
		...savingThrowNodes.map((node) => [node]),
	];
}
