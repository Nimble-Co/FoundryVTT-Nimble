<!--
@component
The rail of the wide character sheet: who the hero is, the vital numbers, Initiative, the rests or the turn,
the tracks and pools, and at the bottom the rare actions (Level Up, the level correction warning) and the Edit switch.
The rail stays dark in both themes.
-->
<script lang="ts">
	import type { HeroRailProps } from '#types/components/actorSheets/HeroRail.d.ts';
	import EditZone from '../../parts/EditZone.svelte';
	import SheetPortrait from '../../shared/SheetPortrait.svelte';
	import HeroHitPoints from './HeroHitPoints.svelte';
	import HeroInitiative from './HeroInitiative.svelte';
	import HeroInspirationSeal from './HeroInspirationSeal.svelte';
	import HeroMeter from './HeroMeter.svelte';
	import HeroRareActions from './HeroRareActions.svelte';
	import HeroStats from './HeroStats.svelte';
	import HeroTurnBox from './HeroTurnBox.svelte';

	let { view, ui, perform }: HeroRailProps = $props();

	const editing = $derived(ui.editing);
</script>

<aside class="nimble-chrome rail" class:editing aria-label={view.text.label}>
	<div class="portrait">
		<SheetPortrait {view} form="rail" />
		<div class="fade"></div>
		<HeroInspirationSeal inspiration={view.inspiration} {perform} />
		{#if editing}
			<button
				type="button"
				class="nimble-u-reset-button change"
				aria-label={view.text.changePortrait}
				data-tooltip={view.text.changePortrait}
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
					aria-label={view.text.name}
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
						short={view.text.metaShort}
						label={view.text.metaLabel}
						onclick={() => perform({ kind: 'configure', target: 'metadata' })}
					/>
				{/if}
			</div>
		</div>
	</div>

	<div class="scroll">
		<div class="vitals">
			<HeroHitPoints {view} {editing} {perform} />
			<HeroStats {view} {editing} {perform} centered />
		</div>

		<div class="economy">
			<HeroInitiative initiative={view.initiative} {editing} {perform} />
			{#if view.rests}
				<div class="rests">
					{#each view.rests as rest (rest.label)}
						<button
							type="button"
							class="nimble-u-reset-button secondary"
							disabled={editing}
							onclick={() => perform(rest.intent)}
						>
							<i class={rest.icon}></i>{rest.label}
						</button>
					{/each}
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
		background: var(--nimble-ui-scrim);
		font-size: 0.857rem;
		color: var(--nimble-ui-fill-ink);
	}
	.change:hover {
		background: var(--nimble-ui-scrim-strong);
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
