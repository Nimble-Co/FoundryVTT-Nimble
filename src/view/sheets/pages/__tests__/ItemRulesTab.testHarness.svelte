<script lang="ts">
	import { setContext, untrack } from 'svelte';
	import ItemRulesTab from '../ItemRulesTab.svelte';

	let { item } = $props();

	setContext(
		'document',
		untrack(() => item),
	);
</script>

<ItemRulesTab />
