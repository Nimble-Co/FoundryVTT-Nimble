<script lang="ts">
	import type { ReactionPanelProps } from '../../../../types/components/ReactionPanel.d.ts';
	import localize from '../../../utils/localize.js';
	import { createDefendPanelState } from './DefendReactionPanel.svelte.ts';
	import TargetSelector from './TargetSelector.svelte';

	let {
		actor,
		reactionDisabled = true,
		combinedReactionDisabled = true,
		defendSpent = false,
		interposeSpent = false,
		noActions = false,
		onUseReaction = async () => false,
		onUseCombinedReaction = async () => false,
	}: ReactionPanelProps = $props();

	const state = createDefendPanelState(
		() => actor,
		() => reactionDisabled,
		() => defendSpent,
		() => interposeSpent,
		() => noActions,
		() => onUseReaction,
		() => combinedReactionDisabled,
		() => onUseCombinedReaction,
	);

	const availableTargets = $derived(state.availableTargets);
	const selectedTarget = $derived(state.selectedTarget);
	const armorValue = $derived(state.armorValue);
	const { getTargetName, handleDefend, handleInterposeAndDefend } = state;

	function handleDefendDragStart(event: DragEvent) {
		if (!event.dataTransfer) return;
		const dragData = {
			type: 'HeroicAction',
			actionId: 'defend',
			actionType: 'reaction',
			name: localize('NIMBLE.ui.heroicActions.reactions.defend.label'),
		};
		event.dataTransfer.setData('text/plain', JSON.stringify(dragData));
	}

	function handleInterposeAndDefendDragStart(event: DragEvent) {
		if (!event.dataTransfer) return;
		const dragData = {
			type: 'HeroicAction',
			actionId: 'interposeAndDefend',
			actionType: 'reaction',
			name: localize('NIMBLE.ui.heroicActions.reactions.interposeAndDefend.confirm'),
		};
		event.dataTransfer.setData('text/plain', JSON.stringify(dragData));
	}
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

	<button
		class="reaction-panel__button"
		draggable="true"
		ondragstart={handleDefendDragStart}
		onclick={handleDefend}
	>
		<i class="fa-solid fa-shield"></i>
		{localize('NIMBLE.ui.heroicActions.reactions.defend.confirm')}
	</button>

	<div class="reaction-panel__combined-section">
		<button
			class="reaction-panel__button reaction-panel__button--combined"
			draggable="true"
			ondragstart={handleInterposeAndDefendDragStart}
			onclick={handleInterposeAndDefend}
		>
			<i class="fa-solid fa-people-arrows"></i>
			<i class="fa-solid fa-shield"></i>
			{localize('NIMBLE.ui.heroicActions.reactions.interposeAndDefend.confirm')}
			<span class="reaction-panel__button-cost">
				({localize('NIMBLE.ui.heroicActions.reactions.interposeAndDefend.cost')})
			</span>
		</button>

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

	.reaction-panel__combined-section {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.reaction-panel__button-cost {
		font-size: var(--nimble-xs-text);
		font-weight: 500;
		opacity: 0.9;
	}
</style>
