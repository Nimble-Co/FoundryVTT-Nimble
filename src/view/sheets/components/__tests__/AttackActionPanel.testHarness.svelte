<script lang="ts">
	import { setContext, untrack } from 'svelte';
	import AttackActionPanel from '../AttackActionPanel.svelte';

	let { actor, application } = $props();

	setContext(
		'actor',
		untrack(() => actor),
	);
	setContext(
		'application',
		untrack(() => application),
	);
</script>

<AttackActionPanel />
