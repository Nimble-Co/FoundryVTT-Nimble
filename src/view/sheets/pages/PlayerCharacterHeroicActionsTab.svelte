<script lang="ts">
	import { getContext, untrack } from 'svelte';
	import localize from '../../../utils/localize.js';
	import { createHeroicActionsTabState } from './PlayerCharacterHeroicActionsTab.svelte.js';

	import AssessActionPanel from '../components/AssessActionPanel.svelte';
	import AttackActionPanel from '../components/AttackActionPanel.svelte';
	import CastSpellActionPanel from '../components/CastSpellActionPanel.svelte';
	import MoveActionPanel from '../components/MoveActionPanel.svelte';

	import DefendReactionPanel from '../components/DefendReactionPanel.svelte';
	import InterposeReactionPanel from '../components/InterposeReactionPanel.svelte';
	import OpportunityAttackPanel from '../components/OpportunityAttackPanel.svelte';
	import HelpReactionPanel from '../components/HelpReactionPanel.svelte';

	// ============================================================================
	// Context & State
	// ============================================================================

	interface HeroicActionTarget {
		actionId: string;
		actionType: 'action' | 'reaction';
		force?: boolean;
	}

	interface SheetState {
		heroicActionTarget?: HeroicActionTarget | null;
	}

	let actor = getContext('actor');
	const sheetState = getContext<SheetState>('sheetState');
	const heroicState = createHeroicActionsTabState(() => actor);
	let forceNextOpportunityReactionUse = $state(false);

	// React to heroicActionTarget from macro activation
	$effect(() => {
		const target = sheetState?.heroicActionTarget;
		if (!target) return;

		if (target.actionType === 'action') {
			heroicState.activeHeroicTab = 'actions';
			heroicState.expandedPanel = target.actionId;
		} else if (target.actionType === 'reaction') {
			heroicState.activeHeroicTab = 'reactions';
			// Handle interposeAndDefend combo by navigating to defend panel
			const panelId = target.actionId === 'interposeAndDefend' ? 'defend' : target.actionId;
			heroicState.expandedReactionPanel = panelId;
			forceNextOpportunityReactionUse = target.actionId === 'opportunity' && target.force === true;
		}

		// Clear the target after handling
		untrack(() => {
			if (sheetState) {
				sheetState.heroicActionTarget = null;
			}
		});
	});

	function handleActionDragStart(
		event: DragEvent,
		actionId: string,
		actionType: 'action' | 'reaction',
		labelKey: string,
	) {
		if (!event.dataTransfer) return;
		const dragData = {
			type: 'HeroicAction',
			actionId,
			actionType,
			name: localize(labelKey),
		};
		event.dataTransfer.setData('text/plain', JSON.stringify(dragData));
	}
</script>

<section class="nimble-sheet__body nimble-sheet__body--player-character">
	<section>
		<header class="heroic-tab-header">
			<div class="heroic-tab-header__tabs">
				<button
					class="heroic-tab-header__tab"
					class:heroic-tab-header__tab--active={heroicState.activeHeroicTab === 'actions'}
					type="button"
					onclick={() => (heroicState.activeHeroicTab = 'actions')}
				>
					{localize('NIMBLE.ui.heroicActions.title')}
				</button>
				<button
					class="heroic-tab-header__tab"
					class:heroic-tab-header__tab--active={heroicState.activeHeroicTab === 'reactions'}
					type="button"
					onclick={() => (heroicState.activeHeroicTab = 'reactions')}
				>
					{localize('NIMBLE.ui.heroicActions.reactionsTitle')}
				</button>
			</div>

			<button
				class="nimble-button heroic-actions__help-button"
				data-button-variant="icon"
				type="button"
				aria-label={localize('NIMBLE.ui.heroicActions.help.tooltip')}
				data-tooltip={localize('NIMBLE.ui.heroicActions.help.tooltip')}
				onclick={heroicState.handleHelpDialog}
			>
				<i class="fa-solid fa-circle-question"></i>
			</button>
		</header>

		{#if heroicState.activeHeroicTab === 'actions'}
			<div class="heroic-actions-tabs">
				{#each heroicState.HEROIC_ACTIONS as action (action.id)}
					<button
						class="heroic-action-tab"
						class:heroic-action-tab--active={heroicState.expandedPanel === action.id}
						class:heroic-action-tab--disabled={heroicState.isActionDisabled(action)}
						type="button"
						aria-label={localize(action.labelKey)}
						data-tooltip={heroicState.getActionTooltip(action)}
						disabled={heroicState.isActionDisabled(action)}
						draggable="true"
						ondragstart={(event) =>
							handleActionDragStart(event, action.id, 'action', action.labelKey)}
						onclick={() => heroicState.handleActionClick(action)}
					>
						<i class={action.icon}></i>
						<span class="heroic-action-tab__indicator"></span>
					</button>
				{/each}
			</div>
		{/if}

		{#if heroicState.activeHeroicTab === 'reactions'}
			<div class="heroic-actions-tabs">
				{#each heroicState.HEROIC_REACTIONS as reaction (reaction.id)}
					<button
						class="heroic-action-tab"
						class:heroic-action-tab--active={heroicState.expandedReactionPanel === reaction.id}
						class:heroic-action-tab--available={heroicState.isReactionAvailable(
							reaction.reactionKey,
						)}
						class:heroic-action-tab--spent={!heroicState.isReactionAvailable(reaction.reactionKey)}
						class:heroic-action-tab--disabled={!heroicState.canUseReaction(reaction.reactionKey)}
						type="button"
						aria-label={localize(reaction.labelKey)}
						aria-disabled={!heroicState.canUseReaction(reaction.reactionKey)}
						data-tooltip={heroicState.getReactionTooltip(reaction)}
						draggable="true"
						ondragstart={(event) =>
							handleActionDragStart(event, reaction.id, 'reaction', reaction.labelKey)}
						onclick={() => heroicState.handleReactionClick(reaction)}
					>
						<i class={reaction.icon}></i>
						<span class="heroic-action-tab__indicator"></span>
					</button>
				{/each}
			</div>
		{/if}
	</section>

	{#if heroicState.activeHeroicTab === 'actions' && heroicState.expandedPanel === 'attack'}
		<AttackActionPanel
			showEmbeddedDocumentImages={heroicState.showEmbeddedDocumentImages}
			onActivateItem={async (cost) => {
				if (heroicState.inCombat && heroicState.actionsData.current > 0) {
					await heroicState.deductActionPips(cost);
				}
			}}
		/>
	{/if}

	{#if heroicState.activeHeroicTab === 'actions' && heroicState.expandedPanel === 'spell'}
		<CastSpellActionPanel
			showEmbeddedDocumentImages={heroicState.showEmbeddedDocumentImages}
			onActivateItem={async (cost) => {
				if (heroicState.inCombat && heroicState.actionsData.current > 0) {
					await heroicState.deductActionPips(cost);
				}
			}}
		/>
	{/if}

	{#if heroicState.activeHeroicTab === 'actions' && heroicState.expandedPanel === 'move'}
		<MoveActionPanel
			{actor}
			inCombat={heroicState.inCombat}
			actionsRemaining={heroicState.actionsData.current}
			onDeductAction={() => heroicState.deductActionPips(1)}
		/>
	{/if}

	{#if heroicState.activeHeroicTab === 'actions' && heroicState.expandedPanel === 'assess'}
		<AssessActionPanel {actor} onDeductAction={() => heroicState.deductActionPips(1)} />
	{/if}

	{#if heroicState.activeHeroicTab === 'reactions' && heroicState.expandedReactionPanel === 'defend'}
		<DefendReactionPanel
			{actor}
			reactionDisabled={!heroicState.canUseReaction('defend')}
			combinedReactionDisabled={!heroicState.canUseInterposeAndDefendCombo}
			defendSpent={!heroicState.isReactionAvailable('defend')}
			interposeSpent={!heroicState.isReactionAvailable('interpose')}
			noActions={heroicState.actionsData.current <= 0}
			isActiveTurn={heroicState.isReactionActiveTurnBlocked('defend')}
			combinedIsActiveTurn={heroicState.interposeAndDefendActiveTurnBlocked}
			onUseReaction={(options) => heroicState.useReaction('defend', options)}
			onUseCombinedReaction={(options) =>
				heroicState.useReactionCombo(['interpose', 'defend'], options)}
		/>
	{/if}

	{#if heroicState.activeHeroicTab === 'reactions' && heroicState.expandedReactionPanel === 'interpose'}
		<InterposeReactionPanel
			{actor}
			reactionDisabled={!heroicState.canUseReaction('interpose')}
			combinedReactionDisabled={!heroicState.canUseInterposeAndDefendCombo}
			defendSpent={!heroicState.isReactionAvailable('defend')}
			interposeSpent={!heroicState.isReactionAvailable('interpose')}
			noActions={heroicState.actionsData.current <= 0}
			isActiveTurn={heroicState.isReactionActiveTurnBlocked('interpose')}
			combinedIsActiveTurn={heroicState.interposeAndDefendActiveTurnBlocked}
			onUseReaction={(options) => heroicState.useReaction('interpose', options)}
			onUseCombinedReaction={(options) =>
				heroicState.useReactionCombo(['interpose', 'defend'], options)}
		/>
	{/if}

	{#if heroicState.activeHeroicTab === 'reactions' && heroicState.expandedReactionPanel === 'opportunity'}
		<OpportunityAttackPanel
			{actor}
			reactionDisabled={!heroicState.canUseReaction('opportunityAttack')}
			opportunitySpent={!heroicState.isReactionAvailable('opportunityAttack')}
			noActions={heroicState.actionsData.current <= 0}
			isActiveTurn={heroicState.isReactionActiveTurnBlocked('opportunityAttack')}
			onUseReaction={(options) => heroicState.useReaction('opportunityAttack', options)}
			forceNextReactionUse={forceNextOpportunityReactionUse}
			onConsumeForcedReactionUse={() => {
				forceNextOpportunityReactionUse = false;
			}}
			showEmbeddedDocumentImages={heroicState.showEmbeddedDocumentImages}
		/>
	{/if}

	{#if heroicState.activeHeroicTab === 'reactions' && heroicState.expandedReactionPanel === 'help'}
		<HelpReactionPanel
			{actor}
			reactionDisabled={!heroicState.canUseReaction('help')}
			helpSpent={!heroicState.isReactionAvailable('help')}
			noActions={heroicState.actionsData.current <= 0}
			isActiveTurn={heroicState.isReactionActiveTurnBlocked('help')}
			onUseReaction={(options) => heroicState.useReaction('help', options)}
		/>
	{/if}
</section>

<style lang="scss">
	.heroic-tab-header {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin-block-end: 0.25rem;

		&__tabs {
			display: flex;
			gap: 0.5rem;
		}

		&__tab {
			padding: 0.5rem 1rem;
			font-size: var(--nimble-sm-text);
			font-weight: 600;
			text-transform: uppercase;
			letter-spacing: 0.025em;
			color: var(--nimble-medium-text-color);
			background: var(--nimble-box-background-color);
			border: 1px solid var(--nimble-card-border-color);
			border-radius: 6px;
			cursor: pointer;
			transition: all 0.2s ease;

			&:hover:not(&--active) {
				color: var(--nimble-dark-text-color);
				border-color: var(--nimble-accent-color);
				background: color-mix(
					in srgb,
					var(--nimble-box-background-color) 80%,
					var(--nimble-accent-color)
				);
			}

			&--active {
				color: var(--nimble-action-info-text-color);
				background: var(--nimble-action-info-background);
				border-color: var(--nimble-action-info-border-color);
				box-shadow:
					0 0 8px var(--nimble-action-info-background),
					inset 0 1px 0 rgba(255, 255, 255, 0.1);
			}
		}
	}

	.heroic-actions__help-button {
		margin-left: auto;

		i {
			font-size: 0.875rem;
			color: var(--nimble-medium-text-color);
		}

		&:hover i {
			color: var(--nimble-dark-text-color);
		}
	}

	// Action tabs (horizontal row)
	.heroic-actions-tabs {
		display: flex;
		gap: 0.25rem;
	}

	.heroic-action-tab {
		position: relative;
		display: flex;
		align-items: center;
		justify-content: center;
		flex: 1;
		height: 2.25rem;
		padding: 0;
		background: var(--nimble-box-background-color);
		border: 2px solid var(--nimble-card-border-color);
		border-radius: 4px;
		cursor: pointer;
		transition: all 0.2s ease;

		i {
			font-size: 1rem;
			color: var(--nimble-medium-text-color);
			transition: color 0.2s ease;
		}

		&__indicator {
			position: absolute;
			top: 0.25rem;
			right: 0.25rem;
			width: 0.5rem;
			height: 0.5rem;
			border-radius: 50%;
			background: transparent;
			border: 2px solid transparent;
			transition: all 0.2s ease;
		}

		&:hover:not(:disabled):not(.heroic-action-tab--active) {
			border-color: var(--nimble-accent-color);

			i {
				color: var(--nimble-dark-text-color);
			}
		}

		&--active {
			border-color: hsl(45, 60%, 45%);
			background: hsla(45, 60%, 50%, 0.12);
			box-shadow: inset 0 0 0 1px hsla(45, 60%, 50%, 0.2);

			i {
				color: hsl(45, 60%, 40%);
			}

			.heroic-action-tab__indicator {
				background: hsl(45, 70%, 50%);
				border-color: hsl(45, 70%, 40%);
				box-shadow: 0 0 8px hsla(45, 70%, 50%, 0.6);
			}
		}

		&--disabled {
			opacity: 0.65;
		}

		&--available:not(&--active) .heroic-action-tab__indicator {
			background: hsl(145, 55%, 48%);
			border-color: hsl(145, 55%, 36%);
			box-shadow: 0 0 8px hsla(145, 55%, 48%, 0.35);
		}

		&--spent:not(&--active) .heroic-action-tab__indicator {
			background: hsla(0, 0%, 100%, 0.1);
			border-color: hsl(8, 65%, 48%);
			box-shadow: 0 0 6px hsla(8, 65%, 48%, 0.18);
		}
	}

	:global(.theme-dark) .heroic-action-tab {
		background: hsl(220, 15%, 18%);
		border-color: hsl(220, 10%, 30%);

		&:hover:not(:disabled):not(.heroic-action-tab--active) {
			border-color: hsl(220, 15%, 45%);
			background: hsl(220, 15%, 22%);
		}
	}

	:global(.theme-dark) .heroic-action-tab--active {
		border-color: hsl(45, 70%, 55%);
		background: linear-gradient(135deg, hsla(45, 60%, 50%, 0.2) 0%, hsla(45, 60%, 40%, 0.1) 100%);
		box-shadow:
			inset 0 0 0 1px hsla(45, 60%, 60%, 0.3),
			0 0 12px hsla(45, 60%, 50%, 0.15);
	}

	:global(.theme-dark) .heroic-action-tab--active i {
		color: hsl(45, 70%, 65%);
	}

	:global(.theme-dark) .heroic-action-tab--active .heroic-action-tab__indicator {
		background: hsl(45, 70%, 55%);
		border-color: hsl(45, 70%, 65%);
		box-shadow: 0 0 10px hsla(45, 70%, 55%, 0.7);
	}
</style>
