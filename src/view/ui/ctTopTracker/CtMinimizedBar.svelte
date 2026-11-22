<script lang="ts">
	import type { CtMinimizedBarProps } from '#types/components/ui/CtMinimizedBar.d.ts';
	import localize from '#utils/localize.js';
	import { getPortraitFallbackForCombatant } from './resources.utils.js';

	let {
		summary,
		controls,
		endTurnReady,
		iconButton,
		onControl,
		onEndTurn,
		onExpand,
		onPortraitError,
	}: CtMinimizedBarProps = $props();
</script>

<div class="nimble-ct__minimized faded-ui">
	{#if controls.showTurnArrows}
		{@render iconButton(
			'NIMBLE.combatControls.previousTurn',
			'fa-chevron-left',
			'DOWN',
			(event) => onControl(event, 'previous-turn'),
			false,
		)}
	{/if}
	<span
		class="nimble-ct__minimized-round"
		data-tooltip={summary.combatStarted
			? localize('NIMBLE.combatControls.currentRound')
			: undefined}
		data-tooltip-direction="DOWN"
		>{summary.combatStarted
			? localize('NIMBLE.combatControls.roundBadge', {
					round: String(summary.round),
				})
			: ''}</span
	>
	<span class="nimble-ct__minimized-portrait-slot">
		{#if summary.portraitSrc}
			<img
				class="nimble-ct__minimized-portrait"
				src={summary.portraitSrc}
				alt=""
				draggable="false"
				data-portrait-fallback={getPortraitFallbackForCombatant()}
				onerror={onPortraitError}
			/>
		{/if}
	</span>
	{#if summary.combatantName}
		<span
			class="nimble-ct__minimized-name"
			data-tooltip={summary.combatantName}
			data-tooltip-direction="DOWN">{summary.combatantName}</span
		>
	{:else}
		<span class="nimble-ct__minimized-name nimble-ct__minimized-name--idle"
			>{localize(
				summary.combatStarted
					? 'NIMBLE.combatControls.noActiveCombatant'
					: 'NIMBLE.combatControls.combatNotStarted',
			)}</span
		>
	{/if}
	<span class="nimble-ct__minimized-actions-slot">
		{#if summary.actions}
			<span
				class="nimble-ct__minimized-actions"
				data-tooltip={localize('NIMBLE.combatControls.availableActions', {
					current: String(summary.actions.current),
					max: String(summary.actions.max),
				})}
				data-tooltip-direction="DOWN">{summary.actions.current}/{summary.actions.max}</span
			>
		{/if}
	</span>
	<span class="nimble-ct__minimized-turn-slot">
		{#if controls.showStartCombat}
			{@render iconButton(
				'NIMBLE.combatControls.startCombat',
				'fa-play',
				'DOWN',
				(event) => onControl(event, 'start-combat'),
				false,
			)}
		{:else if controls.showEndTurn}
			{@render iconButton(
				'NIMBLE.ui.heroicActions.endTurn',
				'fa-hourglass-end',
				'DOWN',
				onEndTurn,
				endTurnReady,
			)}
		{/if}
	</span>
	{#if controls.showTurnArrows}
		{@render iconButton(
			'NIMBLE.combatControls.nextTurn',
			'fa-chevron-right',
			'DOWN',
			(event) => onControl(event, 'next-turn'),
			false,
		)}
	{/if}
	{@render iconButton(
		'NIMBLE.combatControls.expandTracker',
		'fa-chevron-down',
		'DOWN',
		() => onExpand(),
		false,
	)}
</div>

<style lang="scss">
	.nimble-ct__minimized {
		pointer-events: auto;
		display: flex;
		align-items: center;
		gap: 0.4rem;
		max-width: min(32rem, 90vw);
		padding: 0.22rem 0.5rem;
		border: 1px solid var(--nimble-ct-chrome-border);
		border-top: 0;
		border-radius: 0 0 0.35rem 0.35rem;
		background: var(--nimble-ct-chrome-bg);
		opacity: var(--ui-fade-opacity, 1);
		transition: opacity var(--ui-fade-delay, 0s) var(--ui-fade-duration, 100ms);
	}
	.nimble-ct__minimized:hover,
	.nimble-ct__minimized:focus-within {
		opacity: 1;
		transition: opacity var(--ui-fade-duration, 100ms);
	}
	.nimble-ct__minimized-round {
		flex: none;
		width: 4.6rem;
		font-size: 0.78rem;
		font-weight: 700;
		font-variant-numeric: tabular-nums;
		text-align: center;
		color: var(--nimble-ct-chrome-accent);
	}
	.nimble-ct__minimized-portrait-slot,
	.nimble-ct__minimized-actions-slot,
	.nimble-ct__minimized-turn-slot {
		flex: none;
		display: flex;
		align-items: center;
		justify-content: center;
	}
	.nimble-ct__minimized-portrait-slot {
		width: 1.55rem;
	}
	.nimble-ct__minimized-actions-slot,
	.nimble-ct__minimized-turn-slot {
		width: 2.75rem;
	}
	.nimble-ct__minimized-actions-slot .nimble-ct__minimized-actions {
		width: 100%;
	}
	.nimble-ct__minimized-portrait {
		flex: none;
		width: 1.55rem;
		height: 1.55rem;
		border: 1px solid var(--nimble-ct-chrome-border);
		border-radius: 50%;
		object-fit: cover;
	}
	/* Fixed width, not content width: the strip is centre-anchored, so a longer name would
	   slide the turn arrows out from under the pointer. */
	.nimble-ct__minimized-name {
		flex: none;
		width: 11rem;
		overflow: hidden;
		font-size: 0.8rem;
		color: var(--nimble-ct-chrome-color);
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.nimble-ct__minimized-name--idle {
		color: color-mix(in srgb, var(--nimble-ct-chrome-color) 62%, transparent);
		font-style: italic;
	}
	.nimble-ct__minimized-actions {
		flex: none;
		min-width: 2.75rem;
		padding: 0.05rem 0.3rem;
		font-size: 0.78rem;
		font-weight: 700;
		font-variant-numeric: tabular-nums;
		text-align: center;
		color: var(--nimble-ct-action-color-resolved);
		background: var(--nimble-ct-action-box-bg);
		border: 1px solid var(--nimble-ct-action-box-border);
		border-radius: 0.2rem;
		text-shadow: var(--nimble-ct-action-text-shadow);
	}
	:global(.theme-light) .nimble-ct__minimized-round {
		color: var(--nimble-ct-chrome-color);
	}
</style>
