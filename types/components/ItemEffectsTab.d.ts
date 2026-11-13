/** The item of an item window, as its Effects tab reads and changes it. */
export interface ItemEffectsTabItem {
	uuid?: string | null;
	name?: string | null;
	img?: string | null;
	system?: unknown;
	effects?: unknown;
	/** reading it makes the read redraw on an update of the item */
	readonly reactive: ItemEffectsTabItem;
	update(data: Record<string, unknown>): Promise<unknown>;
	createEmbeddedDocuments(type: 'ActiveEffect', data: object[]): Promise<unknown>;
	updateEmbeddedDocuments(
		type: 'ActiveEffect',
		updates: Record<string, unknown>[],
	): Promise<unknown>;
	deleteEmbeddedDocuments(type: 'ActiveEffect', ids: string[]): Promise<unknown>;
}

/** One effect row of the Effects tab. */
export interface ItemEffectRow {
	id: string;
	name: string;
	img: string;
	transfer: boolean;
	lasts: string;
	/** "On use: Apply Effect", "Rule: Mark Target", one entry per different user */
	users: string[];
	/** "Used by: ..." or "Nothing uses this effect." */
	usedByLine: string;
}
