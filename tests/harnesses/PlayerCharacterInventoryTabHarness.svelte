<script lang="ts">
	import { setContext, untrack } from 'svelte';

	import PlayerCharacterInventoryTab from '../../src/view/sheets/pages/PlayerCharacterInventoryTab.svelte';

	type HarnessItem = {
		_id: string;
		name: string;
		system: Record<string, unknown>;
	};

	let {
		items = [],
		containerCapacityUsage = {},
		updateItem = () => {},
		updateStoredObjectQuantity = () => {},
		storeItemInContainer = () => {},
		removeItemFromContainer = () => {},
		toggleEquipment = () => {},
		onDragStart = () => {},
		onDropItem = () => [],
	}: {
		items?: HarnessItem[];
		containerCapacityUsage?: Record<string, number>;
		updateItem?: (id: string, changes: Record<string, unknown>) => unknown;
		updateStoredObjectQuantity?: (itemId: string, quantity: number) => unknown;
		storeItemInContainer?: (itemId: string, containerId: string) => unknown;
		removeItemFromContainer?: (itemId: string) => unknown;
		toggleEquipment?: (itemId: string) => unknown;
		onDragStart?: (event: DragEvent) => unknown;
		onDropItem?: (
			event: DragEvent,
			dropData: Record<string, unknown>,
			options?: { containerId?: string },
		) => unknown;
	} = $props();

	const containerDefaults = {
		enabled: false,
		slotCostMode: 'none',
		slotCostReduction: 1,
		capacity: null,
		allowedObjectTypes: [],
		requiresEquipped: false,
	};

	// Build item objects that mirror the shape the inventory tab reads:
	// each item exposes both a direct `system` (used for the disabled binding)
	// and a `reactive` view (used for value bindings and rendering).
	const preparedItems = untrack(() => items).map((item) => {
		const prepared: Record<string, unknown> = {
			_id: item._id,
			id: item._id,
			type: 'object',
			sort: 0,
			name: item.name,
			img: 'icons/svg/item-bag.svg',
			uuid: `Item.${item._id}`,
			system: {
				objectType: 'gear',
				quantity: 1,
				rules: [],
				equipped: false,
				containerId: '',
				...item.system,
				container: {
					...containerDefaults,
					...((item.system.container as Record<string, unknown>) ?? {}),
				},
			},
		};
		prepared.toggleEquipment = () => untrack(() => toggleEquipment)(item._id);
		// The template reads `item.reactive.*`; point it back at the item itself.
		prepared.reactive = prepared;
		return prepared;
	});

	const actor = {
		updateItem: untrack(() => updateItem),
		updateStoredObjectQuantity: untrack(() => updateStoredObjectQuantity),
		storeItemInContainer: untrack(() => storeItemInContainer),
		removeItemFromContainer: untrack(() => removeItemFromContainer),
		update: () => {},
		activateItem: () => {},
		createItem: () => {},
		configureItem: () => {},
		deleteItem: () => {},
		items: preparedItems,
		reactive: {
			items: preparedItems,
			system: {
				currency: {},
				inventory: {
					totalSlots: 0,
					usedSlots: 0,
					containerCapacityUsage: untrack(() => containerCapacityUsage),
				},
			},
			flags: {},
		},
	};

	setContext('actor', actor);
	setContext('application', {
		_onDragStart: untrack(() => onDragStart),
		_onDropItem: untrack(() => onDropItem),
		_onSortItem: () => {},
		clearDroppedItemFlash: () => {},
	});
	setContext('sheetState', {});
</script>

<PlayerCharacterInventoryTab />
