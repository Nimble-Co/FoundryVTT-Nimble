import {
	getActionState,
	getCombatantDisplayName,
	getCombatantImageForDisplay,
} from './resources.utils.js';

export interface MinimizedTrackerSummary {
	combatStarted: boolean;
	roundLabel: number;
	combatantName: string | null;
	portraitSrc: string | null;
	actions: { current: number; max: number } | null;
}

export function resolveMinimizedTrackerSummary(params: {
	combatStarted: boolean;
	roundLabel: number;
	activeCombatant: Combatant.Implementation | null;
}): MinimizedTrackerSummary {
	const { combatStarted, roundLabel, activeCombatant } = params;

	if (!combatStarted || !activeCombatant || !activeCombatant.visible) {
		return {
			combatStarted,
			roundLabel,
			combatantName: null,
			portraitSrc: null,
			actions: null,
		};
	}

	const actionState = getActionState(activeCombatant);

	return {
		combatStarted,
		roundLabel,
		combatantName: getCombatantDisplayName(activeCombatant),
		portraitSrc: getCombatantImageForDisplay(activeCombatant),
		actions: {
			current: Math.max(0, Math.floor(actionState.current)),
			max: Math.max(0, Math.floor(actionState.effectiveMax)),
		},
	};
}
