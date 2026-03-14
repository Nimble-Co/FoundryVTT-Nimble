<script lang="ts">
	import type { ReactionPanelProps } from '../../../../types/components/ReactionPanel.d.ts';
	import localize from '../../../utils/localize.js';
	import { createDefendPanelState } from './DefendReactionPanel.svelte.ts';
	import TargetSelector from './TargetSelector.svelte';

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

		<TargetSelector
			label="NIMBLE.ui.heroicActions.reactions.interpose.protecting"
			noTargetMessage="NIMBLE.ui.heroicActions.reactions.targetAlly"
			multipleTargetsMessage="NIMBLE.ui.heroicActions.reactions.selectOneTarget"
			{availableTargets}
			{selectedTarget}
			{getTargetName}
			targetBackground="var(--nimble-reaction-interpose-light)"
			targetBorderColor="var(--nimble-reaction-interpose-accent)"
		/>

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
		background: linear-gradient(
			135deg,
			var(--nimble-reaction-defend-primary) 0%,
			var(--nimble-reaction-defend-secondary) 100%
		);
	}

	.reaction-panel__badge {
		color: var(--nimble-reaction-defend-text);
		background: var(--nimble-reaction-defend-light);
	}

	.reaction-panel__description :global(strong) {
		color: var(--nimble-reaction-defend-accent);
	}

	.reaction-panel__button {
		background: linear-gradient(
			135deg,
			var(--nimble-reaction-defend-primary) 0%,
			var(--nimble-reaction-defend-secondary) 100%
		);

		&:hover:not(:disabled) {
			filter: brightness(1.1);
		}

		&--combined {
			background: linear-gradient(
				135deg,
				var(--nimble-reaction-defend-primary) 0%,
				var(--nimble-reaction-interpose-secondary) 50%,
				var(--nimble-reaction-interpose-secondary) 100%
			);

			&:hover:not(:disabled) {
				filter: brightness(1.1);
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
</style>
