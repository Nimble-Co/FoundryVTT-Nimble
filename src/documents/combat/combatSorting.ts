import {
	canCurrentUserReorderCombatant,
	getCombatantTypePriority,
} from '../../utils/combatantOrdering.js';
import { isCombatantDead } from '../../utils/isCombatantDead.js';
import { getCombatantManualSortValue } from './combatantSystem.js';
import { getSourceSortValueForDrop } from './combatCommon.js';
import type { DropResolution, DropTargetResolution, TurnIdentity } from './combatTypes.js';

type DragCombatEvent = DragEvent & { target: EventTarget & HTMLElement };

export type SyncTurnToCombatant = (
	combatantIdOrIdentity: string | TurnIdentity | null | undefined,
	options?: { persist?: boolean },
) => Promise<void>;

export function sortCombatants(a: Combatant.Implementation, b: Combatant.Implementation): number {
	const typePriorityDiff = getCombatantTypePriority(a) - getCombatantTypePriority(b);
	if (typePriorityDiff !== 0) return typePriorityDiff;

	const deadStateDiff = Number(isCombatantDead(a)) - Number(isCombatantDead(b));
	if (deadStateDiff !== 0) return deadStateDiff;

	const sa = getCombatantManualSortValue(a);
	const sb = getCombatantManualSortValue(b);
	const manualSortDiff = sa - sb;
	if (manualSortDiff !== 0) return manualSortDiff;

	const initiativeA = Number(a.initiative ?? Number.NEGATIVE_INFINITY);
	const initiativeB = Number(b.initiative ?? Number.NEGATIVE_INFINITY);
	const initiativeDiff = initiativeB - initiativeA;
	if (initiativeDiff !== 0) return initiativeDiff;

	return (a.name ?? '').localeCompare(b.name ?? '');
}

function resolveDropSource(params: {
	combat: Combat;
	dropData: Record<string, string>;
	trackerListElement: HTMLElement | null;
}): Combatant.Implementation | null {
	const { combat } = params;
	let source = fromUuidSync(
		params.dropData.uuid as `Combatant.${string}`,
	) as Combatant.Implementation | null;
	if (!source && params.trackerListElement?.dataset.dragSourceId) {
		source = combat.combatants.get(params.trackerListElement.dataset.dragSourceId) ?? null;
	}
	if (!source) return null;
	if (source.parent?.id !== combat.id) return null;
	if (isCombatantDead(source)) return null;
	if (!canCurrentUserReorderCombatant(source)) return null;
	return source;
}

function resolveDropTargetFromEvent(params: { combat: Combat; event: DragCombatEvent }): {
	target: Combatant.Implementation | null;
	sortBefore: boolean | null;
} {
	const dropTargetElement = (params.event.target as HTMLElement).closest<HTMLElement>(
		'[data-combatant-id]',
	);
	const targetId = dropTargetElement?.dataset.combatantId ?? '';
	const target = targetId ? (params.combat.combatants.get(targetId) ?? null) : null;
	if (!target || !dropTargetElement) {
		return { target, sortBefore: null };
	}

	const rect = dropTargetElement.getBoundingClientRect();
	return {
		target,
		sortBefore: params.event.y < rect.top + rect.height / 2,
	};
}

function resolveDropTargetFromTrackerFallback(params: {
	combat: Combat;
	trackerListElement: HTMLElement | null;
}): {
	target: Combatant.Implementation | null;
	sortBefore: boolean | null;
} {
	const targetId = params.trackerListElement?.dataset.dropTargetId ?? '';
	if (!targetId) return { target: null, sortBefore: null };

	const target = params.combat.combatants.get(targetId) ?? null;
	if (!target) return { target: null, sortBefore: null };
	return {
		target,
		sortBefore: params.trackerListElement?.dataset.dropBefore === 'true',
	};
}

function resolveDropTarget(params: {
	combat: Combat;
	event: DragCombatEvent;
	trackerListElement: HTMLElement | null;
}): DropTargetResolution | null {
	const eventTargetResolution = resolveDropTargetFromEvent({
		combat: params.combat,
		event: params.event,
	});
	const { target, sortBefore } = eventTargetResolution.target
		? eventTargetResolution
		: resolveDropTargetFromTrackerFallback({
				combat: params.combat,
				trackerListElement: params.trackerListElement,
			});
	if (!target) return null;
	if (isCombatantDead(target)) return null;
	if (sortBefore === null) return null;
	return { target, sortBefore };
}

function isValidDropPair(
	source: Combatant.Implementation,
	target: Combatant.Implementation,
): boolean {
	if (source.id === target.id) return false;
	if (game.user?.isGM) return true;
	return source.type === 'character' && target.type === 'character';
}

function resolveDropSiblings(params: {
	turns: Combatant.Implementation[];
	source: Combatant.Implementation;
}): Combatant.Implementation[] {
	const enforcePlayerSectionOnly = !game.user?.isGM;
	const seenCombatantIds = new Set<string>();
	return params.turns.filter((combatant) => {
		const combatantId = combatant.id ?? '';
		if (!combatantId || seenCombatantIds.has(combatantId)) return false;
		seenCombatantIds.add(combatantId);
		if (combatantId === params.source.id) return false;
		if (isCombatantDead(combatant)) return false;
		return !enforcePlayerSectionOnly || combatant.type === 'character';
	});
}

export function resolveDropContext(params: {
	combat: Combat;
	turns: Combatant.Implementation[];
	event: DragCombatEvent;
	previousActiveTurnIdentity: TurnIdentity | null;
}): DropResolution | null {
	const trackerListElement =
		(params.event.target as HTMLElement).closest<HTMLElement>('[data-nimble-combat-drop-target]') ??
		(params.event.target as HTMLElement).closest<HTMLElement>('.nimble-combatants');
	const dropData = foundry.applications.ux.TextEditor.implementation.getDragEventData(
		params.event,
	) as unknown as Record<string, string>;
	const source = resolveDropSource({
		combat: params.combat,
		dropData,
		trackerListElement,
	});
	if (!source) return null;

	const dropTargetResolution = resolveDropTarget({
		combat: params.combat,
		event: params.event,
		trackerListElement,
	});
	if (!dropTargetResolution) return null;
	if (!isValidDropPair(source, dropTargetResolution.target)) return null;

	const siblings = resolveDropSiblings({ turns: params.turns, source });
	return {
		source,
		target: dropTargetResolution.target,
		siblings,
		sortBefore: dropTargetResolution.sortBefore,
		previousActiveTurnIdentity: params.previousActiveTurnIdentity,
	};
}

export async function applyGmSort(params: {
	combat: Combat;
	dropResolution: DropResolution;
	syncTurnToCombatant: SyncTurnToCombatant;
}) {
	// Perform the sort with full integer normalization for GM reorders.
	type SortableCombatant = Combatant.Implementation & { id: string };
	const sortUpdates = SortingHelpers.performIntegerSort(
		params.dropResolution.source as SortableCombatant,
		{
			target: params.dropResolution.target as SortableCombatant | null,
			siblings: params.dropResolution.siblings as SortableCombatant[],
			sortKey: 'system.sort',
			sortBefore: params.dropResolution.sortBefore,
		},
	);

	const updateData = sortUpdates.map((updateEntry) => {
		const { update } = updateEntry;
		return {
			...update,
			_id: updateEntry.target.id,
		};
	});

	const updates = await params.combat.updateEmbeddedDocuments('Combatant', updateData);
	params.combat.turns = params.combat.setupTurns();
	await params.syncTurnToCombatant(params.dropResolution.previousActiveTurnIdentity);
	return updates;
}

export async function applyOwnerSort(params: {
	combat: Combat;
	dropResolution: DropResolution;
	syncTurnToCombatant: SyncTurnToCombatant;
}) {
	// Non-GM owners can reorder their own character card by updating only their card's sort value.
	const newSortValue = getSourceSortValueForDrop(
		params.dropResolution.source,
		params.dropResolution.target,
		params.dropResolution.siblings,
		params.dropResolution.sortBefore,
	);
	if (newSortValue === null || !Number.isFinite(newSortValue)) return false;

	const updated = await params.dropResolution.source.update({
		'system.sort': newSortValue,
	} as Record<string, unknown>);
	params.combat.turns = params.combat.setupTurns();
	await params.syncTurnToCombatant(params.dropResolution.previousActiveTurnIdentity, {
		persist: false,
	});
	return updated ? [updated] : [];
}
