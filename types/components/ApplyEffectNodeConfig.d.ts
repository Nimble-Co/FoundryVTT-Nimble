import type { NimbleBaseItem } from '../../src/documents/item/base.svelte.ts';
import type { ApplyEffectNode, EffectNode } from '../effectTree.d.ts';

export interface ApplyEffectNodeConfigProps {
	node: ApplyEffectNode;
	document: NimbleBaseItem;
	/** the whole effect tree of the item */
	effects: EffectNode[];
}
