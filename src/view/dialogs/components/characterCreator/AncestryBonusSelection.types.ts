// `NimbleAncestryItem` and `NimbleAncestryBonusItem` are global ambient types
// (src/documents/item/item.d.ts).

/** Props for the ancestry-bonus character-creation step. */
export interface AncestryBonusSelectionProps {
	active: boolean;
	/** Every ancestry bonus available across the world's compendium packs. */
	ancestryBonuses: NimbleAncestryBonusItem[];
	/** The ancestry whose `system.defaultBonus` seeds the initial pick. */
	selectedAncestry: NimbleAncestryItem | null;
	/** The player's current bonus, defaulted from the ancestry (two-way bound). */
	selectedAncestryBonus: NimbleAncestryBonusItem | null;
	/** Whether the player has confirmed the bonus and can move on (two-way bound). */
	ancestryBonusConfirmed: boolean;
}
