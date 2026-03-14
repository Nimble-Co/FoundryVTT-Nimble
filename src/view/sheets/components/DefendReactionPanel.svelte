<script lang="ts">
	import type { ReactionPanelProps } from '../../../../types/components/ReactionPanel.d.ts';
	import localize from '../../../utils/localize.js';
	import { createDefendPanelState } from './DefendReactionPanel.svelte.ts';

	let {
		actor,
		inCombat = false,
		actionsRemaining = 0,
		onDeductAction = async () => {},
	}: ReactionPanelProps = $props();

	const state = createDefendPanelState(
		() => actor,
		() => onDeductAction,
		() => inCombat,
		() => actionsRemaining,
	);

	const availableTargets = $derived(state.availableTargets);
	const selectedTarget = $derived(state.selectedTarget);
	const armorValue = $derived(state.armorValue);
	const isDisabled = $derived(state.isDisabled);
	const canInterposeAndDefend = $derived(state.canInterposeAndDefend);
	const { getTargetName, handleDefend, handleInterposeAndDefend } = state;
</script>

<section class="reaction-panel">
	<div class="reaction-panel__header">
		<div class="reaction-panel__icon">
			<i class="fa-solid fa-shield"></i>
		</div>
		<div class="reaction-panel__title-group">
			<h3 class="reaction-panel__title">
				{localize('NIMBLE.ui.heroicActions.reactions.defend.title')}
			</h3>
			<span class="reaction-panel__cost">
				<i class="fa-solid fa-bolt"></i>
				{localize('NIMBLE.ui.heroicActions.reactions.cost')}
			</span>
		</div>
		<div class="reaction-panel__badge">
			<i class="fa-solid fa-shield"></i>
			{localize('NIMBLE.ui.heroicActions.reactions.defend.armorBadge', { armor: armorValue })}
		</div>
	</div>

	<p class="reaction-panel__description">
		{@html localize('NIMBLE.ui.heroicActions.reactions.defend.panelDescription', {
			armor: armorValue,
		})}
	</p>

	<button class="reaction-panel__button" disabled={isDisabled} onclick={handleDefend}>
		<i class="fa-solid fa-shield"></i>
		{localize('NIMBLE.ui.heroicActions.reactions.defend.confirm')}
	</button>

	<div class="reaction-panel__divider"></div>

	<div class="reaction-panel__combined-section">
		<div class="reaction-panel__combined-header">
			<span class="reaction-panel__combined-cost">
				<i class="fa-solid fa-bolt"></i>
				<i class="fa-solid fa-bolt"></i>
				{localize('NIMBLE.ui.heroicActions.reactions.interposeAndDefend.cost')}
			</span>
		</div>

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

		<button
			class="reaction-panel__button reaction-panel__button--combined"
			disabled={!canInterposeAndDefend}
			onclick={handleInterposeAndDefend}
		>
			<i class="fa-solid fa-shield"></i>
			<i class="fa-solid fa-people-arrows"></i>
			{localize('NIMBLE.ui.heroicActions.reactions.interposeAndDefend.confirm')}
		</button>
	</div>
</section>

<style lang="scss">
	// Defend-specific colors
	.reaction-panel__icon {
		background: linear-gradient(135deg, hsl(210, 60%, 50%) 0%, hsl(210, 60%, 40%) 100%);
	}

	.reaction-panel__badge {
		color: hsl(210, 70%, 30%);
		background: hsl(210, 60%, 92%);
	}

	.reaction-panel__description :global(strong) {
		color: hsl(210, 60%, 45%);
	}

	.reaction-panel__button {
		background: linear-gradient(135deg, hsl(210, 60%, 50%) 0%, hsl(210, 60%, 40%) 100%);

		&:hover:not(:disabled) {
			background: linear-gradient(135deg, hsl(210, 60%, 55%) 0%, hsl(210, 60%, 45%) 100%);
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

	.reaction-panel__divider {
		height: 1px;
		background: var(--nimble-card-border-color);
		margin: 0.25rem 0;
	}

	.reaction-panel__combined-section {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.reaction-panel__combined-header {
		display: flex;
		align-items: center;
	}

	.reaction-panel__combined-cost {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		font-size: var(--nimble-xs-text);
		font-weight: 600;
		color: var(--nimble-medium-text-color);

		i {
			font-size: 0.625rem;
		}
	}

	.reaction-panel__target {
		background: hsl(270, 50%, 95%);
		border-color: hsl(270, 50%, 70%);
	}

	.reaction-panel__target-img {
		border-color: hsl(270, 40%, 60%);
	}

	:global(.theme-dark) .reaction-panel__target {
		background: hsl(270, 40%, 22%);
		border-color: hsl(270, 50%, 45%);
	}

	:global(.theme-dark) .reaction-panel__badge {
		color: hsl(210, 80%, 75%);
		background: hsl(210, 50%, 25%);
	}

	:global(.theme-dark) .reaction-panel__description :global(strong) {
		color: hsl(210, 70%, 65%);
	}
</style>
