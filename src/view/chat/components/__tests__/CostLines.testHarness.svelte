<script lang="ts">
	import { setContext, untrack } from 'svelte';
	import CostLines from '../CostLines.svelte';

	let { messageDocument } = $props();

	setContext(
		'messageDocument',
		untrack(() => messageDocument),
	);
</script>

<CostLines />
