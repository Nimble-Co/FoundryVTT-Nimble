<script lang="ts">
	import { setContext, untrack } from 'svelte';
	import DamageNode from './DamageNode.svelte';

	let { messageDocument, node } = $props();

	setContext(
		'messageDocument',
		untrack(() => messageDocument),
	);
</script>

<DamageNode {node} />
