import type { EffectNode } from '#types/effectTree.js';
import type { NimbleBaseItem } from '../../documents/item/base.svelte.js';

export async function updateEffectNode(
	document: NimbleBaseItem,
	tree: EffectNode[],
	node: EffectNode,
	field: string,
	value: any,
): Promise<void> {
	if (!node || !field) return;

	foundry.utils.setProperty(node, field, value);

	document.update({
		'system.activation.effects': tree,
	} as object as Record<string, unknown>);
}
