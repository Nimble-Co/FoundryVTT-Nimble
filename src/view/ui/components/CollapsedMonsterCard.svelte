<script>
	import { scale } from 'svelte/transition';

	import HitPointBar from '../../sheets/components/HitPointBar.svelte';

	let {
		actor,
		currentHP,
		isBloodied,
		maxHP,
		tempHP,
		deleteActorFromTracker,
		updateCurrentHP,
		updateFocusedActor,
		updateMaxHP,
		updateTempHP,
	} = $props();

	const { npcArmorTypes } = CONFIG.NIMBLE;
</script>

<li class="nimble-monster-tracker-actor-list__item" data-uuid={actor.uuid} in:scale>
	<header class="nimble-monster-tracker-actor-header">
		<h4 class="nimble-heading">
			{actor.reactive.name ?? actor.token?.reactive.name}
		</h4>

		<div style="display: flex; align-items: center; gap: 0.5rem;">
			<button
				class="nimble-button"
				data-button-variant="icon"
				aria-label="Expand Sheet"
				data-tooltip="Expand Sheet"
				data-tooltip-direction="UP"
				onclick={() => updateFocusedActor(actor.uuid)}
			>
				<i class="nimble-button__icon fa-solid fa-maximize"></i>
			</button>

			<button
				class="nimble-button"
				data-button-variant="icon"
				aria-label="Remove Creature from Monster Tracker"
				data-tooltip="Remove Creature from Monster Tracker"
				data-tooltip-direction="UP"
				onclick={() => deleteActorFromTracker(actor.uuid)}
			>
				<i class="nimble-button__icon fa-solid fa-trash"></i>
			</button>
		</div>
	</header>

	<div class="nimble-monster-sheet-section nimble-monster-sheet-section--defense">
		<h3
			class="nimble-monster-heading nimble-monster-heading--capitalized nimble-monster-heading--hp"
		>
			Hit Points

			{#if isBloodied}
				<i class="fa-solid fa-heart-crack"></i>
			{:else}
				<i class="fa-solid fa-heart"></i>
			{/if}
		</h3>

		<HitPointBar
			{currentHP}
			{maxHP}
			{tempHP}
			{isBloodied}
			updateCurrentHP={(value) => updateCurrentHP(actor, value)}
			updateMaxHP={(value) => updateMaxHP(actor, value)}
			updateTempHP={(value) => updateTempHP(actor, value)}
		/>

		<h3
			class="nimble-monster-heading nimble-monster-heading--capitalized nimble-monster-heading--armor"
		>
			Armor
			<i class="fa-solid fa-shield"></i>
		</h3>

		<span class="nimble-monster-span nimble-monster-input--armor">
			{npcArmorTypes[actor.reactive.system.attributes.armor] ?? npcArmorTypes['none']}
		</span>
	</div>
</li>

<style lang="scss">
	.nimble-monster-sheet-section {
		padding: 0.5rem;

		&:not(:last-of-type) {
			border-bottom: 1px solid hsl(41, 18%, 54%);
		}

		&--defense,
		&--defense:not(:last-of-type) {
			border: none;
			padding: 0;
		}

		&--defense {
			position: relative;
			display: grid;
			grid-template-columns: 1fr max-content;
			grid-template-areas:
				'hpHeading armorHeading'
				'hpBar armorInput';
			grid-gap: 0 0.125rem;
			margin: 0.25rem;
		}
	}

	.nimble-monster-tracker-actor-list__item {
		pointer-events: auto;
		flex-shrink: 0;
		width: 15rem;
		background: var(--nimble-sheet-background);
		border: 1px solid var(--color-border);
		border-radius: 6px;
	}

	.nimble-monster-heading {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		margin: 0;
		padding: 0;
		font-size: var(--nimble-sm-text);
		font-weight: 900;
		text-transform: uppercase;
		text-shadow: none;
		color: var(--nimble-dark-text-color);
		border: 0;

		&--armor {
			justify-content: center;
		}

		&--armor,
		&--hp {
			color: var(--nimble-dark-text-color);
			// text-shadow: 0 0 4px black;
			padding-block-end: 0.25rem;
		}

		&--hp {
			padding-inline: 0.25rem;
		}
	}

	.nimble-monster-input--armor {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 12ch;
		font-weight: 600;
		text-align: center;
		text-shadow: 0 0 4px hsl(41, 18%, 54%);
		text-transform: uppercase;
		line-height: 1;
		color: #fff;
		background: transparent;
		background-color: var(--nimble-hp-bar-background);
		border: 1px solid hsl(41, 18%, 54%);
		border-radius: 4px;
		box-shadow: var(--nimble-card-box-shadow);

		&:active,
		&:focus,
		&:hover {
			border: 1px solid hsl(41, 18%, 54%);
			outline: none;
			box-shadow: var(--nimble-card-box-shadow);
		}
	}

	.nimble-monster-tracker-actor-header {
		--nimble-button-icon-y-nudge: 1px;

		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.25rem;
		padding: 0.25rem 0.5rem;
		border-bottom: 1px solid var(--nimble-card-border-color);
	}

	:global(.theme-dark) {
		.nimble-monster-tracker-actor-header button {
			--nimble-button-icon-font-size: var(--nimble-sm-text);
			color: white;
		}
	}
</style>
