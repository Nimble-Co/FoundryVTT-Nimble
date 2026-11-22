interface DamageSearchNode {
	type?: string;
	on?: Record<string, unknown>;
}

/** The first damage node of the tree, depth first, or null when it has none. */
export function firstDamageNode<T extends DamageSearchNode>(nodes: readonly T[]): T | null {
	for (const node of nodes) {
		if (node.type === 'damage') return node;
		const found = firstDamageNode(Object.values(node.on ?? {}).flat() as T[]);
		if (found) return found;
	}
	return null;
}
