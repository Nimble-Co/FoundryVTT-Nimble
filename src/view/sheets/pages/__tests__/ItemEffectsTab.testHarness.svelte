<script lang="ts">
	import { setContext, untrack } from 'svelte';
	import ItemEffectsTab from '../ItemEffectsTab.svelte';

	let { item } = $props();

	setContext(
		'document',
		untrack(() => item),
	);
</script>

<ItemEffectsTab />
