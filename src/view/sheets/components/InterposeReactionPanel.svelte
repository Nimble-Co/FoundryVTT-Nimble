<script lang="ts">
	import type { ReactionPanelProps } from '../../../../types/components/ReactionPanel.d.ts';
	import localize from '../../../utils/localize.js';
	import { createInterposePanelState } from './InterposeReactionPanel.svelte.ts';

	let {
		actor,
		inCombat = false,
		actionsRemaining = 0,
		onDeductAction = async () => {},
	}: ReactionPanelProps = $props();

	const {
		availableTargets,
		selectedTarget,
		isDisabled,
		canDefendAndInterpose,
		getTargetName,
		handleInterpose,
		handleDefendAndInterpose,
	} = createInterposePanelState(
		() => actor,
		() => onDeductAction,
		() => inCombat,
		() => actionsRemaining,
	);
</script>

<section class="reaction-panel">
	<div class="reaction-panel__header">
		<div class="reaction-panel__icon">
			<i class="fa-solid fa-people-arrows"></i>
		</div>
		<div class="reaction-panel__title-group">
			<h3 class="reaction-panel__title">
				{localize('NIMBLE.ui.heroicActions.reactions.interpose.title')}
			</h3>
			<span class="reaction-panel__cost">
				<i class="fa-solid fa-bolt"></i>
				{localize('NIMBLE.ui.heroicActions.reactions.cost')}
			</span>
		</div>
		<div class="reaction-panel__badge">
			<i class="fa-solid fa-ruler"></i>
			{localize('NIMBLE.ui.heroicActions.reactions.interpose.rangeBadge')}
		</div>
	</div>

	<p class="reaction-panel__description">
		{@html localize('NIMBLE.ui.heroicActions.reactions.interpose.panelDescription')}
	</p>

	<div class="reaction-panel__target-section">
		<span class="reaction-panel__target-label">
			<i class="fa-solid fa-crosshairs"></i>
			{localize('NIMBLE.ui.heroicActions.reactions.interpose.protecting')}
		</span>
		{#if availableTargets.length === 0}
			<div class="reaction-panel__no-target">
				<span>{localize('NIMBLE.ui.heroicActions.reactions.targetAlly')}</span>
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

	<div class="reaction-panel__button-group">
		<button class="reaction-panel__button" disabled={isDisabled} onclick={handleInterpose}>
			<i class="fa-solid fa-people-arrows"></i>
			{localize('NIMBLE.ui.heroicActions.reactions.interpose.confirm')}
		</button>

		<button
			class="reaction-panel__button reaction-panel__button--combined"
			disabled={!canDefendAndInterpose}
			onclick={handleDefendAndInterpose}
		>
			<i class="fa-solid fa-shield"></i>
			<i class="fa-solid fa-people-arrows"></i>
			{localize('NIMBLE.ui.heroicActions.reactions.defendAndInterpose.confirm')}
			<span class="reaction-panel__button-cost">
				({localize('NIMBLE.ui.heroicActions.reactions.defendAndInterpose.cost')})
			</span>
		</button>
	</div>
</section>

<style lang="scss">
	// Interpose-specific colors
	.reaction-panel__icon {
		background: linear-gradient(135deg, hsl(270, 50%, 55%) 0%, hsl(270, 50%, 45%) 100%);
	}

	.reaction-panel__badge {
		color: hsl(270, 60%, 30%);
		background: hsl(270, 50%, 92%);
	}

	.reaction-panel__description :global(strong) {
		color: hsl(270, 50%, 40%);
	}

	.reaction-panel__target {
		background: hsl(270, 50%, 95%);
		border-color: hsl(270, 50%, 70%);
	}

	.reaction-panel__target-img {
		border-color: hsl(270, 40%, 60%);
	}

	.reaction-panel__button-group {
		display: flex;
		flex-direction: column;
		gap: 0.375rem;
	}

	.reaction-panel__button {
		background: linear-gradient(135deg, hsl(270, 50%, 55%) 0%, hsl(270, 50%, 45%) 100%);

		&:hover:not(:disabled) {
			background: linear-gradient(135deg, hsl(270, 50%, 60%) 0%, hsl(270, 50%, 50%) 100%);
		}

		&--combined {
			background: linear-gradient(
				135deg,
				hsl(210, 60%, 50%) 0%,
				hsl(270, 50%, 50%) 50%,
				hsl(270, 50%, 45%) 100%
			);

			&:hover:not(:disabled) {
				background: linear-gradient(
					135deg,
					hsl(210, 60%, 55%) 0%,
					hsl(270, 50%, 55%) 50%,
					hsl(270, 50%, 50%) 100%
				);
			}
		}
	}

	.reaction-panel__button-cost {
		font-size: var(--nimble-xs-text);
		font-weight: 500;
		opacity: 0.9;
	}

	:global(.theme-dark) .reaction-panel__badge {
		color: hsl(270, 70%, 75%);
		background: hsl(270, 40%, 25%);
	}

	:global(.theme-dark) .reaction-panel__description :global(strong) {
		color: hsl(270, 60%, 70%);
	}

	:global(.theme-dark) .reaction-panel__target {
		background: hsl(270, 40%, 22%);
		border-color: hsl(270, 50%, 45%);
	}
</style>
