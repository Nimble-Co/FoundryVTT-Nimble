import { untrack } from 'svelte';
import { createSubscriber } from 'svelte/reactivity';
import type { NimbleCharacter } from '../../../documents/actor/character.js';
import localize from '../../../utils/localize.js';

// ============================================================================
// Types
// ============================================================================

interface ActionsData {
	current: number;
	max: number;
}

// ============================================================================
// Dice Icons
// ============================================================================

const DICE_ICONS = [
	'fa-dice-one',
	'fa-dice-two',
	'fa-dice-three',
	'fa-dice-four',
	'fa-dice-five',
	'fa-dice-six',
];

export function getDiceIcon(index: number): string {
	if (index < DICE_ICONS.length) {
		return DICE_ICONS[index];
	}
	return 'fa-dice-d6';
}

// ============================================================================
// State Factory
// ============================================================================

export function createFloatingCombatBarState(getActor: () => NimbleCharacter) {
	// ============================================================================
	// Combat State Subscription
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
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			hookId: Hooks.on(hookName as any, () => update()),
			hookName,
		}));

		return () => {
			hookIds.forEach(({ hookName, hookId }) => {
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				Hooks.off(hookName as any, hookId);
			});
		};
	});

	// ============================================================================
	// Combat Helper Functions
	// ============================================================================

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
		return combat.combatants.find((entry) => entry.actorId === getActor().id) ?? null;
	}

	function hasRolledInitiative(): boolean {
		const combatant = getCombatantInCombat();
		if (!combatant) return false;
		return combatant.initiative !== null;
	}

	function needsToRollInitiative(): boolean {
		const combatant = getCombatantInCombat();
		if (!combatant) return false;
		return combatant.initiative === null;
	}

	function getActionsData(): ActionsData {
		const combatant = getCombatantInCombat();
		if (!combatant) return { current: 0, max: 3 };

		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const actions = (combatant as any).system?.actions?.base;
		return {
			current: actions?.current ?? 0,
			max: actions?.max ?? 3,
		};
	}

	function isCharactersTurn(): boolean {
		const combat = getActiveCombatForCurrentScene();
		if (!combat?.started) return false;

		const currentCombatant = combat.combatant;
		if (!currentCombatant) return false;

		return currentCombatant.actorId === getActor().id;
	}

	// ============================================================================
	// Combat Actions
	// ============================================================================

	async function rollInitiative(): Promise<void> {
		const combat = getActiveCombatForCurrentScene();
		if (!combat) return;
		const combatant = combat.combatants.find((entry) => entry.actorId === getActor().id);
		if (!combatant?.id) return;

		try {
			await combat.rollInitiative([combatant.id]);
		} catch (_error) {
			ui.notifications?.warn(localize('NIMBLE.ui.heroicActions.noPermissionRollInitiative'));
		}
	}

	async function updateActionPips(newValue: number): Promise<void> {
		const combatant = getCombatantInCombat();
		if (!combatant) return;
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		await combatant.update({ 'system.actions.base.current': newValue } as any);
	}

	async function endTurn(): Promise<void> {
		const combat = getActiveCombatForCurrentScene();
		if (!combat) return;

		try {
			await combat.nextTurn();
		} catch (_error) {
			ui.notifications?.warn(localize('NIMBLE.ui.heroicActions.noPermissionEndTurn'));
		}
	}

	// ============================================================================
	// Reactive Combat State
	// ============================================================================

	const needsInitiative = $derived.by(() => {
		subscribeCombatState();
		return needsToRollInitiative();
	});

	const hasInitiative = $derived.by(() => {
		subscribeCombatState();
		return hasRolledInitiative();
	});

	const actionsData = $derived.by(() => {
		subscribeCombatState();
		return getActionsData();
	});

	const isMyTurn = $derived.by(() => {
		subscribeCombatState();
		return isCharactersTurn();
	});

	const showCombatBar = $derived(hasInitiative || needsInitiative);

	// ============================================================================
	// Pip Interaction
	// ============================================================================

	function handlePipClick(index: number): void {
		if (!hasInitiative) return;

		const pipNumber = index + 1;

		if (pipNumber <= actionsData.current) {
			updateActionPips(index);
		} else {
			updateActionPips(pipNumber);
		}
	}

	function getPipAriaLabel(index: number, isAvailable: boolean): string {
		const number = String(index + 1);
		if (isAvailable) {
			return localize('NIMBLE.ui.heroicActions.pip.spendAction', { number });
		}
		return localize('NIMBLE.ui.heroicActions.pip.restoreAction', { number });
	}

	function getPipTooltip(isAvailable: boolean): string {
		if (!hasInitiative) {
			return localize('NIMBLE.ui.heroicActions.enterCombat');
		}
		if (isAvailable) {
			return localize('NIMBLE.ui.heroicActions.pip.clickToSpend');
		}
		return localize('NIMBLE.ui.heroicActions.pip.clickToRestore');
	}

	// ============================================================================
	// Pip Spend Animation
	// ============================================================================

	let justSpentPips = $state(new Set<number>());
	let previousCurrent = $state(untrack(() => actionsData.current));

	function setupPipAnimationEffect(): void {
		$effect(() => {
			const current = actionsData.current;
			if (current < previousCurrent) {
				const newlySpent = new Set<number>();
				for (let i = current; i < previousCurrent; i++) {
					newlySpent.add(i);
				}
				justSpentPips = newlySpent;

				setTimeout(() => {
					justSpentPips = new Set();
				}, 600);
			}
			previousCurrent = current;
		});
	}

	// ============================================================================
	// Return Public Interface
	// ============================================================================

	return {
		// Reactive state (getters)
		get needsInitiative() {
			return needsInitiative;
		},
		get hasInitiative() {
			return hasInitiative;
		},
		get actionsData() {
			return actionsData;
		},
		get isMyTurn() {
			return isMyTurn;
		},
		get showCombatBar() {
			return showCombatBar;
		},
		get justSpentPips() {
			return justSpentPips;
		},

		// Actions
		rollInitiative,
		endTurn,
		handlePipClick,

		// Helpers
		getPipAriaLabel,
		getPipTooltip,
		setupPipAnimationEffect,
	};
}
