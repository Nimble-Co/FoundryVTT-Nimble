<!--
@component
The header of the narrow character sheet (below 560 px): who the hero is, the vital numbers, the rests and the rare actions
as icons, armor and speed, Initiative and the turn. It stays dark in both themes.
-->
<script lang="ts">
	import type { HeroHeaderProps } from '#types/components/actorSheets/HeroHeader.d.ts';
	import EditZone from '../../parts/EditZone.svelte';
	import HeroHitPoints from './HeroHitPoints.svelte';
	import HeroInitiative from './HeroInitiative.svelte';
	import HeroPortrait from './HeroPortrait.svelte';
	import HeroRareActions from './HeroRareActions.svelte';
	import HeroStats from './HeroStats.svelte';
	import HeroTurnBox from './HeroTurnBox.svelte';

	let { view, ui, perform }: HeroHeaderProps = $props();

	const editing = $derived(ui.editing);
</script>

<header class="nimble-chrome header" class:editing aria-label={view.text.label}>
	<HeroPortrait {view} form="header" />
	<div class="fade"></div>
	<div class="column">
		<div class="who">
			{#if editing}
				<button
					type="button"
					class="nimble-u-reset-button icon"
					aria-label={view.text.changePortrait}
					data-tooltip={view.text.changePortrait}
					onclick={(event) => perform({ kind: 'changePortrait', skipTokenizer: event.shiftKey })}
				>
					<i class="fa-solid fa-image"></i>
				</button>
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
			<span class="meta">
				<span>{view.meta}</span>
				{#if editing}
					<EditZone
						inline
						short={view.text.metaShort}
						label={view.text.metaLabel}
						onclick={() => perform({ kind: 'configure', target: 'metadata' })}
					/>
				{/if}
			</span>
		</div>
		<div class="plates">
			<HeroHitPoints {view} {editing} {perform} compact />
			<span class="buttons">
				{#if view.rests}
					{#each view.rests as rest (rest.label)}
						<button
							type="button"
							class="nimble-u-reset-button icon"
							aria-label={rest.label}
							data-tooltip={rest.label}
							disabled={editing}
							onclick={() => perform(rest.intent)}
						>
							<i class={rest.icon}></i>
						</button>
					{/each}
				{/if}
				<HeroRareActions {view} {ui} {perform} compact />
			</span>
		</div>
		<HeroStats {view} {editing} {perform} />
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
</style>
