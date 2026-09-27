<script lang="ts">
	import { setContext, untrack } from 'svelte';
	import Targets from './Targets.svelte';

	let { messageDocument } = $props();

	setContext(
		'messageDocument',
		untrack(() => messageDocument),
	);
</script>

<Targets />
