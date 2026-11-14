interface IdentifiedItem {
	identifier?: string;
	system?: { identifier?: string };
}

/** The identifier of an item: its own, or its system's. */
export function identifierOf(item: IdentifiedItem): string {
	return item.identifier || item.system?.identifier || '';
}
