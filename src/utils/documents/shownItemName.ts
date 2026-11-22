interface NamedItem {
	name?: string | null;
	type?: string;
	system?: unknown;
}

/** The item's name as the table sees it: an unidentified object shows its unidentified name. */
export function shownItemName(item: NamedItem | null | undefined): string {
	const system = item?.system as { identified?: boolean; unidentifiedName?: string } | undefined;
	if (item?.type === 'object' && system?.identified === false && system.unidentifiedName) {
		return system.unidentifiedName;
	}
	return item?.name ?? '';
}
