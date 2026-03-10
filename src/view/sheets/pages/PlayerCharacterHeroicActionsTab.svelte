<script>
	import { createSubscriber } from 'svelte/reactivity';
	import { getContext } from 'svelte';
	import filterItems from '../../dataPreparationHelpers/filterItems.js';
	import localize from '../../../utils/localize.js';

	import AssessActionPanel from '../components/AssessActionPanel.svelte';
	import AttackActionPanel from '../components/AttackActionPanel.svelte';
	import CastSpellActionPanel from '../components/CastSpellActionPanel.svelte';
	import MoveActionPanel from '../components/MoveActionPanel.svelte';

	// ============================================================================
	// Context & Configuration
	// ============================================================================

	let actor = getContext('actor');

	// ============================================================================
	// Action Definitions (Single source of truth for all heroic actions)
	// ============================================================================

	const HEROIC_ACTIONS = [
		{
			id: 'attack',
			icon: 'fa-solid fa-sword',
			labelKey: 'NIMBLE.ui.heroicActions.actions.attack.label',
			descriptionKey: 'NIMBLE.ui.heroicActions.actions.attack.description',
			type: 'panel', // Opens a panel
		},
		{
			id: 'spell',
			icon: 'fa-solid fa-wand-sparkles',
			labelKey: 'NIMBLE.ui.heroicActions.actions.spell.label',
			descriptionKey: 'NIMBLE.ui.heroicActions.actions.spell.description',
			type: 'panel',
		},
		{
			id: 'move',
			icon: 'fa-solid fa-person-running',
			labelKey: 'NIMBLE.ui.heroicActions.actions.move.label',
			descriptionKey: 'NIMBLE.ui.heroicActions.actions.move.description',
			type: 'panel',
		},
		{
			id: 'assess',
			icon: 'fa-solid fa-eye',
			labelKey: 'NIMBLE.ui.heroicActions.actions.assess.label',
			descriptionKey: 'NIMBLE.ui.heroicActions.actions.assess.description',
			type: 'panel',
		},
	];

	// Top-level tab for switching between Actions and Reactions
	let activeHeroicTab = $state('actions');

	// ============================================================================
	// Combat State Management
	// ============================================================================

	const subscribeCombatState = createSubscriber((update) => {
		const hookNames = [
			'combatStart',
			'createCombat',
			'updateCombat',
			'deleteCombat',
			'createCombatant',
			'updateCombatant',
			'deleteCombatant',
			'canvasInit',
			'canvasReady',
		];

		const hookIds = hookNames.map((hookName) => ({
			hookId: Hooks.on(hookName, () => update()),
			hookName,
		}));

		return () => hookIds.forEach(({ hookName, hookId }) => Hooks.off(hookName, hookId));
	});

	function getActiveCombatForCurrentScene() {
		const sceneId = canvas?.scene?.id;
		if (!sceneId) return null;

		const activeCombat = game.combat;
		if (activeCombat?.active && activeCombat.scene?.id === sceneId) {
			return activeCombat;
		}

		const activeByScene = game.combats?.contents?.find(
			(combat) => combat?.active && combat.scene?.id === sceneId,
		);
		if (activeByScene) return activeByScene;

		const viewedCombat = game.combats?.viewed ?? null;
		if (viewedCombat?.active && viewedCombat.scene?.id === sceneId) {
			return viewedCombat;
		}

		return null;
	}

	function getCombatantInCombat() {
		const combat = getActiveCombatForCurrentScene();
		if (!combat) return null;
		return combat.combatants.find((entry) => entry.actorId === actor.id) ?? null;
	}

	function getCombatant() {
		const combat = getActiveCombatForCurrentScene();
		if (!combat?.started) return null;
		return combat.combatants.find((entry) => entry.actorId === actor.id) ?? null;
	}

	function isInActiveCombat() {
		const combatant = getCombatant();
		if (!combatant) return false;
		return combatant.initiative !== null;
	}

	function getActionsData() {
		const combatant = getCombatantInCombat();
		if (!combatant) return { current: 0, max: 3 };

		const actions = combatant.system?.actions?.base;
		return {
			current: actions?.current ?? 0,
			max: actions?.max ?? 3,
		};
	}

	async function updateActionPips(newValue) {
		const combatant = getCombatantInCombat();
		if (!combatant) return;
		await combatant.update({ 'system.actions.base.current': newValue });
	}

	async function deductActionPips(count = 1) {
		const { current } = getActionsData();
		if (current > 0) {
			const newValue = Math.max(0, current - count);
			await updateActionPips(newValue);
		}
	}

	// Reactive combat state
	let inCombat = $derived.by(() => {
		subscribeCombatState();
		return isInActiveCombat();
	});

	let actionsData = $derived.by(() => {
		subscribeCombatState();
		return getActionsData();
	});

	// ============================================================================
	// Panel State & Action Handlers
	// ============================================================================

	let expandedPanel = $state('attack');

	function togglePanel(panelName) {
		// Attack and Spell act like tabs - clicking the selected one does nothing
		// You can only switch between them
		if (expandedPanel === panelName) {
			return;
		}
		expandedPanel = panelName;
	}

	function handleActionClick(action) {
		switch (action.type) {
			case 'panel':
				togglePanel(action.id);
				break;
		}
	}

	async function handleHelpDialog() {
		const { default: GenericDialog } = await import(
			'../../../documents/dialogs/GenericDialog.svelte.js'
		);
		const { default: HeroicActionsHelpDialog } = await import(
			'../../dialogs/HeroicActionsHelpDialog.svelte'
		);

		GenericDialog.getOrCreate(
			localize('NIMBLE.ui.heroicActions.help.dialogTitle'),
			HeroicActionsHelpDialog,
			{},
			{ width: 480, uniqueId: 'heroic-actions-help' },
		).render(true);
	}

	function isActionDisabled(action) {
		if (action.requiresCombat) {
			return !inCombat || actionsData.current <= 0;
		}
		if (action.id === 'spell') {
			return !hasSpells;
		}
		return false;
	}

	function getActionTooltip(action) {
		const label = localize(action.labelKey);

		if (action.requiresCombat) {
			if (!inCombat) {
				return `${label} (${localize('NIMBLE.ui.heroicActions.outsideCombat')})`;
			}
			if (actionsData.current <= 0) {
				return `${label} (${localize('NIMBLE.ui.heroicActions.noActions')})`;
			}
		}
		if (action.id === 'spell' && !hasSpells) {
			return `${label} (${localize('NIMBLE.ui.heroicActions.noSpells')})`;
		}
		return label;
	}

	// ============================================================================
	// Spell Data (for hasSpells check)
	// ============================================================================

	let allSpells = $derived(filterItems(actor.reactive, ['spell'], ''));
	let hasSpells = $derived(allSpells.length > 0);

	// ============================================================================
	// Derived State
	// ============================================================================

	let flags = $derived(actor.reactive.flags.nimble);
	let showEmbeddedDocumentImages = $derived(flags?.showEmbeddedDocumentImages ?? true);
</script>

<section class="nimble-sheet__body nimble-sheet__body--player-character">
	<section>
		<header class="heroic-tab-header">
			<div class="heroic-tab-header__tabs">
				<button
					class="heroic-tab-header__tab"
					class:heroic-tab-header__tab--active={activeHeroicTab === 'actions'}
					type="button"
					onclick={() => (activeHeroicTab = 'actions')}
				>
					{localize('NIMBLE.ui.heroicActions.title')}
				</button>
				<button
					class="heroic-tab-header__tab"
					class:heroic-tab-header__tab--active={activeHeroicTab === 'reactions'}
					type="button"
					onclick={() => (activeHeroicTab = 'reactions')}
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
				onclick={handleHelpDialog}
			>
				<i class="fa-solid fa-circle-question"></i>
			</button>
		</header>

		{#if activeHeroicTab === 'actions'}
			<div class="heroic-actions-tabs">
				{#each HEROIC_ACTIONS as action (action.id)}
					<button
						class="heroic-action-tab"
						class:heroic-action-tab--active={expandedPanel === action.id}
						class:heroic-action-tab--disabled={isActionDisabled(action)}
						type="button"
						aria-label={localize(action.labelKey)}
						data-tooltip={getActionTooltip(action)}
						disabled={isActionDisabled(action)}
						onclick={() => handleActionClick(action)}
					>
						<i class={action.icon}></i>
						<span class="heroic-action-tab__indicator"></span>
					</button>
				{/each}
			</div>
		{/if}

		{#if activeHeroicTab === 'reactions'}
			<div class="heroic-reactions-placeholder">
				<p>{localize('NIMBLE.ui.heroicActions.reactionsPlaceholder')}</p>
			</div>
		{/if}
	</section>

	{#if activeHeroicTab === 'actions' && expandedPanel === 'attack'}
		<AttackActionPanel
			{showEmbeddedDocumentImages}
			onActivateItem={(cost) => {
				if (inCombat && actionsData.current > 0) {
					deductActionPips(cost);
				}
			}}
		/>
	{/if}

	{#if activeHeroicTab === 'actions' && expandedPanel === 'spell'}
		<CastSpellActionPanel
			{showEmbeddedDocumentImages}
			onActivateItem={(cost) => {
				if (inCombat && actionsData.current > 0) {
					deductActionPips(cost);
				}
			}}
		/>
	{/if}

	{#if activeHeroicTab === 'actions' && expandedPanel === 'move'}
		<MoveActionPanel
			{actor}
			{inCombat}
			actionsRemaining={actionsData.current}
			onDeductAction={() => deductActionPips(1)}
		/>
	{/if}

	{#if activeHeroicTab === 'actions' && expandedPanel === 'assess'}
		<AssessActionPanel {actor} onDeductAction={() => deductActionPips(1)} />
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
