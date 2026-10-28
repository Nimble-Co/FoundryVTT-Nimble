<svelte:options runes={false} />

<script lang="ts">
	// Storybook renders the story into the default slot of a decorator, so this file keeps the legacy syntax.
	export let chrome = false;
	export let width = '';
</script>

<div class="frame nimble-actor-sheet" class:nimble-chrome={chrome} style:max-width={width || null}>
	<slot />
</div>

<style>
	.frame {
		padding: 12px;
		border-radius: 6px;
		background: var(--nimble-sheet-background);
	}
	.frame.nimble-chrome {
		background: var(--nimble-ui-chrome);
	}
</style>
