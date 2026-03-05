import type { PrimaryTabName } from './playerCharacterPrimaryTabs.js';

export const DROP_ITEM_FLASH_ANIMATION_NAME = 'nimble-drop-item-flash';

export type SheetDropItemFlashState = {
	activePrimaryTab?: PrimaryTabName | null;
	droppedItemFlashIds?: string[];
};

export function getDroppedItemFlashIds(
	sheetState: SheetDropItemFlashState | null | undefined,
): string[] {
	if (!Array.isArray(sheetState?.droppedItemFlashIds)) return [];

	return sheetState.droppedItemFlashIds.filter(
		(itemId): itemId is string => typeof itemId === 'string' && itemId.length > 0,
	);
}
