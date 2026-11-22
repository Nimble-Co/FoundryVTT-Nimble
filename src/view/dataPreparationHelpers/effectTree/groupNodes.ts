import type { EffectNode } from '#types/effectTree.js';

/** Damage for one target together, the targets in the order they first show. */
function byTarget(nodes: EffectNode[]): EffectNode[] {
	const groups = new Map<string, EffectNode[]>();
	for (const node of nodes) {
		const key = (node as { forTarget?: string }).forTarget ?? '';
		groups.set(key, [...(groups.get(key) ?? []), node]);
	}
	return [...groups.values()].flat();
}

export function groupNodes(nodes: EffectNode[]) {
	const damageNodes: EffectNode[] = [];
	const healingNodes: EffectNode[] = [];
	const applyEffectNodes: EffectNode[] = [];
	const moveNodes: EffectNode[] = [];
	const poolNodes: EffectNode[] = [];
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
		} else if (
			node.type === 'applyEffect' ||
			node.type === 'wound' ||
			node.type === 'endConditions'
		) {
			applyEffectNodes.push(node);
		} else if (node.type === 'note') {
			const noteCategory = textNodes.get(node.noteType);

			if (!noteCategory) continue;

			noteCategory.push(node);
		} else if (node.type === 'move') {
			moveNodes.push(node);
		} else if (node.type === 'pool') {
			poolNodes.push(node);
		} else if (node.type === 'savingThrow') {
			savingThrowNodes.push(node);
		}
	}

	return [
		Array.from(textNodes.values()).flat(),
		byTarget(damageNodes),
		healingNodes,
		applyEffectNodes,
		moveNodes,
		poolNodes,
		// To ensure each saving throw is in its own group, wrap each node in an array
		...savingThrowNodes.map((node) => [node]),
	];
}
