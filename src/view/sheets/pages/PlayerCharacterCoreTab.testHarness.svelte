<script lang="ts">
	import { setContext, untrack } from 'svelte';
	import PlayerCharacterCoreTab from './PlayerCharacterCoreTab.svelte';

	let { actor } = $props();

	setContext(
		'actor',
		untrack(() => actor),
	);
</script>

<PlayerCharacterCoreTab />
