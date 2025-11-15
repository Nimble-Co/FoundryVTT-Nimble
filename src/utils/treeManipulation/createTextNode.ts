import type { TextNode } from '#types/effectTree.d';

export function createTextNode(
	parentNode: string | null = null,
	context: string | null = null,
): TextNode {
	return {
		id: foundry.utils.randomID(),
		type: 'note',
		noteType: 'general',
		text: '',
		parentContext: context,
		parentNode,
	};
}
