/**
 * Plans a move of one object between two inventories. The caller applies the plan.
 * Nothing here reads Foundry: the same rules cover a character and the party stash.
 */

/** A plain item, as `toObject()` stores it or as the party stash holds it. */
export interface TransferItem {
	_id: string;
	name?: string;
	type?: string;
	img?: string;
	system?: Record<string, unknown>;
	[key: string]: unknown;
}

export interface ItemTransferPlan {
	/** documents to delete from the source; empty when a stack is only reduced */
	removeIds: string[];
	/** the stack that stays, with what remains; null when the source document leaves */
	sourceQuantity: { id: string; quantity: number } | null;
	/** documents to create at the destination; empty when they join a stack already there */
	add: TransferItem[];
	/** quantity to add onto a loose stack of the same name; null when creating */
	merge: { id: string; add: number } | null;
	name: string;
	moved: number;
}

/** Same sizes as `OBJECT_SIZE_TYPES_WITH_QUANTITY` on the object item. */
const QUANTITY_SIZES = new Set(['stackable', 'smallSized']);

function systemOf(item: TransferItem): Record<string, unknown> {
	return item.system ?? {};
}

function isContainer(item: TransferItem): boolean {
	const container = systemOf(item).container as { enabled?: boolean } | undefined;
	return container?.enabled === true;
}

function containerIdOf(item: TransferItem): string {
	return String(systemOf(item).containerId ?? '');
}

function quantityOf(item: TransferItem): number {
	const value = Math.floor(Number(systemOf(item).quantity ?? 1));
	return Number.isFinite(value) && value > 0 ? value : 1;
}

function carriesQuantity(item: TransferItem): boolean {
	return QUANTITY_SIZES.has(String(systemOf(item).objectSizeType ?? ''));
}

function prepared(
	item: TransferItem,
	change: { id?: string; loose: boolean; quantity?: number },
): TransferItem {
	const copy = structuredClone(item);
	if (change.id) copy._id = change.id;
	const system = { ...systemOf(copy) };
	system.equipped = false;
	if (change.loose) system.containerId = '';
	if (change.quantity !== undefined) system.quantity = change.quantity;
	copy.system = system;
	return copy;
}

/**
 * What has to change so `request.quantity` of `request.itemId` leaves `sourceItems`
 * and arrives loose on `destinationItems`. A container moves whole, with its contents.
 * A shorter count of a stack stays behind as the same document. Returns null when
 * the item is missing, is not an object, or the count is below 1.
 */
export function planItemTransfer(
	sourceItems: readonly TransferItem[],
	destinationItems: readonly TransferItem[],
	request: { itemId: string; quantity: number },
	newId: () => string,
): ItemTransferPlan | null {
	const root = sourceItems.find((item) => item._id === request.itemId);
	if (!root || root.type !== 'object') return null;

	const asked = Math.floor(Number(request.quantity));
	if (!Number.isFinite(asked) || asked < 1) return null;

	const container = isContainer(root);
	const children = container
		? sourceItems.filter((item) => item._id !== root._id && containerIdOf(item) === root._id)
		: [];
	const have = quantityOf(root);
	const split = !container && asked < have;
	const moved = split ? asked : have;

	const addedRoot = prepared(root, {
		id: split ? newId() : undefined,
		loose: true,
		quantity: moved,
	});
	const addedChildren = children.map((child) => prepared(child, { loose: false }));

	const mergeTarget =
		!container && carriesQuantity(root)
			? destinationItems.find(
					(item) =>
						item._id !== root._id &&
						item.type === 'object' &&
						item.name === root.name &&
						carriesQuantity(item) &&
						containerIdOf(item) === '',
				)
			: undefined;

	return {
		removeIds: split ? [] : [root._id, ...children.map((child) => child._id)],
		sourceQuantity: split ? { id: root._id, quantity: have - moved } : null,
		add: mergeTarget ? [] : [addedRoot, ...addedChildren],
		merge: mergeTarget ? { id: mergeTarget._id, add: moved } : null,
		name: String(root.name ?? ''),
		moved,
	};
}

/** A player moves their own objects, and anything in the stash. A GM moves either. */
export function mayTransferItem(input: {
	isGM: boolean;
	source: 'actor' | 'stash';
	ownsSource: boolean;
	ownsACharacter: boolean;
}): boolean {
	if (input.isGM) return true;
	if (input.source === 'actor') return input.ownsSource;
	return input.ownsACharacter;
}
