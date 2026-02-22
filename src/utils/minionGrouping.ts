import { isCombatantDead } from './isCombatantDead.js';

export const MINION_GROUP_FLAG_ROOT = 'flags.nimble.minionGroup';
export const MINION_GROUP_ID_PATH = `${MINION_GROUP_FLAG_ROOT}.id`;
export const MINION_GROUP_ROLE_PATH = `${MINION_GROUP_FLAG_ROOT}.role`;
export const MINION_GROUP_TEMPORARY_PATH = `${MINION_GROUP_FLAG_ROOT}.temporary`;

export type MinionGroupRole = 'leader' | 'member';

interface MinionGroupFlagData {
	id?: unknown;
	role?: unknown;
	temporary?: unknown;
}

export interface MinionGroupSummary {
	id: string;
	members: Combatant.Implementation[];
	explicitLeader: Combatant.Implementation | null;
	aliveMembers: Combatant.Implementation[];
	deadMembers: Combatant.Implementation[];
}

function getMinionGroupFlagData(
	combatant: Combatant.Implementation | null | undefined,
): MinionGroupFlagData {
	if (!combatant) return {};

	const data = foundry.utils.getProperty(combatant, MINION_GROUP_FLAG_ROOT) as
		| MinionGroupFlagData
		| null
		| undefined;
	return data ?? {};
}

function getCombatantManualSortValue(combatant: Combatant.Implementation): number {
	return Number(foundry.utils.getProperty(combatant, 'system.sort') ?? 0);
}

function getCombatantInitiativeValue(combatant: Combatant.Implementation): number {
	return Number(combatant.initiative ?? Number.NEGATIVE_INFINITY);
}

function compareCombatantsForGroupResolution(
	a: Combatant.Implementation,
	b: Combatant.Implementation,
): number {
	const manualSortDiff = getCombatantManualSortValue(a) - getCombatantManualSortValue(b);
	if (manualSortDiff !== 0) return manualSortDiff;

	const initiativeDiff = getCombatantInitiativeValue(b) - getCombatantInitiativeValue(a);
	if (initiativeDiff !== 0) return initiativeDiff;

	return (a.name ?? '').localeCompare(b.name ?? '');
}

export function sortCombatantsForGroupResolution(
	combatants: Combatant.Implementation[],
): Combatant.Implementation[] {
	return [...combatants].sort(compareCombatantsForGroupResolution);
}

export function isMinionCombatant(
	combatant: Combatant.Implementation | null | undefined,
): combatant is Combatant.Implementation {
	const combatantType = combatant?.type as string | undefined;
	const actorType = combatant?.actor?.type as string | undefined;
	return Boolean(combatant && (actorType === 'minion' || combatantType === 'minion'));
}

export function getMinionGroupId(
	combatant: Combatant.Implementation | null | undefined,
): string | null {
	if (!isMinionCombatant(combatant)) return null;

	const { id } = getMinionGroupFlagData(combatant);
	return typeof id === 'string' && id.length > 0 ? id : null;
}

export function getMinionGroupRole(
	combatant: Combatant.Implementation | null | undefined,
): MinionGroupRole | null {
	if (!isMinionCombatant(combatant)) return null;

	const { role } = getMinionGroupFlagData(combatant);
	return role === 'leader' || role === 'member' ? role : null;
}

export function isMinionGrouped(combatant: Combatant.Implementation | null | undefined): boolean {
	return getMinionGroupId(combatant) !== null;
}

export function isMinionGroupTemporary(
	combatant: Combatant.Implementation | null | undefined,
): boolean {
	if (!isMinionCombatant(combatant)) return false;

	const { temporary } = getMinionGroupFlagData(combatant);
	return temporary === true;
}

export function isExplicitMinionGroupLeader(
	combatant: Combatant.Implementation | null | undefined,
): boolean {
	return getMinionGroupRole(combatant) === 'leader' && getMinionGroupId(combatant) !== null;
}

export function getMinionGroupSummaries(
	combatants: Combatant.Implementation[],
): Map<string, MinionGroupSummary> {
	const summaries = new Map<string, MinionGroupSummary>();

	for (const combatant of combatants) {
		const groupId = getMinionGroupId(combatant);
		if (!groupId) continue;

		let summary = summaries.get(groupId);
		if (!summary) {
			summary = {
				id: groupId,
				members: [],
				explicitLeader: null,
				aliveMembers: [],
				deadMembers: [],
			};
			summaries.set(groupId, summary);
		}

		summary.members.push(combatant);
	}

	for (const summary of summaries.values()) {
		const sortedMembers = sortCombatantsForGroupResolution(summary.members);
		const explicitLeaders = sortedMembers.filter((member) => isExplicitMinionGroupLeader(member));

		summary.members = sortedMembers;
		summary.explicitLeader = explicitLeaders[0] ?? null;
		summary.aliveMembers = sortedMembers.filter((member) => !isCombatantDead(member));
		summary.deadMembers = sortedMembers.filter((member) => isCombatantDead(member));
	}

	return summaries;
}

export function getEffectiveMinionGroupLeader(
	summary: MinionGroupSummary,
	options: { aliveOnly?: boolean } = {},
): Combatant.Implementation | null {
	const { aliveOnly = false } = options;
	const candidatePool = aliveOnly ? summary.aliveMembers : summary.members;
	if (candidatePool.length === 0) return null;

	if (
		summary.explicitLeader &&
		candidatePool.some((member) => member.id === summary.explicitLeader?.id)
	) {
		return summary.explicitLeader;
	}

	return candidatePool[0] ?? null;
}
