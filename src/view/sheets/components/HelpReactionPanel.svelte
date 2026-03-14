<script lang="ts">
	import type { ReactionPanelProps } from '../../../../types/components/ReactionPanel.d.ts';
	import localize from '../../../utils/localize.js';
	import { createHelpPanelState } from './HelpReactionPanel.svelte.ts';

	let {
		actor,
		inCombat = false,
		actionsRemaining = 0,
		onDeductAction = async () => {},
	}: ReactionPanelProps = $props();

	const { availableTargets, selectedTarget, isDisabled, getTargetName, handleHelp } =
		createHelpPanelState(
			() => actor,
			() => onDeductAction,
			() => inCombat,
			() => actionsRemaining,
		);
</script>

<section class="reaction-panel">
	<div class="reaction-panel__header">
		<div class="reaction-panel__icon">
			<i class="fa-solid fa-handshake-angle"></i>
		</div>
		<div class="reaction-panel__title-group">
			<h3 class="reaction-panel__title">
				{localize('NIMBLE.ui.heroicActions.reactions.help.title')}
			</h3>
			<span class="reaction-panel__cost">
				<i class="fa-solid fa-bolt"></i>
				{localize('NIMBLE.ui.heroicActions.reactions.cost')}
			</span>
		</div>
		<div class="reaction-panel__badge">
			<i class="fa-solid fa-dice-d20"></i>
			{localize('NIMBLE.ui.heroicActions.reactions.advantage')}
		</div>
	</div>

	<p class="reaction-panel__description">
		{@html localize('NIMBLE.ui.heroicActions.reactions.help.panelDescription')}
	</p>

	<div class="reaction-panel__target-section">
		<span class="reaction-panel__target-label">
			<i class="fa-solid fa-crosshairs"></i>
			{localize('NIMBLE.ui.heroicActions.reactions.help.helping')}
		</span>
		{#if availableTargets.length === 0}
			<div class="reaction-panel__no-target">
				<span>{localize('NIMBLE.ui.heroicActions.reactions.targetAllyOptional')}</span>
			</div>
		{:else if availableTargets.length === 1}
			<div class="reaction-panel__target">
				<img
					class="reaction-panel__target-img"
					src={selectedTarget?.document?.texture?.src || 'icons/svg/mystery-man.svg'}
					alt={getTargetName(selectedTarget)}
				/>
				<span class="reaction-panel__target-name">{getTargetName(selectedTarget)}</span>
				<i class="fa-solid fa-check reaction-panel__target-check"></i>
			</div>
		{:else}
			<div class="reaction-panel__no-target reaction-panel__no-target--warning">
				<i class="fa-solid fa-triangle-exclamation"></i>
				<span>{localize('NIMBLE.ui.heroicActions.reactions.selectOneTarget')}</span>
			</div>
		{/if}
	</div>

	<p class="reaction-panel__tip">
		<i class="fa-solid fa-lightbulb"></i>
		{localize('NIMBLE.ui.heroicActions.reactions.help.tip')}
	</p>

	<button class="reaction-panel__button" disabled={isDisabled} onclick={handleHelp}>
		<i class="fa-solid fa-handshake-angle"></i>
		{localize('NIMBLE.ui.heroicActions.reactions.help.confirm')}
	</button>
</section>

<style lang="scss">
	// Help-specific colors
	.reaction-panel__icon {
		background: linear-gradient(135deg, hsl(145, 55%, 45%) 0%, hsl(145, 55%, 35%) 100%);
	}

	.reaction-panel__badge {
		color: hsl(145, 60%, 25%);
		background: hsl(145, 55%, 90%);
	}

	.reaction-panel__description :global(strong) {
		color: hsl(145, 55%, 35%);
	}

	.reaction-panel__target {
		background: hsl(145, 50%, 95%);
		border-color: hsl(145, 50%, 70%);
	}

	.reaction-panel__target-img {
		border-color: hsl(145, 40%, 60%);
	}

	.reaction-panel__button {
		background: linear-gradient(135deg, hsl(145, 55%, 45%) 0%, hsl(145, 55%, 35%) 100%);

		&:hover:not(:disabled) {
			background: linear-gradient(135deg, hsl(145, 55%, 50%) 0%, hsl(145, 55%, 40%) 100%);
		}
	}

	:global(.theme-dark) .reaction-panel__badge {
		color: hsl(145, 70%, 70%);
		background: hsl(145, 45%, 22%);
	}

	:global(.theme-dark) .reaction-panel__description :global(strong) {
		color: hsl(145, 55%, 60%);
	}

	:global(.theme-dark) .reaction-panel__target {
		background: hsl(145, 40%, 22%);
		border-color: hsl(145, 50%, 45%);
	}
</style>
