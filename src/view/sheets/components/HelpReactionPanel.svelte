<script lang="ts">
	import type { ReactionPanelProps } from '../../../../types/components/ReactionPanel.d.ts';
	import localize from '../../../utils/localize.js';
	import { createHelpPanelState } from './HelpReactionPanel.svelte.ts';
	import TargetSelector from './TargetSelector.svelte';

	let {
		actor,
		inCombat = false,
		actionsRemaining = 0,
		onDeductAction = async () => {},
	}: ReactionPanelProps = $props();

	const state = createHelpPanelState(
		() => actor,
		() => onDeductAction,
		() => inCombat,
		() => actionsRemaining,
	);

	const availableTargets = $derived(state.availableTargets);
	const selectedTarget = $derived(state.selectedTarget);
	const isDisabled = $derived(state.isDisabled);
	const { getTargetName, handleHelp } = state;
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

	<TargetSelector
		label="NIMBLE.ui.heroicActions.reactions.help.helping"
		noTargetMessage="NIMBLE.ui.heroicActions.reactions.targetAllyOptional"
		multipleTargetsMessage="NIMBLE.ui.heroicActions.reactions.selectOneTarget"
		{availableTargets}
		{selectedTarget}
		{getTargetName}
		targetBackground="var(--nimble-reaction-help-light)"
		targetBorderColor="var(--nimble-reaction-help-accent)"
	/>

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
		background: linear-gradient(
			135deg,
			var(--nimble-reaction-help-primary) 0%,
			var(--nimble-reaction-help-secondary) 100%
		);
	}

	.reaction-panel__badge {
		color: var(--nimble-reaction-help-text);
		background: var(--nimble-reaction-help-light);
	}

	.reaction-panel__description :global(strong) {
		color: var(--nimble-reaction-help-accent);
	}

	.reaction-panel__button {
		background: linear-gradient(
			135deg,
			var(--nimble-reaction-help-primary) 0%,
			var(--nimble-reaction-help-secondary) 100%
		);

		&:hover:not(:disabled) {
			filter: brightness(1.1);
		}
	}
</style>
