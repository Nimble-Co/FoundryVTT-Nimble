export interface PartyInventorySheetItem {
	id: string;
	name: string;
	/** Document art. A core icon path renders as a glyph. */
	img?: string;
	/** Font Awesome class, when there is no image. */
	icon?: string;
	/** Already localized, such as "x3". Empty when the stack is one. */
	quantity: string;
}

export interface PartyInventorySheetProps {
	empty: string;
	items: PartyInventorySheetItem[];
}
