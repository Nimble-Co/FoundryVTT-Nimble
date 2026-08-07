<script lang="ts">
	import { setContext, untrack } from 'svelte';
	import IncomingReactionPrompts from './IncomingReactionPrompts.svelte';

	let { messageDocument } = $props();

	setContext(
		'messageDocument',
		untrack(() => messageDocument),
	);
</script>

<IncomingReactionPrompts />
