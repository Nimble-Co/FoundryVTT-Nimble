<script>
	import { getContext } from 'svelte';
	import localize from '../../../utils/localize.js';
	import { createHeroicActionsTabState } from './PlayerCharacterHeroicActionsTab.svelte.js';

	import AssessActionPanel from '../components/AssessActionPanel.svelte';
	import AttackActionPanel from '../components/AttackActionPanel.svelte';
	import CastSpellActionPanel from '../components/CastSpellActionPanel.svelte';
	import MoveActionPanel from '../components/MoveActionPanel.svelte';

	// ============================================================================
	// Context & State
	// ============================================================================

	let actor = getContext('actor');
	const state = createHeroicActionsTabState(() => actor);
</script>

<section class="nimble-sheet__body nimble-sheet__body--player-character">
	<section>
		<header class="heroic-tab-header">
			<div class="heroic-tab-header__tabs">
				<button
					class="heroic-tab-header__tab"
					class:heroic-tab-header__tab--active={state.activeHeroicTab === 'actions'}
					type="button"
					onclick={() => (state.activeHeroicTab = 'actions')}
				>
					{localize('NIMBLE.ui.heroicActions.title')}
				</button>
				<button
					class="heroic-tab-header__tab"
					class:heroic-tab-header__tab--active={state.activeHeroicTab === 'reactions'}
					type="button"
					onclick={() => (state.activeHeroicTab = 'reactions')}
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
				onclick={state.handleHelpDialog}
			>
				<i class="fa-solid fa-circle-question"></i>
			</button>
		</header>

		{#if state.activeHeroicTab === 'actions'}
			<div class="heroic-actions-tabs">
				{#each state.HEROIC_ACTIONS as action (action.id)}
					<button
						class="heroic-action-tab"
						class:heroic-action-tab--active={state.expandedPanel === action.id}
						class:heroic-action-tab--disabled={state.isActionDisabled(action)}
						type="button"
						aria-label={localize(action.labelKey)}
						data-tooltip={state.getActionTooltip(action)}
						disabled={state.isActionDisabled(action)}
						onclick={() => state.handleActionClick(action)}
					>
						<i class={action.icon}></i>
						<span class="heroic-action-tab__indicator"></span>
					</button>
				{/each}
			</div>
		{/if}

		{#if state.activeHeroicTab === 'reactions'}
			<div class="heroic-reactions-placeholder">
				<p>{localize('NIMBLE.ui.heroicActions.reactionsPlaceholder')}</p>
			</div>
		{/if}
	</section>

	{#if state.activeHeroicTab === 'actions' && state.expandedPanel === 'attack'}
		<AttackActionPanel
			showEmbeddedDocumentImages={state.showEmbeddedDocumentImages}
			onActivateItem={(cost) => {
				if (state.inCombat && state.actionsData.current > 0) {
					state.deductActionPips(cost);
				}
			}}
		/>
	{/if}

	{#if state.activeHeroicTab === 'actions' && state.expandedPanel === 'spell'}
		<CastSpellActionPanel
			showEmbeddedDocumentImages={state.showEmbeddedDocumentImages}
			onActivateItem={(cost) => {
				if (state.inCombat && state.actionsData.current > 0) {
					state.deductActionPips(cost);
				}
			}}
		/>
	{/if}

	{#if state.activeHeroicTab === 'actions' && state.expandedPanel === 'move'}
		<MoveActionPanel
			{actor}
			inCombat={state.inCombat}
			actionsRemaining={state.actionsData.current}
			onDeductAction={() => state.deductActionPips(1)}
		/>
	{/if}

	{#if state.activeHeroicTab === 'actions' && state.expandedPanel === 'assess'}
		<AssessActionPanel {actor} onDeductAction={() => state.deductActionPips(1)} />
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
			gap: 0;
		}

		&__tab {
			padding: 0.25rem 0.75rem;
			font-size: var(--nimble-sm-text);
			font-weight: 700;
			text-transform: uppercase;
			color: var(--nimble-medium-text-color);
			background: transparent;
			border: none;
			border-bottom: 2px solid transparent;
			cursor: pointer;
			transition: all 0.15s ease;

			&:hover:not(&--active) {
				color: var(--nimble-dark-text-color);
			}

			&--active {
				color: var(--nimble-dark-text-color);
				border-bottom-color: var(--nimble-accent-color);
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

	.heroic-reactions-placeholder {
		padding: 1rem;
		text-align: center;
		font-size: var(--nimble-sm-text);
		color: var(--nimble-medium-text-color);
		font-style: italic;

		p {
			margin: 0;
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
			opacity: 0.5;
			cursor: not-allowed;
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
