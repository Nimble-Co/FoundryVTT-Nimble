import { isCombatantDead } from '../../utils/isCombatantDead.js';
import {
	getEffectiveMinionGroupLeader,
	getMinionGroupId,
	getMinionGroupSummaries,
	isMinionCombatant,
	isMinionGrouped,
	MINION_GROUP_FLAG_ROOT,
	MINION_GROUP_ID_PATH,
	MINION_GROUP_ROLE_PATH,
	MINION_GROUP_TEMPORARY_PATH,
} from '../../utils/minionGrouping.js';
import { getCombatantManualSortValue } from './combatantSystem.js';
import { logMinionGroupingCombat, normalizeUniqueIds } from './combatCommon.js';
import type { TurnIdentity } from './combatTypes.js';

export type SyncTurnToCombatant = (
	combatantIdOrIdentity: string | TurnIdentity | null | undefined,
	options?: { persist?: boolean },
) => Promise<void>;

function resolveCombatantsByIds(combat: Combat, ids: string[]): Combatant.Implementation[] {
	const seen = new Set<string>();
	const resolved: Combatant.Implementation[] = [];

	for (const id of ids) {
		if (!id || seen.has(id)) continue;
		seen.add(id);

		const combatant = combat.combatants.get(id);
		if (!combatant) continue;
		if (combatant.parent?.id !== combat.id) continue;
		resolved.push(combatant);
	}

	return resolved;
}

function resolveAliveMinionMembersByIds(
	combat: Combat,
	memberCombatantIds: string[],
): Combatant.Implementation[] {
	return resolveCombatantsByIds(combat, normalizeUniqueIds(memberCombatantIds)).filter(
		(member) => isMinionCombatant(member) && !isCombatantDead(member),
	);
}

function setCombatantUpdate(
	updatesById: Map<string, Record<string, unknown>>,
	combatantId: string,
	update: Record<string, unknown>,
): void {
	const current = updatesById.get(combatantId) ?? { _id: combatantId };
	updatesById.set(combatantId, { ...current, ...update });
}

function collectRemainingGroupMembers(
	combat: Combat,
	groupId: string,
	selectedMemberIds: ReadonlySet<string>,
): Combatant.Implementation[] {
	return combat.combatants.contents.filter((combatant) => {
		const combatantId = combatant.id ?? '';
		if (!combatantId) return false;
		if (selectedMemberIds.has(combatantId)) return false;
		if (!isMinionCombatant(combatant)) return false;
		return getMinionGroupId(combatant) === groupId;
	});
}

function applyGroupDetachmentUpdate(
	groupId: string,
	remainingMembers: Combatant.Implementation[],
	updatesById: Map<string, Record<string, unknown>>,
): void {
	if (remainingMembers.length <= 1) {
		for (const member of remainingMembers) {
			if (!member.id) continue;
			setCombatantUpdate(updatesById, member.id, { [MINION_GROUP_FLAG_ROOT]: null });
		}
		return;
	}

	const summary = getMinionGroupSummaries(remainingMembers).get(groupId);
	if (!summary) return;
	const nextLeader =
		getEffectiveMinionGroupLeader(summary, { aliveOnly: true }) ??
		getEffectiveMinionGroupLeader(summary);
	if (!nextLeader?.id) return;

	for (const member of remainingMembers) {
		if (!member.id) continue;
		setCombatantUpdate(updatesById, member.id, {
			[MINION_GROUP_ID_PATH]: groupId,
			[MINION_GROUP_ROLE_PATH]: member.id === nextLeader.id ? 'leader' : 'member',
			[MINION_GROUP_TEMPORARY_PATH]: true,
		});
	}
}

function buildTemporaryGroupUpdates(
	orderedMembers: Combatant.Implementation[],
	leaderId: string,
	temporaryGroupId: string,
	sharedInitiative: number,
	sharedSort: number,
): Record<string, unknown>[] {
	return orderedMembers.reduce<Record<string, unknown>[]>((acc, member) => {
		if (!member.id) return acc;
		acc.push({
			_id: member.id,
			[MINION_GROUP_ID_PATH]: temporaryGroupId,
			[MINION_GROUP_ROLE_PATH]: member.id === leaderId ? 'leader' : 'member',
			[MINION_GROUP_TEMPORARY_PATH]: true,
			initiative: sharedInitiative,
			'system.sort': sharedSort,
		});
		return acc;
	}, []);
}

function resolveDesiredActiveIdAfterRegroup(params: {
	previousActiveCombatantId: string | null | undefined;
	leaderId: string;
	orderedMembers: Combatant.Implementation[];
}): string | null | undefined {
	const regroupedIds = new Set(
		params.orderedMembers
			.map((member) => member.id)
			.filter((memberId): memberId is string => typeof memberId === 'string'),
	);
	return params.previousActiveCombatantId && regroupedIds.has(params.previousActiveCombatantId)
		? params.leaderId
		: params.previousActiveCombatantId;
}

function sortCombatantsByCurrentTurnOrder(
	turns: Combatant.Implementation[],
	combatants: Combatant.Implementation[],
): Combatant.Implementation[] {
	const turnOrder = new Map<string, number>();
	for (const [index, turnCombatant] of turns.entries()) {
		if (turnCombatant.id) turnOrder.set(turnCombatant.id, index);
	}

	return [...combatants].sort((a, b) => {
		const turnIndexA = turnOrder.get(a.id ?? '') ?? Number.POSITIVE_INFINITY;
		const turnIndexB = turnOrder.get(b.id ?? '') ?? Number.POSITIVE_INFINITY;
		const turnOrderDiff = turnIndexA - turnIndexB;
		if (turnOrderDiff !== 0) return turnOrderDiff;

		const manualSortDiff = getCombatantManualSortValue(a) - getCombatantManualSortValue(b);
		if (manualSortDiff !== 0) return manualSortDiff;

		const initiativeDiff =
			Number(b.initiative ?? Number.NEGATIVE_INFINITY) -
			Number(a.initiative ?? Number.NEGATIVE_INFINITY);
		if (initiativeDiff !== 0) return initiativeDiff;

		return (a.name ?? '').localeCompare(b.name ?? '');
	});
}

async function detachMembersFromExistingMinionGroups(
	combat: Combat,
	memberCombatantIds: string[],
): Promise<void> {
	const selectedMemberIds = new Set(normalizeUniqueIds(memberCombatantIds));
	if (selectedMemberIds.size === 0) return;

	const groupedSelectedMinions = combat.combatants.contents.filter(
		(combatant) =>
			Boolean(combatant.id) &&
			selectedMemberIds.has(combatant.id as string) &&
			isMinionCombatant(combatant) &&
			isMinionGrouped(combatant),
	);
	if (groupedSelectedMinions.length === 0) return;

	const affectedGroupIds = new Set(
		normalizeUniqueIds(groupedSelectedMinions.map(getMinionGroupId)),
	);
	const updatesById = new Map<string, Record<string, unknown>>();

	for (const combatant of groupedSelectedMinions) {
		const combatantId = combatant.id;
		if (!combatantId) continue;
		setCombatantUpdate(updatesById, combatantId, { [MINION_GROUP_FLAG_ROOT]: null });
	}

	for (const groupId of affectedGroupIds) {
		const remainingMembers = collectRemainingGroupMembers(combat, groupId, selectedMemberIds);
		applyGroupDetachmentUpdate(groupId, remainingMembers, updatesById);
	}

	const updates = [...updatesById.values()];
	if (updates.length === 0) return;

	await combat.updateEmbeddedDocuments('Combatant', updates);
	combat.turns = combat.setupTurns();
}

async function dissolveMinionGroupsByIds(params: {
	combat: Combat;
	groupIds: string[];
	reason: string;
	resolveCurrentTurnIdentity: () => TurnIdentity | null;
	syncTurnToCombatant: SyncTurnToCombatant;
}): Promise<Combatant.Implementation[]> {
	const targetGroupIds = new Set(
		params.groupIds
			.map((groupId) => groupId?.trim() ?? '')
			.filter((groupId): groupId is string => groupId.length > 0),
	);
	if (targetGroupIds.size === 0) return [];

	const previousActiveTurnIdentity = params.resolveCurrentTurnIdentity();
	const updates = params.combat.combatants.contents.reduce<Record<string, unknown>[]>(
		(acc, combatant) => {
			if (!combatant.id || !isMinionCombatant(combatant)) return acc;

			const groupId = getMinionGroupId(combatant);
			if (!groupId || !targetGroupIds.has(groupId)) return acc;

			acc.push({
				_id: combatant.id,
				[MINION_GROUP_FLAG_ROOT]: null,
			});
			return acc;
		},
		[],
	);
	if (updates.length === 0) return [];

	const updated = await params.combat.updateEmbeddedDocuments('Combatant', updates);
	params.combat.turns = params.combat.setupTurns();
	await params.syncTurnToCombatant(previousActiveTurnIdentity);
	logMinionGroupingCombat('dissolved minion groups', {
		combatId: params.combat.id ?? null,
		groupIds: [...targetGroupIds],
		reason: params.reason,
	});
	return updated ?? [];
}

export async function dissolveRoundBoundaryMinionGroups(params: {
	combat: Combat;
	resolveCurrentTurnIdentity: () => TurnIdentity | null;
	syncTurnToCombatant: SyncTurnToCombatant;
}): Promise<void> {
	if (!game.user?.isGM) return;

	const groupIdsToDissolve = [...getMinionGroupSummaries(params.combat.combatants.contents).keys()];
	if (groupIdsToDissolve.length === 0) return;

	await dissolveMinionGroupsByIds({
		combat: params.combat,
		groupIds: groupIdsToDissolve,
		reason: 'ncsModeRoundBoundary',
		resolveCurrentTurnIdentity: params.resolveCurrentTurnIdentity,
		syncTurnToCombatant: params.syncTurnToCombatant,
	});
	logMinionGroupingCombat('dissolved round-boundary minion groups', {
		combatId: params.combat.id ?? null,
		groupIds: groupIdsToDissolve,
		reason: 'ncsModeRoundBoundary',
	});
}

export async function assignNcsTemporaryGroupFromAttackMembers(params: {
	combat: Combat;
	turns: Combatant.Implementation[];
	memberCombatantIds: string[];
	resolveCurrentTurnIdentity: () => TurnIdentity | null;
	syncTurnToCombatant: SyncTurnToCombatant;
}): Promise<void> {
	if (!game.user?.isGM) return;

	const scopedMemberIds = normalizeUniqueIds(params.memberCombatantIds);
	if (scopedMemberIds.length < 2) return;

	const scopedMembers = resolveAliveMinionMembersByIds(params.combat, scopedMemberIds);
	if (scopedMembers.length < 2) return;

	await detachMembersFromExistingMinionGroups(params.combat, scopedMemberIds);

	const refreshedMembers = resolveAliveMinionMembersByIds(params.combat, scopedMemberIds);
	if (refreshedMembers.length < 2) return;

	const orderedMembers = sortCombatantsByCurrentTurnOrder(params.turns, refreshedMembers);
	const leader = orderedMembers[0];
	if (!leader?.id) return;

	const previousActiveTurnIdentity = params.resolveCurrentTurnIdentity();
	const temporaryGroupId = foundry.utils.randomID();
	const sharedInitiative = Number(leader.initiative ?? 0);
	const sharedSort = getCombatantManualSortValue(leader);

	const updates = buildTemporaryGroupUpdates(
		orderedMembers,
		leader.id,
		temporaryGroupId,
		sharedInitiative,
		sharedSort,
	);
	if (updates.length === 0) return;

	await params.combat.updateEmbeddedDocuments('Combatant', updates);
	params.combat.turns = params.combat.setupTurns();

	const desiredActiveId = resolveDesiredActiveIdAfterRegroup({
		previousActiveCombatantId: previousActiveTurnIdentity?.combatantId,
		leaderId: leader.id,
		orderedMembers,
	});
	await params.syncTurnToCombatant(
		desiredActiveId && previousActiveTurnIdentity?.combatantId === desiredActiveId
			? previousActiveTurnIdentity
			: desiredActiveId,
		{ persist: false },
	);

	logMinionGroupingCombat('assigned ncs temporary attack group', {
		combatId: params.combat.id ?? null,
		groupId: temporaryGroupId,
		leaderId: leader.id,
		memberIds: orderedMembers.map((member) => member.id),
		sharedInitiative,
		sharedSort,
	});
}
