<script lang="ts">
	import { setContext, untrack } from 'svelte';
	import CustomReactionsPanel from './CustomReactionsPanel.svelte';

	let { actor, application, showEmbeddedDocumentImages = true } = $props();

	setContext(
		'actor',
		untrack(() => actor),
	);
	setContext(
		'application',
		untrack(() => application),
	);
</script>

<CustomReactionsPanel {showEmbeddedDocumentImages} />
