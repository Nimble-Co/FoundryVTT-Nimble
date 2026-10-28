<!--
@component
The bottom of the rail: the actions that you use rarely. The level correction warning sits above Level Up.
Level Up shows in all modes; Revert Last Level Up only in edit mode. The Edit switch is last.
`compact` gives icon buttons for the narrow header.
-->
<script lang="ts">
	import type { SheetUiState } from '../../shared/sheetUiState.ts';
	import type { HeroPerform } from '../heroIntent.ts';
	import type { HeroRailView } from '../heroRail.ts';
	import localize from '#utils/localize.js';

	interface Props {
		view: HeroRailView;
		ui: SheetUiState;
		perform: HeroPerform;
		compact?: boolean;
	}

	let { view, ui, perform, compact = false }: Props = $props();

	const R = 'NIMBLE.actorSheet.hero.rail';
	const editing = $derived(ui.editing);
	const levelUpLabel = $derived(localize('NIMBLE.prompts.levelUp'));
	const revertLabel = $derived(localize(`${R}.revertLevelUp`));
	const editLabel = $derived(localize(`${R}.${editing ? 'stopEditing' : 'editHint'}`));
</script>

<div class="rare" class:compact>
	{#if view.levelCorrection}
		{@const correction = view.levelCorrection}
		<button
			type="button"
			class="nimble-u-reset-button warning"
			aria-label={compact ? correction.tooltip : undefined}
			data-tooltip={correction.tooltip}
			onclick={() => perform(correction.intent)}
		>
			<i class="fa-solid fa-triangle-exclamation"></i>{#if !compact}{correction.label}{/if}
		</button>
	{/if}
	<div class="row">
		<button
			type="button"
			class="nimble-u-reset-button secondary"
			aria-label={compact ? levelUpLabel : undefined}
			data-tooltip={view.levelUp.tooltip}
			disabled={!view.levelUp.intent}
			onclick={() => view.levelUp.intent && perform(view.levelUp.intent)}
		>
			<i class="fa-solid fa-arrow-up-right-dots"></i>{#if !compact}{levelUpLabel}{/if}
		</button>
		{#if editing && view.revertLevelUp}
			{@const revert = view.revertLevelUp}
			<button
				type="button"
				class="nimble-u-reset-button icon"
				aria-label={revertLabel}
				data-tooltip={revertLabel}
				onclick={() => perform(revert)}
			>
				<i class="fa-solid fa-rotate-left"></i>
			</button>
		{/if}
		<button
			type="button"
			class="nimble-u-reset-button edit"
			aria-pressed={editing}
			aria-label={compact ? editLabel : undefined}
			data-tooltip={editLabel}
			onclick={() => {
				ui.editing = !ui.editing;
				ui.confirm = null;
			}}
		>
			{#if compact}<i class="fa-solid fa-pen"></i>{:else}<span class="track"></span>{localize(
					`${R}.edit`,
				)}{/if}
		</button>
	</div>
</div>

<style>
	.rare {
		flex-shrink: 0;
		margin-top: auto;
		display: flex;
		flex-direction: column;
		gap: 6px;
		padding-top: 9px;
		border-top: 1px solid var(--nimble-ui-soft);
	}
	.rare.compact {
		margin: 0;
		padding: 0;
		border: none;
		flex-direction: row;
	}
	.row {
		display: flex;
		gap: 5px;
	}
	.secondary,
	.warning {
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
	.warning {
		border-color: var(--nimble-ui-warn);
		color: var(--nimble-ui-warn);
		white-space: normal;
		text-align: left;
	}
	.icon {
		display: grid;
		place-items: center;
		flex: none;
		width: 30px;
		height: 30px;
		border: 1px solid var(--nimble-ui-ring);
		border-radius: 4px;
		font-size: 0.786rem;
		color: var(--nimble-ui-ink);
	}
	.compact .secondary,
	.compact .warning,
	.compact .edit {
		flex: none;
		width: 28px;
		height: 28px;
		padding: 0;
		justify-content: center;
	}
	.secondary:hover,
	.warning:hover,
	.icon:hover,
	.edit:hover {
		border-color: var(--nimble-ui-highlight);
		background: var(--nimble-ui-hover);
	}
	.secondary:disabled {
		opacity: 0.4;
		pointer-events: none;
	}
	.edit {
		flex: none;
		display: flex;
		align-items: center;
		gap: 7px;
		height: 30px;
		padding: 0 10px 0 8px;
		border: 1px solid var(--nimble-ui-ring);
		border-radius: 4px;
		font-size: 0.857rem;
		font-weight: 700;
		color: var(--nimble-ui-ink);
	}
	.edit[aria-pressed='true'] {
		border-color: var(--nimble-crimson);
		background: var(--nimble-ui-own-background);
	}
	.compact .edit[aria-pressed='true'] {
		background: var(--nimble-crimson);
		color: #fff;
	}
	.track {
		position: relative;
		flex: none;
		width: 26px;
		height: 14px;
		border-radius: 7px;
		background: var(--nimble-ui-well);
		box-shadow: inset 0 0 0 1px var(--nimble-ui-ring);
	}
	.track::after {
		content: '';
		position: absolute;
		top: 2px;
		left: 2px;
		width: 10px;
		height: 10px;
		border-radius: 50%;
		background: var(--nimble-ui-ink-dim);
		transition:
			transform 0.16s cubic-bezier(0.2, 0.8, 0.2, 1),
			background 0.16s;
	}
	.edit[aria-pressed='true'] .track {
		background: var(--nimble-crimson);
		box-shadow: none;
	}
	.edit[aria-pressed='true'] .track::after {
		transform: translateX(12px);
		background: #fff;
	}
</style>
