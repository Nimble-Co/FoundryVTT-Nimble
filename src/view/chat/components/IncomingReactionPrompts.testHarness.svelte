<script lang="ts">
	import { setContext, untrack } from 'svelte';
	import IncomingReactionPrompts from './IncomingReactionPrompts.svelte';

	let { messageDocument } = $props();

	setContext(
		'messageDocument',
		untrack(() => messageDocument),
	);
</script>

<div data-testid="roll-place">
	<IncomingReactionPrompts place="roll" />
</div>
<div data-testid="options-place">
	<IncomingReactionPrompts place="options" />
</div>
