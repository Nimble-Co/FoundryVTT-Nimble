<script lang="ts">
	import { setContext, untrack } from 'svelte';
	import PlayerCharacterHeroicActionsTab from './PlayerCharacterHeroicActionsTab.svelte';

	let { actor, application, sheetState } = $props();

	setContext(
		'actor',
		untrack(() => actor),
	);
	setContext(
		'application',
		untrack(() => application),
	);
	setContext(
		'sheetState',
		untrack(() => sheetState),
	);
</script>

<PlayerCharacterHeroicActionsTab />
