<!--
@component
The header of the narrow character sheet (below 560 px): who the hero is, the vital numbers, the rests and the rare actions
as icons, armor and speed, Initiative and the turn. It stays dark in both themes.
-->
<script lang="ts">
	import EditZone from '../../parts/EditZone.svelte';
	import StatBox from '../../parts/StatBox.svelte';
	import VitalPlate from '../../parts/VitalPlate.svelte';
	import type { SheetUiState } from '../../shared/sheetUiState.ts';
	import type { HeroPerform } from '../heroIntent.ts';
	import type { HeroRailView } from '../heroRail.ts';
	import HeroInitiative from './HeroInitiative.svelte';
	import HeroRareActions from './HeroRareActions.svelte';
	import HeroTurnBox from './HeroTurnBox.svelte';
	import localize from '#utils/localize.js';

	interface Props {
		view: HeroRailView;
		ui: SheetUiState;
		perform: HeroPerform;
	}

	let { view, ui, perform }: Props = $props();

	const R = 'NIMBLE.actorSheet.hero.rail';
	const editing = $derived(ui.editing);
</script>

<header class="nimble-chrome header" class:editing aria-label={localize(`${R}.label`)}>
	<div class="clip">
		<div
			class="art"
			style:background-image="url('{view.img}')"
			style:translate="{view.portrait.x}px {view.portrait.y}px"
			style:scale={view.portrait.scale / 100}
		></div>
	</div>
	<div class="fade"></div>
	<div class="column">
		<div class="who">
			{#if editing}
				<button
					type="button"
					class="nimble-u-reset-button icon"
					aria-label={localize('NIMBLE.prompts.changeActorImage')}
					data-tooltip={localize('NIMBLE.prompts.changeActorImage')}
					onclick={(event) => perform({ kind: 'changePortrait', skipTokenizer: event.shiftKey })}
				>
					<i class="fa-solid fa-image"></i>
				</button>
				<input
					class="name-field"
					type="text"
					value={view.name}
					aria-label={localize(`${R}.name`)}
					onchange={(event) => perform({ kind: 'rename', name: event.currentTarget.value })}
				/>
			{:else}
				<h2>{view.name}</h2>
			{/if}
			<span class="meta">
				<span>{view.meta}</span>
				{#if editing}
					<EditZone
						inline
						short={localize(`${R}.metaShort`)}
						label={localize(`${R}.metaLabel`)}
						onclick={() => perform({ kind: 'configure', target: 'metadata' })}
					/>
				{/if}
			</span>
		</div>
		<div class="plates">
			<div class="zone-holder hp">
				<VitalPlate
					variant="block"
					compact
					label={localize('NIMBLE.actorSheet.parts.vitalPlate.hp')}
					value={view.hp.value}
					max={view.hp.max}
					state={view.hp.state ?? undefined}
					dying={view.hp.dying}
					tooltip={view.hp.tooltip}
					rest={editing}
					onchange={(value) => perform({ kind: 'setHp', value })}
				/>
				{#if editing}
					<EditZone
						short={localize(`${R}.hpShort`)}
						label={localize(`${R}.configureHp`)}
						onclick={() => perform({ kind: 'configure', target: 'hitPoints' })}
					/>
				{/if}
			</div>
			<div class="temp">
				<VitalPlate
					variant="block"
					compact
					temp
					label={localize('NIMBLE.actorSheet.parts.vitalPlate.tempHp')}
					value={view.hp.temp}
					rest={editing}
					onchange={(value) => perform({ kind: 'setTempHp', value })}
				/>
			</div>
			<span class="buttons">
				{#if view.rests}
					{@const rests = view.rests}
					<button
						type="button"
						class="nimble-u-reset-button icon"
						aria-label={localize('NIMBLE.prompts.fieldRest')}
						data-tooltip={localize('NIMBLE.prompts.fieldRest')}
						disabled={editing}
						onclick={() => perform(rests.field)}
					>
						<i class="fa-regular fa-hourglass-half"></i>
					</button>
					<button
						type="button"
						class="nimble-u-reset-button icon"
						aria-label={localize('NIMBLE.prompts.safeRest')}
						data-tooltip={localize('NIMBLE.prompts.safeRest')}
						disabled={editing}
						onclick={() => perform(rests.safe)}
					>
						<i class="fa-solid fa-moon"></i>
					</button>
				{/if}
				<HeroRareActions {view} {ui} {perform} compact />
			</span>
		</div>
		<div class="stats">
			<StatBox
				variant="inline"
				icon="fa-solid fa-shield-halved"
				label={view.armor.label}
				value={view.armor.value}
				tooltip={view.armor.tooltip}
			/>
			<span class="zone-holder speeds">
				{#each view.speeds as speed (speed.type)}
					<StatBox
						variant="inline"
						icon={speed.icon}
						label={speed.label}
						value={speed.value}
						note={speed.note ?? undefined}
						tooltip={speed.tooltip}
					/>
				{/each}
				{#if editing}
					<EditZone
						short={localize(`${R}.movementShort`)}
						label={localize('NIMBLE.prompts.configureMovement')}
						onclick={() => perform({ kind: 'configure', target: 'movement' })}
					/>
				{/if}
			</span>
		</div>
		<HeroInitiative initiative={view.initiative} {editing} {perform} />
		{#if view.turn}<HeroTurnBox turn={view.turn} {ui} {perform} compact />{/if}
	</div>
</header>

<style>
	.header {
		position: relative;
		flex-shrink: 0;
		padding: 9px 10px;
		background: var(--nimble-ui-chrome);
		border-bottom: 1px solid var(--nimble-ui-line);
	}
	.clip {
		position: absolute;
		inset: 0;
		overflow: hidden;
	}
	.art {
		position: absolute;
		inset: 0;
		background: right 12% / 44% auto no-repeat;
		transform-origin: top right;
	}
	.fade {
		position: absolute;
		inset: 0;
		background: linear-gradient(to right, var(--nimble-ui-chrome) 54%, transparent 130%);
	}
	.column {
		position: relative;
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	.editing .column {
		gap: 18px;
	}
	.who {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 2px 7px;
		padding-right: 58px;
	}
	.editing .who {
		column-gap: 15px;
	}
	h2 {
		margin: 0;
		border: none;
		font-size: 1.214rem;
		font-weight: 900;
		line-height: 1.1;
		color: var(--nimble-ui-highlight);
	}
	.name-field {
		all: unset;
		box-sizing: border-box;
		flex: 0 1 150px;
		min-width: 0;
		border-bottom: 1px dashed var(--nimble-ui-ring);
		font-size: 1.214rem;
		font-weight: 900;
		color: var(--nimble-ui-highlight);
		cursor: text;
	}
	.name-field:focus {
		background: var(--nimble-ui-well);
	}
	.meta {
		position: relative;
		display: inline-flex;
		align-items: center;
		font-size: 0.833rem;
		color: var(--nimble-ui-ink-muted);
	}
	.plates {
		display: flex;
		align-items: flex-end;
		gap: 5px;
	}
	.editing .plates {
		gap: 13px;
	}
	.zone-holder {
		position: relative;
	}
	.hp {
		min-width: 88px;
	}
	.temp {
		min-width: 60px;
	}
	.buttons {
		margin-left: auto;
		display: flex;
		gap: 4px;
	}
	.icon {
		display: grid;
		place-items: center;
		flex: none;
		width: 28px;
		height: 28px;
		border: 1px solid var(--nimble-ui-ring);
		border-radius: 4px;
		font-size: 0.786rem;
		color: var(--nimble-ui-ink);
	}
	.icon:hover {
		border-color: var(--nimble-ui-highlight);
	}
	.icon:disabled {
		opacity: 0.4;
		pointer-events: none;
	}
	.stats {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 4px 14px;
	}
	.speeds {
		display: inline-flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 2px 14px;
	}
</style>
