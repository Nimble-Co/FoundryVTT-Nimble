<script lang="ts">
	import { getContext } from 'svelte';

	// Type definitions
	interface ReactiveItem {
		img: string;
		name: string;
	}
	interface Item {
		_id: string;
		reactive: ReactiveItem;
	}

	// Props
	let { item }: { item: Item } = $props();

	// Context
	const actor = getContext<NimbleBaseActor>('actor');

	function handleActivateItem(event: MouseEvent) {
		event.stopPropagation();
		actor?.activateItem?.(item._id);
	}

	function handleConfigureItem(event: MouseEvent) {
		event.stopPropagation();
		actor?.configureItem?.(item._id);
	}

	function handleDeleteItem(event: MouseEvent) {
		event.stopPropagation();
		actor?.deleteItem?.(item._id);
	}
</script>

<li class="nimble-item">
	<button
		type="button"
		class="nimble-item__activate"
		onclick={handleActivateItem}
		aria-label={`Activate ${item.reactive.name}`}
	>
		<img class="nimble-item__img" src={item.reactive.img} alt={item.reactive.img} />
		<span class="nimble-item__name">
			{item.reactive.name}
		</span>
	</button>

	<button
		type="button"
		onclick={handleConfigureItem}
		data-tooltip={`Edit ${item.reactive.name}`}
		aria-label={`Edit ${item.reactive.name}`}
	>
		<i class="fa-solid fa-edit"></i>
	</button>

	<button
		type="button"
		onclick={handleDeleteItem}
		data-tooltip={`Delete ${item.reactive.name}`}
		aria-label={`Delete ${item.reactive.name}`}
	>
		<i class="fa-solid fa-trash"></i>
	</button>
</li>
