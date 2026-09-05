<script lang="ts">
	import OptionSwapSection from './OptionSwapSection.svelte';

	let { document: actor, offer, onChange } = $props();

	let selections = $state(new Map<string, string[]>());
	let skillPoints = $state(new Map<string, number>());

	$effect(() => {
		onChange?.({ selections, skillPoints });
	});
</script>

<OptionSwapSection document={actor} {offer} bind:selections bind:skillPoints />
