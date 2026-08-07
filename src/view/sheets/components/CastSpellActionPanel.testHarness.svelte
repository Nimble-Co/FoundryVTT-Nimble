<script lang="ts">
	import { setContext, untrack } from 'svelte';
	import CastSpellActionPanel from './CastSpellActionPanel.svelte';

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

<CastSpellActionPanel {showEmbeddedDocumentImages} />
