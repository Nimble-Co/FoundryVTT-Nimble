import {
	getEffectiveMinionGroupLeader,
	getMinionGroupId,
	getMinionGroupSummaries,
} from '../../utils/minionGrouping.js';

function collectAliveMinionLeaderIds(
	groupedSummaries: ReturnType<typeof getMinionGroupSummaries>,
): Set<string> {
	const leaderIds = new Set<string>();
	for (const summary of groupedSummaries.values()) {
		const leader = getEffectiveMinionGroupLeader(summary, { aliveOnly: true });
		if (leader?.id) leaderIds.add(leader.id);
	}
	return leaderIds;
}

export function normalizeMinionTurns(
	turns: Combatant.Implementation[],
): Combatant.Implementation[] {
	const groupedSummaries = getMinionGroupSummaries(turns);
	if (groupedSummaries.size === 0) return turns;

	const leaderIds = collectAliveMinionLeaderIds(groupedSummaries);
	return turns.filter((combatant) => {
		const groupId = getMinionGroupId(combatant);
		if (!groupId) return true;
		return leaderIds.has(combatant.id ?? '');
	});
}

export function expandLegendaryTurns(
	turns: Combatant.Implementation[],
): Combatant.Implementation[] {
	const characters: Combatant.Implementation[] = [];
	const legendaryCombatants: Combatant.Implementation[] = [];
	const nonCharacterNonLegendary: Combatant.Implementation[] = [];

	for (const combatant of turns) {
		if (combatant.type === 'character') {
			characters.push(combatant);
			continue;
		}
		if (combatant.type === 'soloMonster') {
			legendaryCombatants.push(combatant);
			continue;
		}
		nonCharacterNonLegendary.push(combatant);
	}

	if (characters.length === 0 || legendaryCombatants.length === 0) return turns;

	// Solo monsters intentionally gain a turn after each character turn.
	// Their original relative placement within the non-character section is not preserved.
	const expandedTurns: Combatant.Implementation[] = [];
	for (const character of characters) {
		expandedTurns.push(character, ...legendaryCombatants);
	}
	expandedTurns.push(...nonCharacterNonLegendary);
	return expandedTurns;
}
