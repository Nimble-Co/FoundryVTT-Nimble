<script>
	import { getContext } from 'svelte';

	function stopPropagation(fn) {
		return function (event) {
			event.stopPropagation();
			fn.call(this, event);
		};
	}

	let { item } = $props();

	const actor = getContext('actor');
</script>

<li class="nimble-item" onclick={() => actor.activateItem(item._id)}>
	<img class="nimble-item__img" src={item.reactive.img} alt={item.reactive.img} />

	<span class="nimble-item__name">
		{item.reactive.name}
	</span>

	<button
		onclick={stopPropagation(() => actor.configureItem(item._id))}
		data-tooltip="Edit {item.reactive.name}"
	>
		<i class="fa-solid fa-edit"></i>
	</button>

	<button
		onclick={stopPropagation(() => actor.deleteItem(item._id))}
		data-tooltip="Delete {item.reactive.name}"
	>
		<i class="fa-solid fa-trash"></i>
	</button>
</li>
