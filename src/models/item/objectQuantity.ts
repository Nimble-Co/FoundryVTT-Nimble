/**
 * Object sizes that carry a count, and so fold into an item of the same name
 * already carried. A slot-sized object is one item.
 */
export const OBJECT_SIZE_TYPES_WITH_QUANTITY: ReadonlySet<string> = new Set([
	'stackable',
	'smallSized',
]);
