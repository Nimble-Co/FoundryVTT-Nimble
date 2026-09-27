<script lang="ts">
	import { setContext, untrack } from 'svelte';
	import { setTargetsSectionShown } from '../targetsSection.ts';
	import MoveNode from './MoveNode.svelte';

	let { messageDocument, node, targetsShown = false } = $props();

	setContext(
		'messageDocument',
		untrack(() => messageDocument),
	);
	setTargetsSectionShown(untrack(() => targetsShown));
</script>

<MoveNode {node} />
