<script lang="ts">
	import { setContext, untrack } from 'svelte';
	import ConcentrationNode from './ConcentrationNode.svelte';

	let { messageDocument } = $props();

	setContext(
		'messageDocument',
		untrack(() => messageDocument),
	);
</script>

<ConcentrationNode />
