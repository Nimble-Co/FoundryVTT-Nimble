<script lang="ts">
	import { setContext, untrack } from 'svelte';
	import TextNode from './TextNode.svelte';

	let { messageDocument, node } = $props();

	setContext(
		'messageDocument',
		untrack(() => messageDocument),
	);
</script>

<TextNode {node} />
