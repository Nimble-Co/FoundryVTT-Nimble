<!--
@component
One ability on the NPC sheet. It stays a card, because a GM reads the abilities as a stat block, and the text starts open.

- A click on the name or the image does what the system does: kind `roll` (d20 icon) opens the roll window, kind `chat` (speech bubble) posts to chat.
- When you point at the name, the whole card gets the accent border and a light tint. There is no box inside the card.
- The arrow (at the start) and the pen are the same `RowButton`s as on a character row.
- `descriptionHtml` (the text that Foundry enriched) replaces the plain `description`.
- The range and the uses show on the right, with `RowCost`. `nested` indents the abilities of an attack sequence.
- In edit mode, `fields` replaces the range and the uses with the numbers that you type, and with no `onuse` the name does not act.
  `children` (a ConfirmBar) shows under the text.
-->
<script lang="ts">
	import type { AbilityCardProps } from '#types/components/actorSheets/AbilityCard.d.ts';
	import localize from '#utils/localize.js';
	import RowButton from './RowButton.svelte';
	import RowCost from './RowCost.svelte';
	import RowTile from './RowTile.svelte';

	let {
		name,
		img,
		icon,
		kind = 'chat',
		range,
		uses,
		description,
		descriptionHtml,
		nested = false,
		open = $bindable(true),
		onuse,
		onedit,
		touch = false,
		state,
		id,
		fields,
		children,
	}: AbilityCardProps = $props();

	const roll = $derived(kind === 'roll');
	const pid = $derived(id ? `${id}-text` : undefined);
	const useText = $derived(
		localize(
			roll
				? 'NIMBLE.actorSheet.parts.abilityCard.roll'
				: 'NIMBLE.actorSheet.parts.abilityCard.post',
			{ name },
		),
	);
</script>

{#snippet face()}
	<RowTile {img} {icon} size="sm" />
	<span class="nm"><i class="fa-solid {roll ? 'fa-dice-d20' : 'fa-comment'}"></i>{name}</span>
{/snippet}

<div class="card {state ?? ''}" class:nested class:touch>
	<div class="cr">
		<RowButton
			kind="expand"
			size="sm"
			{open}
			{name}
			controls={pid}
			{touch}
			onclick={() => (open = !open)}
		/>
		{#if onuse}
			<button
				type="button"
				class="nimble-u-reset-button act"
				data-tooltip={useText}
				onclick={onuse}
			>
				{@render face()}
			</button>
		{:else}
			<span class="act">{@render face()}</span>
		{/if}
		{#if fields}<span class="fz">{@render fields()}</span>{:else if uses || range}<RowCost
				uses={uses ? [uses] : []}
				{range}
				compact
				outTone="ink"
				hints
			/>{/if}
		<RowButton kind="edit" size="sm" {name} {touch} onclick={onedit} />
	</div>
	{#if open && descriptionHtml}
		<div class="ds html" id={pid}>{@html descriptionHtml}</div>
	{:else if open && description}<p class="ds" id={pid}>{description}</p>{/if}
	{@render children?.()}
</div>

<style>
	.card {
		break-inside: avoid;
		margin: 0 0 4px;
		background: var(--nimble-card-background-color);
		border: 1px solid var(--nimble-card-border-color);
		border-radius: 4px;
		font-family: var(--nimble-primary-font);
		transition:
			border-color 0.14s cubic-bezier(0.2, 0.8, 0.2, 1),
			background-color 0.14s cubic-bezier(0.2, 0.8, 0.2, 1);
	}
	.card:has(button.act:hover) {
		border-color: var(--nimble-accent-color);
		background: color-mix(
			in srgb,
			var(--nimble-card-background-color) 88%,
			var(--nimble-ui-highlight)
		);
	}
	.just {
		border-color: var(--nimble-accent-color);
	}
	.nested {
		margin-left: 14px;
	}
	.cr {
		display: flex;
		align-items: center;
		gap: 2px;
		padding: 2px 2px 2px 3px;
	}
	.cr :global(.rb) {
		align-self: stretch;
		height: auto;
	}
	.act {
		flex: 1;
		min-width: 0;
		display: flex;
		align-items: center;
		gap: 8px;
		min-height: 30px;
		padding: 2px 4px 2px 1px;
		border-radius: 3px;
	}
	.fz {
		flex: none;
		display: flex;
		align-items: center;
		gap: 6px;
	}
	.nm {
		display: flex;
		align-items: center;
		gap: 5px;
		min-width: 0;
		font-size: 0.893rem;
		font-weight: 700;
		line-height: 1.2;
		color: var(--nimble-ui-ink);
	}
	.nm i {
		flex: none;
		font-size: 0.714rem;
		color: var(--nimble-ui-ink-muted);
	}
	.out .nm {
		color: var(--nimble-ui-ink-muted);
	}
	.out :global(.tile) {
		opacity: 0.45;
	}
	.ds {
		margin: 0;
		padding: 0 8px 6px 65px;
		font-size: 0.893rem;
		line-height: 1.35;
		color: var(--nimble-ui-ink-muted);
		text-wrap: pretty;
		animation: reveal 0.18s cubic-bezier(0.2, 0.8, 0.2, 1);
	}
	.html :global(p) {
		margin: 0 0 4px;
	}
	.html :global(p:last-child) {
		margin-bottom: 0;
	}
	.touch .act {
		min-height: 44px;
	}
	/* the text starts under the name: the arrow (26 px, 40 px on a phone) and the gap move it */
	.touch .ds {
		padding-left: 80px;
	}
	@keyframes reveal {
		from {
			opacity: 0;
			transform: translateY(-3px);
		}
		to {
			opacity: 1;
			transform: none;
		}
	}
</style>
