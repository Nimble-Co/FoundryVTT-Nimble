import { createSubscriber } from 'svelte/reactivity';
import GenericDialog from '../../../documents/dialogs/GenericDialog.svelte.js';
import localize from '../../../utils/localize.js';
import filterItems from '../../dataPreparationHelpers/filterItems.js';
import HeroicActionsHelpDialog from '../../dialogs/HeroicActionsHelpDialog.svelte';

// ============================================================================
// Types
// ============================================================================

interface HeroicAction {
	id: string;
	icon: string;
	labelKey: string;
	descriptionKey: string;
	type: string;
	requiresCombat?: boolean;
}

interface ActionsData {
	current: number;
	max: number;
}

// ============================================================================
// Action Definitions (Single source of truth for all heroic actions)
// ============================================================================

export const HEROIC_ACTIONS: HeroicAction[] = [
	{
		id: 'attack',
		icon: 'fa-solid fa-sword',
		labelKey: 'NIMBLE.ui.heroicActions.actions.attack.label',
		descriptionKey: 'NIMBLE.ui.heroicActions.actions.attack.description',
		type: 'panel',
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

export function createHeroicActionsTabState(actor: Actor) {
	// Top-level tab for switching between Actions and Reactions
	let activeHeroicTab = $state<'actions' | 'reactions'>('actions');
	let expandedPanel = $state('attack');

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

		return () => {
			hookIds.forEach(({ hookName, hookId }) => {
				Hooks.off(hookName, hookId);
			});
		};
	});

	function getActiveCombatForCurrentScene(): Combat | null {
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

	function getCombatantInCombat(): Combatant | null {
		const combat = getActiveCombatForCurrentScene();
		if (!combat) return null;
		return combat.combatants.find((entry) => entry.actorId === actor.id) ?? null;
	}

	function getCombatant(): Combatant | null {
		const combat = getActiveCombatForCurrentScene();
		if (!combat?.started) return null;
		return combat.combatants.find((entry) => entry.actorId === actor.id) ?? null;
	}

	function isInActiveCombat(): boolean {
		const combatant = getCombatant();
		if (!combatant) return false;
		return combatant.initiative !== null;
	}

	function getActionsData(): ActionsData {
		const combatant = getCombatantInCombat();
		if (!combatant) return { current: 0, max: 3 };

		const actions = combatant.system?.actions?.base;
		return {
			current: actions?.current ?? 0,
			max: actions?.max ?? 3,
		};
	}

	async function updateActionPips(newValue: number): Promise<void> {
		const combatant = getCombatantInCombat();
		if (!combatant) return;
		await combatant.update({ 'system.actions.base.current': newValue });
	}

	async function deductActionPips(count = 1): Promise<void> {
		const { current } = getActionsData();
		if (current > 0) {
			const newValue = Math.max(0, current - count);
			await updateActionPips(newValue);
		}
	}

	// Reactive combat state
	const inCombat = $derived.by(() => {
		subscribeCombatState();
		return isInActiveCombat();
	});

	const actionsData = $derived.by(() => {
		subscribeCombatState();
		return getActionsData();
	});

	// ============================================================================
	// Panel State & Action Handlers
	// ============================================================================

	function togglePanel(panelName: string): void {
		if (expandedPanel === panelName) {
			return;
		}
		expandedPanel = panelName;
	}

	function handleActionClick(action: HeroicAction): void {
		switch (action.type) {
			case 'panel':
				togglePanel(action.id);
				break;
		}
	}

	function handleHelpDialog(): void {
		GenericDialog.getOrCreate(
			localize('NIMBLE.ui.heroicActions.help.dialogTitle'),
			HeroicActionsHelpDialog,
			{},
			{ width: 480, uniqueId: 'heroic-actions-help' },
		).render(true);
	}

	// ============================================================================
	// Spell Data (for hasSpells check)
	// ============================================================================

	const allSpells = $derived(filterItems(actor.reactive, ['spell'], ''));
	const hasSpells = $derived(allSpells.length > 0);

	// ============================================================================
	// Derived State
	// ============================================================================

	const flags = $derived(actor.reactive.flags.nimble);
	const showEmbeddedDocumentImages = $derived(flags?.showEmbeddedDocumentImages ?? true);

	function isActionDisabled(action: HeroicAction): boolean {
		if (action.requiresCombat) {
			return !inCombat || actionsData.current <= 0;
		}
		if (action.id === 'spell') {
			return !hasSpells;
		}
		return false;
	}

	function getActionTooltip(action: HeroicAction): string {
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

	return {
		get activeHeroicTab() {
			return activeHeroicTab;
		},
		set activeHeroicTab(value: 'actions' | 'reactions') {
			activeHeroicTab = value;
		},
		get expandedPanel() {
			return expandedPanel;
		},
		get inCombat() {
			return inCombat;
		},
		get actionsData() {
			return actionsData;
		},
		get hasSpells() {
			return hasSpells;
		},
		get showEmbeddedDocumentImages() {
			return showEmbeddedDocumentImages;
		},
		HEROIC_ACTIONS,
		deductActionPips,
		handleActionClick,
		handleHelpDialog,
		isActionDisabled,
		getActionTooltip,
	};
}
