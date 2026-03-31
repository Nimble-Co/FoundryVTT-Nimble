import { untrack } from 'svelte';
import { createSubscriber } from 'svelte/reactivity';
import type { NimbleCharacter } from '../../../documents/actor/character.js';
import { getCombatantBaseActions } from '../../../documents/combat/combatantSystem.js';
import {
	getActiveCombatForCurrentScene,
	registerCombatStateHooks,
} from '../../../utils/combatState.js';
import { requestAdvanceCombatTurn } from '../../../utils/combatTurnActions.js';
import { getActiveCombatant } from '../../../utils/combatTurnSync.js';
import { initiativeRollLock } from '../../../utils/initiativeRollLock.js';
import localize from '../../../utils/localize.js';
import { characterInitiativeRoll } from '../rollCharacterInitiative.js';

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

export function createActionTrackerState(getActor: () => NimbleCharacter) {
	let isRollingInitiative = $state(false);

	// ============================================================================
	// Combat State Subscription
	// ============================================================================

	const subscribeCombatState = createSubscriber(registerCombatStateHooks);

	// ============================================================================
	// Combat Helper Functions
	// ============================================================================

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
		if (initiativeRollLock.hasActiveLock(combatant)) return false;
		return combatant.initiative === null;
	}

	function isInitiativePending(): boolean {
		if (isRollingInitiative) return true;
		const combatant = getCombatantInCombat();
		if (!combatant) return false;
		return initiativeRollLock.hasActiveLock(combatant);
	}

	function getActionsData(): ActionsData {
		const combatant = getCombatantInCombat();
		if (!combatant) return { current: 0, max: 3 };

		const actions = getCombatantBaseActions(combatant);
		return {
			current: actions.current,
			max: actions.max || 3,
		};
	}

	function isCharactersTurn(): boolean {
		const combat = getActiveCombatForCurrentScene();
		if (!combat?.started) return false;

		const currentCombatant = getActiveCombatant(combat);
		if (!currentCombatant) return false;

		return currentCombatant.actorId === getActor().id;
	}

	// ============================================================================
	// Combat Actions
	// ============================================================================

	async function rollInitiative(): Promise<void> {
		const combat = getActiveCombatForCurrentScene();
		if (!combat || isRollingInitiative) return;
		const combatant = combat.combatants.find((entry) => entry.actorId === getActor().id);
		if (!combatant?.id) return;
		if (initiativeRollLock.hasActiveLock(combatant)) return;

		isRollingInitiative = true;
		try {
			await characterInitiativeRoll.roll(getActor());
		} catch (_error) {
			ui.notifications?.warn(localize('NIMBLE.ui.heroicActions.noPermissionRollInitiative'));
		} finally {
			isRollingInitiative = false;
		}
	}

	async function updateActionPips(newValue: number): Promise<void> {
		const combatant = getCombatantInCombat();
		if (!combatant) return;
		await combatant.update({ 'system.actions.base.current': newValue } as Record<string, unknown>);
	}

	async function endTurn(): Promise<void> {
		const combat = getActiveCombatForCurrentScene();
		if (!combat) return;

		try {
			const advanced = await requestAdvanceCombatTurn({ combat });
			if (!advanced) {
				ui.notifications?.warn(localize('NIMBLE.ui.heroicActions.noPermissionEndTurn'));
			}
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

	const initiativePending = $derived.by(() => {
		subscribeCombatState();
		return isInitiativePending();
	});

	const actionsData = $derived.by(() => {
		subscribeCombatState();
		return getActionsData();
	});

	const isMyTurn = $derived.by(() => {
		subscribeCombatState();
		return isCharactersTurn();
	});

	const showCombatBar = $derived(hasInitiative || needsInitiative || initiativePending);

	// ============================================================================
	// Pip Interaction
	// ============================================================================

	function handlePipClick(index: number): void {
		if (!hasInitiative) return;

		const isAvailable = index < actionsData.current;

		if (isAvailable) {
			// Spend one action
			const newValue = Math.max(actionsData.current - 1, 0);
			updateActionPips(newValue);
		} else {
			// Restore one action
			const newValue = Math.min(actionsData.current + 1, actionsData.max);
			updateActionPips(newValue);
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
		get initiativePending() {
			return initiativePending;
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
