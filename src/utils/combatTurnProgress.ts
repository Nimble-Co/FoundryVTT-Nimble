import {
	getEffectiveMinionGroupLeader,
	getMinionGroupId,
	type getMinionGroupSummaries,
} from './minionGrouping.js';

function getCombatantIdValue(combatant: { id?: string | null } | null | undefined): string {
	return combatant?.id ?? '';
}

export function getTurnOrderIndexForCombatant(
	combat: Combat,
	combatant: Combatant.Implementation,
	groupSummaries: ReturnType<typeof getMinionGroupSummaries>,
): number {
	const combatantId = getCombatantIdValue(combatant);
	if (!combatantId) return -1;

	const directIndex = combat.turns.findIndex(
		(turnCombatant) => getCombatantIdValue(turnCombatant) === combatantId,
	);
	if (directIndex >= 0) return directIndex;

	const groupId = getMinionGroupId(combatant);
	if (!groupId) return -1;

	const groupSummary = groupSummaries.get(groupId);
	if (!groupSummary) return -1;

	const leader =
		getEffectiveMinionGroupLeader(groupSummary, { aliveOnly: true }) ??
		getEffectiveMinionGroupLeader(groupSummary);
	if (!leader?.id) return -1;

	return combat.turns.findIndex(
		(turnCombatant) => getCombatantIdValue(turnCombatant) === leader.id,
	);
}

export function hasCombatantTurnEndedThisRound(
	combat: Combat,
	combatant: Combatant.Implementation,
	groupSummaries: ReturnType<typeof getMinionGroupSummaries>,
): boolean {
	if ((combat.round ?? 0) < 1) return false;

	const turnIndex = Number(combat.turn ?? -1);
	const activeTurnIndex =
		Number.isInteger(turnIndex) && turnIndex >= 0 && turnIndex < combat.turns.length
			? turnIndex
			: combat.turns.findIndex(
					(turnCombatant) =>
						getCombatantIdValue(turnCombatant) === getCombatantIdValue(combat.combatant),
				);
	if (activeTurnIndex < 0) return false;

	const combatantTurnIndex = getTurnOrderIndexForCombatant(combat, combatant, groupSummaries);
	if (combatantTurnIndex < 0) return false;

	return combatantTurnIndex < activeTurnIndex;
}
