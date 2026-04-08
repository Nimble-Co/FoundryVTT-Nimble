import type { ExpandableDocumentItem } from '#types/components/ExpandableDocumentList.d.ts';

/**
 * Creates reactive state for the ExpandableDocumentList component.
 *
 * Manages expansion toggling, description loading, and item selection.
 */
export function createExpandableDocumentListState(
	getItems: () => ExpandableDocumentItem[],
	getSelectedItem: () => ExpandableDocumentItem | null,
	setSelectedItem: (item: ExpandableDocumentItem | null) => void,
) {
	let expandedUuids: Set<string> = $state(new Set());
	let expandedDataMap: Map<string, { system?: { description?: string } }> = $state(new Map());

	const displayedItems = $derived(
		getSelectedItem() ? getItems().filter((i) => i.uuid === getSelectedItem()!.uuid) : getItems(),
	);

	async function toggleExpanded(uuid: string) {
		if (expandedUuids.has(uuid)) {
			expandedUuids.delete(uuid);
			expandedUuids = new Set(expandedUuids);
			expandedDataMap.delete(uuid);
			expandedDataMap = new Map(expandedDataMap);
		} else {
			try {
				// @ts-expect-error — Foundry's fromUuid accepts any string at runtime
				const data = await fromUuid(uuid);
				expandedUuids.add(uuid);
				expandedUuids = new Set(expandedUuids);
				expandedDataMap.set(uuid, data as { system?: { description?: string } });
				expandedDataMap = new Map(expandedDataMap);
			} catch (err) {
				console.warn(`Nimble | Failed to load document ${uuid}:`, err);
			}
		}
	}

	async function handleSelectClick(uuid: string, event: MouseEvent) {
		event.stopPropagation();
		if (getSelectedItem()?.uuid === uuid) {
			setSelectedItem(null);
		} else {
			try {
				// @ts-expect-error — Foundry's fromUuid accepts any string at runtime
				setSelectedItem(await fromUuid(uuid));
			} catch (err) {
				console.warn(`Nimble | Failed to load document ${uuid}:`, err);
			}
		}
	}

	function handleRowClick(uuid: string) {
		toggleExpanded(uuid);
	}

	function handleKeydown(e: KeyboardEvent, uuid: string) {
		if (e.key === 'Enter') {
			handleRowClick(uuid);
		}
	}

	return {
		get displayedItems() {
			return displayedItems;
		},
		get expandedUuids() {
			return expandedUuids;
		},
		get expandedDataMap() {
			return expandedDataMap;
		},
		handleSelectClick,
		handleRowClick,
		handleKeydown,
	};
}
