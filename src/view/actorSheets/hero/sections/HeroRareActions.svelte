<!--
@component
The bottom of the rail: the actions that you use rarely. The level correction warning sits above Level Up.
Level Up shows in all modes; Revert Last Level Up only in edit mode. The Edit switch is last.
`compact` gives icon buttons for the narrow header.
-->
<script lang="ts">
	import type { HeroRareActionsProps } from '#types/components/actorSheets/HeroRareActions.d.ts';
	import EditSwitch from '../../shared/EditSwitch.svelte';
	import { setEditing } from '../../shared/sheetUiState.ts';

	let { view, ui, perform, compact = false }: HeroRareActionsProps = $props();

	const editing = $derived(ui.editing);
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
			aria-label={compact ? view.levelUp.label : undefined}
			data-tooltip={view.levelUp.tooltip}
			disabled={!view.levelUp.intent}
			onclick={() => view.levelUp.intent && perform(view.levelUp.intent)}
		>
			<i class="fa-solid fa-arrow-up-right-dots"></i>{#if !compact}{view.levelUp.label}{/if}
		</button>
		{#if editing && view.revertLevelUp}
			{@const revert = view.revertLevelUp}
			<button
				type="button"
				class="nimble-u-reset-button icon"
				aria-label={revert.label}
				data-tooltip={revert.label}
				onclick={() => perform(revert.intent)}
			>
				<i class="fa-solid fa-rotate-left"></i>
			</button>
		{/if}
		<EditSwitch
			{editing}
			{compact}
			label={view.edit.label}
			startHint={view.edit.startHint}
			stopHint={view.edit.stopHint}
			onclick={() => setEditing(ui, !ui.editing)}
		/>
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
		font-size: 0.75rem;
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
		font-size: 0.688rem;
		color: var(--nimble-ui-ink);
	}
	.compact .secondary,
	.compact .warning {
		flex: none;
		width: 28px;
		height: 28px;
		padding: 0;
		justify-content: center;
	}
	.secondary:hover,
	.warning:hover,
	.icon:hover {
		border-color: var(--nimble-ui-highlight);
		background: var(--nimble-ui-hover);
	}
	.secondary:disabled {
		opacity: 0.4;
		pointer-events: none;
	}
</style>
