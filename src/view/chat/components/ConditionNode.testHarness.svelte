<script lang="ts">
	import { setContext, untrack } from 'svelte';
	import ConditionNode from './ConditionNode.svelte';

	let { messageDocument, node } = $props();

	setContext(
		'messageDocument',
		untrack(() => messageDocument),
	);
</script>

<ConditionNode {node} />
