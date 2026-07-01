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
		updateItem = () => {},
	}: {
		items?: HarnessItem[];
		updateItem?: (id: string, changes: Record<string, unknown>) => unknown;
	} = $props();

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
			system: { objectType: 'gear', quantity: 1, rules: [], equipped: false, ...item.system },
		};
		// The template reads `item.reactive.*`; point it back at the item itself.
		prepared.reactive = prepared;
		return prepared;
	});

	const actor = {
		updateItem: untrack(() => updateItem),
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
				inventory: { totalSlots: 0, usedSlots: 0 },
			},
			flags: {},
		},
	};

	setContext('actor', actor);
	setContext('application', {
		_onDragStart: () => {},
		_onDropItem: () => {},
		_onSortItem: () => {},
		clearDroppedItemFlash: () => {},
	});
	setContext('sheetState', {});
</script>

<PlayerCharacterInventoryTab />
