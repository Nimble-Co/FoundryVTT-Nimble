import {
	getActionState,
	getCombatantDisplayName,
	getCombatantImageForDisplay,
} from './resources.utils.js';

export interface MinimizedTrackerSummary {
	roundLabel: number;
	hasActiveCombatant: boolean;
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

	if (!combatStarted || !activeCombatant) {
		return {
			roundLabel,
			hasActiveCombatant: false,
			combatantName: null,
			portraitSrc: null,
			actions: null,
		};
	}

	const actionState = getActionState(activeCombatant);

	return {
		roundLabel,
		hasActiveCombatant: true,
		combatantName: getCombatantDisplayName(activeCombatant),
		portraitSrc: getCombatantImageForDisplay(activeCombatant),
		actions: {
			current: Math.max(0, Math.floor(actionState.current)),
			max: Math.max(0, Math.floor(actionState.effectiveMax)),
		},
	};
}
