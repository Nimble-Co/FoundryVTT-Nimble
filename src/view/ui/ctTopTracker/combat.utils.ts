import type { TurnIdentity } from '../../../documents/combat/combatTypes.js';
import {
	getExpandedTurnIdentityHint,
	getPersistedExpandedTurnIdentity,
	setExpandedTurnIdentityHint,
} from '../../../documents/combat/expandedTurnIdentityStore.js';
import {
	getCombatantCurrentActions,
	getCombatantMaxActions,
} from '../../../utils/combatTurnActions.js';
import { hasCombatantTurnEndedThisRound } from '../../../utils/combatTurnProgress.js';
import { getHeroicReactionAvailability } from '../../../utils/heroicActions.js';
import { initiativeRollLock } from '../../../utils/initiativeRollLock.js';
import { isCombatantDead } from '../../../utils/isCombatantDead.js';
import { isCombatStarted } from '../../../utils/isCombatStarted.js';
import {
	getEffectiveMinionGroupLeader,
	getMinionGroupId,
	getMinionGroupSummaries,
} from '../../../utils/minionGrouping.js';
import type { ResolveActiveEntryKeyParams, SceneCombatantLists, TrackEntry } from './types.js';

type CombatWithTurnIdentityHint = Combat & {
	_nimbleExpandedTurnIdentity?: TurnIdentity | null;
};

function sortDeadCombatants(
	left: Combatant.Implementation,
	right: Combatant.Implementation,
): number {
	const typeDiff =
		Number(isMonsterOrMinionCombatant(left)) - Number(isMonsterOrMinionCombatant(right));
	if (typeDiff !== 0) return typeDiff;
	return (left.name ?? '').localeCompare(right.name ?? '');
}

function resolveCurrentTurnIdentity(
	combat: Combat,
	existingTurns: Combatant.Implementation[],
): TurnIdentity | null {
	if (!isCombatStarted(combat)) return null;

	const combatWithHint = combat as CombatWithTurnIdentityHint;
	const persistedTurnIdentity = getPersistedExpandedTurnIdentity(combat);
	if (persistedTurnIdentity) return persistedTurnIdentity;

	if (combatWithHint._nimbleExpandedTurnIdentity) {
		return combatWithHint._nimbleExpandedTurnIdentity;
	}

	const storedTurnIdentity = getExpandedTurnIdentityHint(combat.id ?? null);
	if (storedTurnIdentity) return storedTurnIdentity;

	const normalizedCurrentTurn =
		typeof combat.turn === 'number' && combat.turn >= 0 && combat.turn < existingTurns.length
			? combat.turn
			: null;
	const indexedCombatantId =
		normalizedCurrentTurn !== null ? getCombatantId(existingTurns[normalizedCurrentTurn]) : '';
	if (indexedCombatantId && normalizedCurrentTurn !== null) {
		return {
			combatantId: indexedCombatantId,
			occurrence: getCombatantOccurrenceAtIndex(
				existingTurns,
				indexedCombatantId,
				normalizedCurrentTurn,
			),
		};
	}

	const explicitCombatantId = getCombatantId(combat.combatant);
	if (explicitCombatantId) {
		return { combatantId: explicitCombatantId, occurrence: null };
	}

	return null;
}

function shouldExcludeNonTurnCombatantFromCtTrack(
	combatant: Combatant.Implementation,
	groupSummaries: ReturnType<typeof getMinionGroupSummaries>,
): boolean {
	const groupId = getMinionGroupId(combatant);
	if (!groupId) return false;

	const summary = groupSummaries.get(groupId);
	if (!summary) return false;

	const effectiveLeader = getEffectiveMinionGroupLeader(summary, { aliveOnly: true });
	if (!effectiveLeader?.id) return false;
	return effectiveLeader.id !== (combatant.id ?? '');
}

export function isLegendaryCombatant(combatant: Combatant.Implementation): boolean {
	return combatant.type === 'soloMonster';
}

export function isPlayerCombatant(combatant: Combatant.Implementation): boolean {
	return combatant.type === 'character';
}

export function isMonsterOrMinionCombatant(combatant: Combatant.Implementation): boolean {
	return !isPlayerCombatant(combatant) && !isLegendaryCombatant(combatant);
}

export function getCombatantId(
	combatant: { id?: string | null; _id?: string | null } | null | undefined,
): string {
	return combatant?.id ?? combatant?._id ?? '';
}

export function buildCombatantEntryKey(combatantId: string, occurrence: number): string {
	return `combatant-${combatantId}-${occurrence}`;
}

export function getCombatantOccurrenceAtIndex(
	combatants: Combatant.Implementation[],
	combatantId: string,
	inclusiveIndex: number,
): number {
	let occurrence = -1;
	for (let index = 0; index <= inclusiveIndex && index < combatants.length; index += 1) {
		const id = getCombatantId(combatants[index]);
		if (id === combatantId) occurrence += 1;
	}
	return occurrence;
}

export function findTurnIndexByOccurrence(
	turns: Combatant.Implementation[],
	combatantId: string,
	desiredOccurrence: number | null,
): number {
	let occurrence = -1;
	for (const [index, turnCombatant] of turns.entries()) {
		if (getCombatantId(turnCombatant) !== combatantId) continue;
		occurrence += 1;
		if (desiredOccurrence === null || occurrence === desiredOccurrence) return index;
	}
	return -1;
}

export function syncCombatTurnsForCt(combat: Combat | null): void {
	if (!combat) return;

	const existingTurns = combat.turns;
	const combatWithHint = combat as CombatWithTurnIdentityHint;
	const currentTurnIdentity = resolveCurrentTurnIdentity(combat, existingTurns);

	let normalizedTurns: Combatant.Implementation[];
	try {
		normalizedTurns = combat.setupTurns();
	} catch (_error) {
		return;
	}

	combat.turns = normalizedTurns;
	if (normalizedTurns.length === 0) {
		combat.turn = 0;
		combatWithHint._nimbleExpandedTurnIdentity = null;
		setExpandedTurnIdentityHint(combat.id ?? null, null);
		return;
	}

	if (!isCombatStarted(combat)) {
		combatWithHint._nimbleExpandedTurnIdentity = null;
		setExpandedTurnIdentityHint(combat.id ?? null, null);
		return;
	}

	if (currentTurnIdentity?.combatantId) {
		const matchedIndex = findTurnIndexByOccurrence(
			normalizedTurns,
			currentTurnIdentity.combatantId,
			currentTurnIdentity.occurrence,
		);
		if (matchedIndex >= 0) {
			combat.turn = matchedIndex;
			combatWithHint._nimbleExpandedTurnIdentity = {
				combatantId: currentTurnIdentity.combatantId,
				occurrence: getCombatantOccurrenceAtIndex(
					normalizedTurns,
					currentTurnIdentity.combatantId,
					matchedIndex,
				),
			};
			setExpandedTurnIdentityHint(combat.id ?? null, combatWithHint._nimbleExpandedTurnIdentity);
			return;
		}
	}

	const fallbackTurn = Number.isInteger(combat.turn) ? Number(combat.turn) : 0;
	combat.turn = Math.min(Math.max(fallbackTurn, 0), normalizedTurns.length - 1);
	const fallbackCombatantId = getCombatantId(normalizedTurns[combat.turn]);
	combatWithHint._nimbleExpandedTurnIdentity = fallbackCombatantId
		? {
				combatantId: fallbackCombatantId,
				occurrence: getCombatantOccurrenceAtIndex(
					normalizedTurns,
					fallbackCombatantId,
					combat.turn,
				),
			}
		: null;
	setExpandedTurnIdentityHint(combat.id ?? null, combatWithHint._nimbleExpandedTurnIdentity);
}

export function getCombatantSceneId(combatant: Combatant.Implementation): string | undefined {
	if (combatant.sceneId) return combatant.sceneId;
	if (combatant.token?.parent?.id) return combatant.token.parent.id;

	const sceneId = canvas.scene?.id;
	if (sceneId && combatant.tokenId) {
		const tokenDoc = canvas.scene?.tokens?.get(combatant.tokenId);
		if (tokenDoc) return sceneId;
	}

	return undefined;
}

export function hasCombatantsForScene(combat: Combat, sceneId: string): boolean {
	return combat.combatants.contents.some((combatant) => getCombatantSceneId(combatant) === sceneId);
}

export function isCombatRoundStarted(combat: Combat | null): boolean {
	return (combat?.round ?? 0) > 0;
}

export function getCombatSelectionScore(
	combat: Combat,
	sceneId: string,
	activeCombat: Combat | null,
	viewedCombat: Combat | null,
): number {
	let score = 0;
	if (isCombatStarted(combat)) score += 10000;
	if (combat.round && combat.round > 0) score += Math.min(2000, combat.round * 10);
	if (combat.active) score += 1000;
	if (combat === activeCombat && combat.scene?.id === sceneId) score += 3000;
	if (combat === viewedCombat && combat.scene?.id === sceneId) score += 2000;
	score += Math.min(500, combat.combatants.size * 5);
	return score;
}

export function getCombatForCurrentScene(preferredCombatId: string | null): Combat | null {
	const sceneId = canvas.scene?.id;
	if (!sceneId) return null;

	const activeCombat = game.combat;
	const viewedCombat = game.combats.viewed ?? null;
	const sceneCombats = game.combats.contents.filter((combat) => {
		if (combat.scene?.id === sceneId) return true;
		return hasCombatantsForScene(combat, sceneId);
	});
	if (sceneCombats.length < 1) return null;

	if (preferredCombatId) {
		const preferredCombat = sceneCombats.find(
			(combat) => (combat.id ?? combat._id ?? null) === preferredCombatId,
		);
		if (preferredCombat) return preferredCombat;
	}

	if (activeCombat) {
		const activeCombatId = activeCombat.id ?? activeCombat._id ?? null;
		const activeSceneCombat = sceneCombats.find(
			(combat) => combat === activeCombat || (combat.id ?? combat._id ?? null) === activeCombatId,
		);
		if (activeSceneCombat) return activeSceneCombat;
	}

	if (viewedCombat) {
		const viewedCombatId = viewedCombat.id ?? viewedCombat._id ?? null;
		const viewedSceneCombat = sceneCombats.find(
			(combat) => combat === viewedCombat || (combat.id ?? combat._id ?? null) === viewedCombatId,
		);
		if (viewedSceneCombat) return viewedSceneCombat;
	}

	sceneCombats.sort((left, right) => {
		const leftScore = getCombatSelectionScore(left, sceneId, activeCombat, viewedCombat);
		const rightScore = getCombatSelectionScore(right, sceneId, activeCombat, viewedCombat);
		return rightScore - leftScore;
	});
	return sceneCombats[0] ?? null;
}

export function getCombatantsForScene(
	combat: Combat | null,
	sceneId: string | undefined,
): SceneCombatantLists {
	if (!combat || !sceneId) return { aliveCombatants: [], deadCombatants: [] };

	const groupSummaries = getMinionGroupSummaries(combat.combatants.contents);
	const combatantsForScene = combat.combatants.contents.filter(
		(combatant) =>
			getCombatantSceneId(combatant) === sceneId && combatant.visible && combatant._id != null,
	);
	const turnCombatants = combat.turns
		.map((turnCombatant) => {
			const combatantId = turnCombatant.id ?? turnCombatant._id ?? '';
			if (!combatantId) return null;
			return combat.combatants.get(combatantId) ?? turnCombatant;
		})
		.filter((combatant): combatant is Combatant.Implementation => Boolean(combatant))
		.filter(
			(combatant) =>
				getCombatantSceneId(combatant) === sceneId && combatant.visible && combatant._id != null,
		);
	const turnCombatantIds = new Set(turnCombatants.map((combatant) => combatant.id ?? ''));

	const aliveCombatants = [
		...turnCombatants.filter((combatant) => !isCombatantDead(combatant)),
		...combatantsForScene.filter((combatant) => {
			if (isCombatantDead(combatant)) return false;
			if (shouldExcludeNonTurnCombatantFromCtTrack(combatant, groupSummaries)) return false;
			return !turnCombatantIds.has(combatant.id ?? '');
		}),
	];
	const deadCombatants = combatantsForScene
		.filter((combatant) => isCombatantDead(combatant))
		.sort(sortDeadCombatants);

	return { aliveCombatants, deadCombatants };
}

export function hasCombatantTurnRemainingThisRound(
	combat: Combat | null,
	combatant: Combatant.Implementation,
	groupSummaries?: ReturnType<typeof getMinionGroupSummaries>,
): boolean {
	if (isPlayerCombatant(combatant) || isLegendaryCombatant(combatant)) return true;
	if (!combat) return true;

	const resolvedGroupSummaries =
		groupSummaries ?? getMinionGroupSummaries(combat.combatants.contents);
	return !hasCombatantTurnEndedThisRound(combat, combatant, resolvedGroupSummaries);
}

export function isFriendlyCombatant(combatant: Combatant.Implementation): boolean {
	const tokenDisposition = Number(
		combatant.token?.disposition ?? combatant.token?.object?.document?.disposition ?? NaN,
	);
	return tokenDisposition === CONST.TOKEN_DISPOSITIONS.FRIENDLY;
}

export function isEligibleForInitiativeRoll(combatant: Combatant.Implementation): boolean {
	return combatant.type === 'character' || isFriendlyCombatant(combatant);
}

export function getTrackEntryCombatantId(entry: TrackEntry): string {
	if (entry.kind === 'combatant') return getCombatantId(entry.combatant);
	return getCombatantId(entry.combatants[0]);
}

export function getTrackEntryCombatantIds(entry: TrackEntry): string[] {
	if (entry.kind === 'combatant') {
		const combatantId = getCombatantId(entry.combatant);
		return combatantId ? [combatantId] : [];
	}

	return entry.combatants
		.map((combatant) => getCombatantId(combatant))
		.filter((combatantId): combatantId is string => combatantId.length > 0);
}

function createMonsterStackEntry(
	combatants: Combatant.Implementation[],
	stackIndex: number,
): TrackEntry | null {
	if (combatants.length < 1) return null;
	const firstCombatantId = getCombatantId(combatants[0]) || `group-${stackIndex}`;
	return {
		key: `monster-stack-${firstCombatantId}-${stackIndex}`,
		kind: 'monster-stack',
		combatants,
	};
}

function findTrackEntryContainingCombatantId(
	aliveEntries: TrackEntry[],
	combatantId: string,
): TrackEntry | null {
	return (
		aliveEntries.find((entry) => getTrackEntryCombatantIds(entry).includes(combatantId)) ?? null
	);
}

export function buildAliveEntries(
	combatants: Combatant.Implementation[],
	collapseMonsters: boolean,
): TrackEntry[] {
	const entries: TrackEntry[] = [];
	const occurrenceByCombatantId = new Map<string, number>();
	let pendingMonsterStack: Combatant.Implementation[] = [];
	let monsterStackIndex = 0;

	function flushPendingMonsterStack(): void {
		if (!collapseMonsters) {
			pendingMonsterStack = [];
			return;
		}

		const stackEntry = createMonsterStackEntry(pendingMonsterStack, monsterStackIndex);
		pendingMonsterStack = [];
		if (!stackEntry) return;
		entries.push(stackEntry);
		monsterStackIndex += 1;
	}

	for (const combatant of combatants) {
		if (collapseMonsters && isMonsterOrMinionCombatant(combatant)) {
			pendingMonsterStack.push(combatant);
			continue;
		}

		flushPendingMonsterStack();

		const combatantId = getCombatantId(combatant);
		const occurrence = occurrenceByCombatantId.get(combatantId) ?? 0;
		occurrenceByCombatantId.set(combatantId, occurrence + 1);
		entries.push({
			key: combatantId
				? buildCombatantEntryKey(combatantId, occurrence)
				: `combatant-${entries.length}`,
			kind: 'combatant',
			combatant,
		});
	}

	flushPendingMonsterStack();
	return entries;
}

export function getActiveCombatantId(combat: Combat | null): string | null {
	if (!combat) return null;
	if (!isCombatStarted(combat)) return null;
	const turnIndex = Number(combat.turn ?? -1);
	if (Number.isInteger(turnIndex) && turnIndex >= 0 && turnIndex < combat.turns.length) {
		return combat.turns[turnIndex]?.id ?? null;
	}
	return combat.combatant?.id ?? null;
}

export function getActiveCombatant(combat: Combat | null): Combatant.Implementation | null {
	if (!combat) return null;
	const activeId = getActiveCombatantId(combat);
	if (!activeId) return null;
	return (
		combat.combatants.get(activeId) ??
		combat.turns.find((turnCombatant) => turnCombatant.id === activeId) ??
		null
	);
}

export function getActiveCombatantOccurrence(
	combat: Combat | null,
	activeId: string,
): number | null {
	if (!combat) return null;
	if (!isCombatStarted(combat)) return null;
	const turnIndex = Number(combat.turn ?? -1);
	if (!Number.isInteger(turnIndex) || turnIndex < 0 || turnIndex >= combat.turns.length)
		return null;
	return getCombatantOccurrenceAtIndex(combat.turns, activeId, turnIndex);
}

export function resolveActiveEntryKey(params: ResolveActiveEntryKeyParams): string | null {
	const { activeCombatantId, activeOccurrence, aliveEntries, collapseMonsters } = params;
	if (!activeCombatantId) return null;

	if (collapseMonsters) {
		const monsterStackEntry = findTrackEntryContainingCombatantId(aliveEntries, activeCombatantId);
		if (monsterStackEntry?.kind === 'monster-stack') return monsterStackEntry.key;
	}

	if (activeOccurrence !== null) {
		const activeCombatantKey = buildCombatantEntryKey(activeCombatantId, activeOccurrence);
		if (aliveEntries.some((entry) => entry.key === activeCombatantKey)) return activeCombatantKey;
	}

	const fallbackEntry = aliveEntries.find(
		(entry) => entry.kind === 'combatant' && getTrackEntryCombatantId(entry) === activeCombatantId,
	);
	return fallbackEntry?.key ?? aliveEntries[0]?.key ?? null;
}

export function orderEntriesForCenteredActive(
	entries: TrackEntry[],
	activeKey: string | null,
	centerActiveCards: boolean,
): TrackEntry[] {
	if (!centerActiveCards) return entries;
	if (entries.length <= 1 || !activeKey) return entries;
	const activeIndex = entries.findIndex((entry) => entry.key === activeKey);
	if (activeIndex < 0) return entries;

	const halfLength = Math.floor(entries.length / 2);
	return Array.from({ length: entries.length }, (_value, index) => {
		const sourceIndex = (activeIndex - halfLength + index + entries.length) % entries.length;
		return entries[sourceIndex];
	});
}

export function findRoundBoundaryIndex(
	combat: Combat | null,
	sceneAliveCombatants: Combatant.Implementation[],
): number {
	if (sceneAliveCombatants.length < 1) return -1;
	const groupSummaries = combat ? getMinionGroupSummaries(combat.combatants.contents) : undefined;
	for (let index = sceneAliveCombatants.length - 1; index >= 0; index -= 1) {
		if (hasCombatantTurnRemainingThisRound(combat, sceneAliveCombatants[index], groupSummaries)) {
			return index;
		}
	}
	return sceneAliveCombatants.length - 1;
}

export function getRoundBoundaryKey(
	combat: Combat | null,
	sceneAliveCombatants: Combatant.Implementation[],
	aliveEntries: TrackEntry[],
	collapseMonsters: boolean,
): string | null {
	const boundaryIndex = findRoundBoundaryIndex(combat, sceneAliveCombatants);
	if (boundaryIndex < 0) return null;

	const lastCurrentRoundCombatant = sceneAliveCombatants[boundaryIndex];
	if (!lastCurrentRoundCombatant) return null;

	if (collapseMonsters && isMonsterOrMinionCombatant(lastCurrentRoundCombatant)) {
		const boundaryCombatantId = getCombatantId(lastCurrentRoundCombatant);
		if (!boundaryCombatantId) return null;
		const monsterStackEntry = findTrackEntryContainingCombatantId(
			aliveEntries,
			boundaryCombatantId,
		);
		if (monsterStackEntry?.kind === 'monster-stack') return monsterStackEntry.key;
		return null;
	}

	const combatantId = getCombatantId(lastCurrentRoundCombatant);
	if (!combatantId) return null;
	const occurrence = getCombatantOccurrenceAtIndex(
		sceneAliveCombatants,
		combatantId,
		boundaryIndex,
	);
	return buildCombatantEntryKey(combatantId, occurrence);
}

export function getRoundSeparatorInsertionIndex(
	orderedEntries: TrackEntry[],
	roundBoundaryKey: string | null,
): number {
	if (orderedEntries.length < 1 || !roundBoundaryKey) return -1;
	const boundaryIndex = orderedEntries.findIndex((entry) => entry.key === roundBoundaryKey);
	if (boundaryIndex < 0) return -1;
	return (boundaryIndex + 1) % orderedEntries.length;
}

export function buildCombatSyncSignature(
	combat: Combat | null,
	sceneId: string | undefined,
): string {
	if (!combat || !sceneId) return 'none';

	const combatId = combat.id ?? combat._id ?? 'unknown';
	const started = isCombatStarted(combat) ? 1 : 0;
	const round = Number(combat.round ?? 0);
	const turn = Number(combat.turn ?? -1);
	const activeId = getActiveCombatantId(combat) ?? '';
	const turns = combat.turns
		.filter((combatant) => getCombatantSceneId(combatant) === sceneId)
		.map((combatant) => combatant.id ?? combatant._id ?? '')
		.join(',');
	const actionSummary = combat.combatants.contents
		.filter((combatant) => getCombatantSceneId(combatant) === sceneId)
		.map((combatant) => {
			const currentActions = getCombatantCurrentActions(combatant);
			const maxActions = getCombatantMaxActions(combatant);
			const reactionSummary = (['defend', 'interpose', 'opportunityAttack', 'help'] as const)
				.map((reactionKey) => Number(getHeroicReactionAvailability(combatant, reactionKey)))
				.join('');
			return `${combatant.id ?? combatant._id ?? ''}:${currentActions}:${maxActions}:${Number(isCombatantDead(combatant))}:${reactionSummary}`;
		})
		.join('|');

	return `${combatId}|${started}|${round}|${turn}|${activeId}|${turns}|${actionSummary}`;
}

export function canCurrentUserRollInitiativeForCombatant(
	combatant: Combatant.Implementation,
): boolean {
	if (initiativeRollLock.hasActiveLock(combatant)) return false;
	const currentUser = game.user;
	if (!currentUser) return false;
	if (currentUser.isGM) return true;
	if (!combatant.actor) return false;
	return combatant.actor.testUserPermission(currentUser, CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER);
}

export function shouldShowInitiativePromptForCombatant(
	combatant: Combatant.Implementation,
): boolean {
	if (!isPlayerCombatant(combatant)) return false;
	if (initiativeRollLock.hasActiveLock(combatant)) return false;
	return combatant.initiative == null;
}

export function localizeWithFallback(key: string, fallback: string): string {
	const localized = game.i18n?.localize?.(key);
	if (typeof localized === 'string' && localized !== key) return localized;
	return fallback;
}

export function canCurrentUserAdjustCombatantActions(combatant: Combatant.Implementation): boolean {
	if (isCombatantDead(combatant)) return false;
	if (game.user?.isGM) return true;
	return Boolean(combatant.actor?.isOwner);
}
