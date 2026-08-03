<script lang="ts">
	import { setContext, untrack } from 'svelte';
	import ItemCardEffects from './ItemCardEffects.svelte';

	let { messageDocument, effects = [] } = $props();

	setContext(
		'messageDocument',
		untrack(() => messageDocument),
	);
	setContext(
		'effects',
		untrack(() => effects),
	);
</script>

<ItemCardEffects />
