<!--
@component
A save or an ability: the modifier over a strip with the ability. Advantage stacks, so `advantage` is a count:
above 0 tints the strip green, below 0 red, and the tooltip says how many. With `onclick` the tile is a button that rolls the save.
Put it inside `nimble-chrome` on the rail. `stripTone="card"` is the NPC rail: with no advantage the strip has the card border colour, not bronze.
-->
<script lang="ts">
	import type { SaveTileProps } from '#types/components/actorSheets/SaveTile.d.ts';
	import localize from '#utils/localize.js';

	let {
		ability,
		mod = '+0',
		advantage = 0,
		stripTone = 'bronze',
		onclick,
	}: SaveTileProps = $props();

	const mode = $derived(
		advantage > 0
			? localize('NIMBLE.actorSheet.parts.saveTile.advantage', { count: String(advantage) })
			: advantage < 0
				? localize('NIMBLE.actorSheet.parts.saveTile.disadvantage', { count: String(-advantage) })
				: localize('NIMBLE.actorSheet.parts.saveTile.straight'),
	);
</script>

{#if onclick}
	<button
		type="button"
		class="nimble-u-reset-button save"
		class:card={stripTone === 'card'}
		class:adv={advantage > 0}
		class:dis={advantage < 0}
		data-tooltip={localize('NIMBLE.actorSheet.parts.saveTile.roll', { ability, mode })}
		{onclick}
	>
		<span class="v">{mod}</span><span class="k">{ability}</span>
	</button>
{:else}
	<div
		class="save"
		class:card={stripTone === 'card'}
		class:adv={advantage > 0}
		class:dis={advantage < 0}
		data-tooltip={mode}
	>
		<span class="v">{mod}</span><span class="k">{ability}</span>
	</div>
{/if}

<style>
	.save {
		display: flex;
		flex-direction: column;
		align-items: stretch;
		min-width: 0;
		border: 1px solid color-mix(in srgb, var(--nimble-bronze) 60%, transparent);
		border-radius: 4px;
		overflow: hidden;
		font-family: var(--nimble-primary-font);
		color: var(--nimble-ui-ink);
	}
	button.save:hover {
		border-color: var(--nimble-parchment);
	}
	.v {
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 4px 0 3px;
		font-size: 0.937rem;
		font-weight: 600;
	}
	.k {
		padding: 2px 0;
		text-align: center;
		font-size: 0.594rem;
		font-weight: 900;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		background: hsla(41, 18%, 54%, 0.25);
	}
	.card .k {
		background: var(--nimble-card-border-color);
	}
	.adv .k {
		background: var(--nimble-roll-success-background-color);
		color: var(--nimble-roll-success-color);
	}
	.dis .k {
		background: hsla(0, 60%, 40%, 0.35);
		color: var(--nimble-ui-vital);
	}
</style>
