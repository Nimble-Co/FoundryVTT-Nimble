<!--
@component
The rail of the wide character sheet: who the hero is, the vital numbers, Initiative, the rests or the turn,
the tracks and pools, and at the bottom the rare actions (Level Up, the level correction warning) and the Edit switch.
The rail stays dark in both themes.
-->
<script lang="ts">
	import EditZone from '../../parts/EditZone.svelte';
	import StatBox from '../../parts/StatBox.svelte';
	import VitalPlate from '../../parts/VitalPlate.svelte';
	import type { SheetUiState } from '../../shared/sheetUiState.ts';
	import type { HeroPerform } from '../heroIntent.ts';
	import type { HeroRailView } from '../heroRail.ts';
	import HeroInitiative from './HeroInitiative.svelte';
	import HeroMeter from './HeroMeter.svelte';
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

<aside class="nimble-chrome rail" class:editing aria-label={localize(`${R}.label`)}>
	<div class="portrait">
		<div class="clip">
			<div
				class="art"
				style:background-image="url('{view.img}')"
				style:translate="{view.portrait.x}px {view.portrait.y}px"
				style:scale={view.portrait.scale / 100}
			></div>
		</div>
		<div class="fade"></div>
		{#if editing}
			<button
				type="button"
				class="nimble-u-reset-button change"
				aria-label={localize('NIMBLE.prompts.changeActorImage')}
				data-tooltip={localize('NIMBLE.prompts.changeActorImage')}
				onclick={(event) => perform({ kind: 'changePortrait', skipTokenizer: event.shiftKey })}
			>
				<i class="fa-solid fa-image"></i>
			</button>
		{/if}
		<div class="who">
			{#if editing}
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
			<div class="meta">
				<span>{view.meta}</span>
				{#if editing}
					<EditZone
						inline
						short={localize(`${R}.metaShort`)}
						label={localize(`${R}.metaLabel`)}
						onclick={() => perform({ kind: 'configure', target: 'metadata' })}
					/>
				{/if}
			</div>
		</div>
	</div>

	<div class="scroll">
		<div class="vitals">
			<div class="plates">
				<div class="zone-holder">
					<VitalPlate
						variant="block"
						label={localize('NIMBLE.actorSheet.parts.vitalPlate.hp')}
						value={view.hp.value}
						max={view.hp.max}
						state={view.hp.state ?? undefined}
						dying={view.hp.dying}
						icon="fa-solid fa-heart"
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
				<VitalPlate
					variant="block"
					temp
					label={localize('NIMBLE.actorSheet.parts.vitalPlate.tempHp')}
					value={view.hp.temp}
					rest={editing}
					onchange={(value) => perform({ kind: 'setTempHp', value })}
				/>
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
		</div>

		<div class="economy">
			<HeroInitiative initiative={view.initiative} {editing} {perform} />
			{#if view.rests}
				{@const rests = view.rests}
				<div class="rests">
					<button
						type="button"
						class="nimble-u-reset-button secondary"
						disabled={editing}
						onclick={() => perform(rests.field)}
					>
						<i class="fa-regular fa-hourglass-half"></i>{localize('NIMBLE.prompts.fieldRest')}
					</button>
					<button
						type="button"
						class="nimble-u-reset-button secondary"
						disabled={editing}
						onclick={() => perform(rests.safe)}
					>
						<i class="fa-solid fa-moon"></i>{localize('NIMBLE.prompts.safeRest')}
					</button>
				</div>
			{/if}
			{#if view.turn}
				<HeroTurnBox turn={view.turn} {ui} {perform} />
			{/if}
		</div>

		{#each view.meters as meter (meter.id)}
			<HeroMeter {meter} {ui} {perform} />
		{/each}

		<HeroRareActions {view} {ui} {perform} />
	</div>
</aside>

<style>
	.rail {
		flex-shrink: 0;
		display: flex;
		flex-direction: column;
		width: 236px;
		min-height: 0;
		border-right: 1px solid var(--nimble-ui-line);
	}
	.portrait {
		position: relative;
		flex-shrink: 0;
		height: 84px;
		background: var(--nimble-ui-chrome);
	}
	.clip {
		position: absolute;
		inset: 0;
		overflow: hidden;
	}
	.art {
		position: absolute;
		inset: 0;
		background: center 14% / cover no-repeat;
		transform-origin: top center;
	}
	.editing .portrait {
		height: 112px;
	}
	.fade {
		position: absolute;
		inset: 0;
		background: linear-gradient(to bottom, transparent 15%, var(--nimble-ui-chrome) 96%);
	}
	.change {
		position: absolute;
		top: 7px;
		left: 8px;
		z-index: 1;
		display: grid;
		place-items: center;
		width: 28px;
		height: 28px;
		border-radius: 4px;
		background: rgb(0 0 0 / 60%);
		font-size: 0.857rem;
		color: #fff;
	}
	.change:hover {
		background: rgb(0 0 0 / 80%);
	}
	.who {
		position: absolute;
		left: 12px;
		right: 12px;
		bottom: 6px;
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
		display: block;
		width: 100%;
		padding: 0 3px;
		margin: 0 -3px;
		border-bottom: 1px dashed var(--nimble-ui-ring);
		font-size: 1.214rem;
		font-weight: 900;
		line-height: 1.25;
		color: var(--nimble-ui-highlight);
		cursor: text;
	}
	.name-field:focus {
		background: var(--nimble-ui-well);
	}
	.meta {
		position: relative;
		margin-top: 1px;
		font-size: 0.833rem;
		line-height: 1.25;
		color: var(--nimble-ui-ink-muted);
	}
	.editing .meta {
		margin-top: 13px;
	}
	.scroll {
		flex: 1;
		min-height: 0;
		overflow-y: auto;
		display: flex;
		flex-direction: column;
		gap: 10px;
		padding: 8px 12px 12px;
		scrollbar-width: thin;
		scrollbar-color: var(--nimble-ui-ring) transparent;
	}
	.editing .scroll {
		gap: 18px;
		padding-top: 12px;
	}
	.vitals {
		flex-shrink: 0;
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	.editing .vitals {
		gap: 18px;
	}
	.plates {
		display: grid;
		grid-template-columns: 1.6fr 1fr;
		gap: 5px;
	}
	.editing .plates {
		gap: 13px;
	}
	.zone-holder {
		position: relative;
	}
	.stats {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		align-items: center;
		gap: 4px 14px;
	}
	.speeds {
		display: inline-flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 2px 14px;
	}
	.economy {
		flex-shrink: 0;
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	.rests {
		display: flex;
		gap: 5px;
	}
	.secondary {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 6px;
		min-width: 0;
		height: 30px;
		padding: 0 8px;
		border: 1px solid var(--nimble-ui-ring);
		border-radius: 4px;
		font-size: 0.857rem;
		font-weight: 700;
		color: var(--nimble-ui-ink);
		white-space: nowrap;
	}
	.secondary:hover {
		border-color: var(--nimble-ui-highlight);
		background: var(--nimble-ui-hover);
	}
	.secondary:disabled {
		opacity: 0.4;
		filter: saturate(0.35);
		pointer-events: none;
	}
</style>
