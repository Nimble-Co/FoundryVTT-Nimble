<script lang="ts">
	import { setContext, untrack } from 'svelte';
	import HealingNode from '../HealingNode.svelte';

	let { messageDocument, node } = $props();

	setContext(
		'messageDocument',
		untrack(() => messageDocument),
	);
</script>

<HealingNode {node} />
