import { isCombatantDead } from '#utils/combat/isCombatantDead.js';
import { getCombatantSceneId, isPlayerCombatant } from './combat.utils.js';
import {
	getActionState,
	getCombatantDisplayName,
	getCombatantImageForDisplay,
} from './resources.utils.js';

export interface MinimizedTrackerSummary {
	combatStarted: boolean;
	round: number;
	combatantName: string | null;
	portraitSrc: string | null;
	actions: { current: number; max: number } | null;
}

export interface MinimizedBarControls {
	showTurnArrows: boolean;
	showStartCombat: boolean;
	showEndTurn: boolean;
}

export function resolveMinimizedTrackerSummary(params: {
	combatStarted: boolean;
	round: number;
	sceneId: string | undefined;
	activeCombatant: Combatant.Implementation | null;
}): MinimizedTrackerSummary {
	const { combatStarted, round, sceneId, activeCombatant } = params;
	const idle = {
		combatStarted,
		round,
		combatantName: null,
		portraitSrc: null,
		actions: null,
	};

	if (!isShownOnAliveTracker(combatStarted, sceneId, activeCombatant)) return idle;

	const actionState = getActionState(activeCombatant);

	return {
		combatStarted,
		round,
		combatantName: getCombatantDisplayName(activeCombatant),
		portraitSrc: getCombatantImageForDisplay(activeCombatant),
		actions: {
			current: Math.max(0, Math.floor(actionState.current)),
			max: Math.max(0, Math.floor(actionState.effectiveMax)),
		},
	};
}

function isShownOnAliveTracker(
	combatStarted: boolean,
	sceneId: string | undefined,
	combatant: Combatant.Implementation | null,
): combatant is Combatant.Implementation {
	if (!combatStarted || !combatant || !sceneId) return false;
	if (!combatant.visible || combatant._id == null) return false;
	if (getCombatantSceneId(combatant) !== sceneId) return false;
	return !isCombatantDead(combatant);
}

export function resolveMinimizedBarControls(params: {
	isGM: boolean;
	isOwner: boolean;
	combatStarted: boolean;
	combatantShown: boolean;
}): MinimizedBarControls {
	return {
		showTurnArrows: params.isGM,
		showStartCombat: params.isGM && !params.combatStarted,
		showEndTurn: params.combatantShown && (params.isGM || params.isOwner),
	};
}

export function shouldConfirmEndTurnEarly(params: {
	allActionsUsed: boolean;
	combatant: Combatant.Implementation | null;
}): boolean {
	if (params.allActionsUsed || !params.combatant) return false;
	return isPlayerCombatant(params.combatant);
}
