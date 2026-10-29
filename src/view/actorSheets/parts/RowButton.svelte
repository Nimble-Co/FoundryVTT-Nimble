<!--
@component
The two buttons on each row and card. `expand` shows or hides the text in the row; the arrow turns up when the row is open.
`edit` opens the window of the thing (Configure, with Delete). A row with no window (reactions, effects, built-in actions) gets `spacer`,
so the arrows and the costs stay in one column. The buttons are always visible and quiet at rest.
-->
<script lang="ts">
	import type { RowButtonProps } from '#types/components/actorSheets/RowButton.d.ts';
	import localize from '#utils/localize.js';

	let {
		kind = 'expand',
		open = false,
		name = '',
		size = 'md',
		touch = false,
		controls,
		onclick,
	}: RowButtonProps = $props();

	const label = $derived(
		kind === 'edit'
			? localize('NIMBLE.actorSheet.parts.rowButton.configure', { name })
			: localize(
					open
						? 'NIMBLE.actorSheet.parts.rowButton.collapse'
						: 'NIMBLE.actorSheet.parts.rowButton.reveal',
					{ name },
				),
	);
</script>

{#if kind === 'spacer'}
	<span class="rb spacer" class:sm={size === 'sm'} class:touch aria-hidden="true"></span>
{:else if kind === 'edit'}
	<button
		type="button"
		class="nimble-u-reset-button rb"
		class:sm={size === 'sm'}
		class:touch
		aria-label={label}
		data-tooltip={label}
		{onclick}
	>
		<i class="fa-solid fa-edit"></i>
	</button>
{:else}
	<button
		type="button"
		class="nimble-u-reset-button rb"
		class:sm={size === 'sm'}
		class:touch
		aria-expanded={open}
		aria-controls={controls}
		aria-label={label}
		data-tooltip={label}
		{onclick}
	>
		<i class="fa-solid fa-chevron-down"></i>
	</button>
{/if}

<style>
	.rb {
		flex: none;
		display: grid;
		place-items: center;
		width: 30px;
		height: 36px;
		border-radius: 4px;
		font-size: 0.857rem;
		color: var(--nimble-ui-ink-dim);
		transition:
			background-color 0.14s cubic-bezier(0.2, 0.8, 0.2, 1),
			color 0.14s cubic-bezier(0.2, 0.8, 0.2, 1);
	}
	.rb:hover {
		background: var(--nimble-ui-hover);
		color: var(--nimble-ui-ink);
	}
	.rb:active {
		background: var(--nimble-ui-soft);
	}
	.rb i {
		transition: transform 0.18s cubic-bezier(0.2, 0.8, 0.2, 1);
	}
	.rb[aria-expanded='true'] {
		color: var(--nimble-ui-highlight);
	}
	.rb[aria-expanded='true'] i {
		transform: rotate(180deg);
	}
	.sm {
		width: 26px;
		height: 28px;
		font-size: 0.786rem;
	}
	.touch {
		width: 40px;
		height: 44px;
		font-size: 1rem;
	}
	.spacer {
		pointer-events: none;
	}
</style>
