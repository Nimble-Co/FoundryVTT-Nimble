<script lang="ts">
	import type { ReactionPanelProps } from '../../../../types/components/ReactionPanel.d.ts';
	import localize from '../../../utils/localize.js';
	import { createInterposePanelState } from './InterposeReactionPanel.svelte.ts';
	import TargetSelector from './TargetSelector.svelte';

	let {
		actor,
		inCombat = false,
		actionsRemaining = 0,
		onDeductAction = async () => {},
	}: ReactionPanelProps = $props();

	const state = createInterposePanelState(
		() => actor,
		() => onDeductAction,
		() => actionsRemaining,
	);

	const availableTargets = $derived(state.availableTargets);
	const selectedTarget = $derived(state.selectedTarget);
	// Compute disabled state directly from props for proper reactivity
	const isDisabled = $derived(inCombat && actionsRemaining <= 0);
	const canInterposeAndDefend = $derived(!inCombat || actionsRemaining >= 2);
	const { getTargetName, handleInterpose, handleInterposeAndDefend } = state;
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

	<div class="reaction-panel__button-group">
		<button class="reaction-panel__button" disabled={isDisabled} onclick={handleInterpose}>
			<i class="fa-solid fa-people-arrows"></i>
			{localize('NIMBLE.ui.heroicActions.reactions.interpose.confirm')}
		</button>

		<button
			class="reaction-panel__button reaction-panel__button--combined"
			disabled={!canInterposeAndDefend}
			onclick={handleInterposeAndDefend}
		>
			<i class="fa-solid fa-people-arrows"></i>
			<i class="fa-solid fa-shield"></i>
			{localize('NIMBLE.ui.heroicActions.reactions.interposeAndDefend.confirm')}
			<span class="reaction-panel__button-cost">
				({localize('NIMBLE.ui.heroicActions.reactions.interposeAndDefend.cost')})
			</span>
		</button>
	</div>
</section>

<style lang="scss">
	// Interpose-specific colors
	.reaction-panel__icon {
		background: linear-gradient(
			135deg,
			var(--nimble-reaction-interpose-primary) 0%,
			var(--nimble-reaction-interpose-secondary) 100%
		);
	}

	.reaction-panel__badge {
		color: var(--nimble-reaction-interpose-text);
		background: var(--nimble-reaction-interpose-light);
	}

	.reaction-panel__description :global(strong) {
		color: var(--nimble-reaction-interpose-accent);
	}

	.reaction-panel__button-group {
		display: flex;
		flex-direction: column;
		gap: 0.375rem;
	}

	.reaction-panel__button {
		background: linear-gradient(
			135deg,
			var(--nimble-reaction-interpose-primary) 0%,
			var(--nimble-reaction-interpose-secondary) 100%
		);

		&:hover:not(:disabled) {
			filter: brightness(1.1);
		}

		&--combined {
			background: linear-gradient(
				135deg,
				var(--nimble-reaction-interpose-secondary) 0%,
				var(--nimble-reaction-interpose-secondary) 43%,
				var(--nimble-reaction-defend-primary) 57%,
				var(--nimble-reaction-defend-primary) 100%
			);

			&:hover:not(:disabled) {
				filter: brightness(1.1);
			}
		}
	}

	.reaction-panel__button-cost {
		font-size: var(--nimble-xs-text);
		font-weight: 500;
		opacity: 0.9;
	}
</style>
