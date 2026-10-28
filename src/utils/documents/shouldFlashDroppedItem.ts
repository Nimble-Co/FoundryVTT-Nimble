export default function shouldFlashDroppedItem(
	droppedItemFlashIds: Set<string>,
	itemId: string | null | undefined,
): boolean {
	return typeof itemId === 'string' && droppedItemFlashIds.has(itemId);
}
