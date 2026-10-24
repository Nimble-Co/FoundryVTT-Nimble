<script lang="ts">
	import { setContext, untrack } from 'svelte';
	import DamageNode from './DamageNode.svelte';

	let { messageDocument, node, component: Node = DamageNode } = $props();

	setContext(
		'messageDocument',
		untrack(() => messageDocument),
	);
</script>

<Node {node} />
