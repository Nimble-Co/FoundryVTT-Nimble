import type { NimbleAncestryBonusItem } from '#documents/item/ancestryBonus.js';

export interface AncestryBonusSheetProps {
	item: NimbleAncestryBonusItem;
	sheet: foundry.applications.sheets.ItemSheetV2;
}
