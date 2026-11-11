/** The item that holds the effects: the rule's item, or the item of an Apply Effect node. */
export interface ItemEffectSelectItem {
	uuid?: string | null;
	name?: string | null;
	img?: string | null;
	system?: unknown;
	effects?: unknown;
	createEmbeddedDocuments(type: 'ActiveEffect', data: object[]): Promise<unknown>;
	deleteEmbeddedDocuments(type: 'ActiveEffect', ids: string[]): Promise<unknown>;
}

export interface ItemEffectSelectProps {
	/** null: the holder is not on an item, so nothing can be picked */
	item: ItemEffectSelectItem | null;
	/** the id of the picked effect; null or empty for none */
	value: string | null;
	/** stores the new pick; the component deletes the effect it left when nothing uses it */
	onchange: (effectId: string | null) => unknown;
	/** who reads the Lasts Until line: the creature that uses the item, or its targets */
	recipient: 'self' | 'targets';
	/** the accessible name of the select, when no label element names it */
	label?: string;
	/** the id of the element that names the select */
	labelledby?: string;
	disabled?: boolean;
}
