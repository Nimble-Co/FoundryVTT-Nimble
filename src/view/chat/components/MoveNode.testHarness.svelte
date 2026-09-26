<script lang="ts">
	import { setContext, untrack } from 'svelte';
	import MoveNode from './MoveNode.svelte';

	let { messageDocument, node } = $props();

	setContext(
		'messageDocument',
		untrack(() => messageDocument),
	);
</script>

<MoveNode {node} />
