<script lang="ts">
	import { setContext, untrack } from 'svelte';
	import ChaosButton from '../ChaosButton.svelte';

	let { messageDocument } = $props();

	setContext(
		'messageDocument',
		untrack(() => messageDocument),
	);
</script>

<ChaosButton />
