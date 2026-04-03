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

function getCombatantId(
	combatant: { id?: string | null; _id?: string | null } | null | undefined,
): string {
	return combatant?.id ?? combatant?._id ?? '';
}

function parseDatasetCombatantIds(value: string | undefined): string[] {
	return [
		...new Set(
			(value ?? '')
				.split(',')
				.map((entry) => entry.trim())
				.filter((entry) => entry.length > 0),
		),
	];
}

export function sortCombatants(a: Combatant.Implementation, b: Combatant.Implementation): number {
	const deadStateDiff = Number(isCombatantDead(a)) - Number(isCombatantDead(b));
	if (deadStateDiff !== 0) return deadStateDiff;

	const sa = getCombatantManualSortValue(a);
	const sb = getCombatantManualSortValue(b);
	const manualSortDiff = sa - sb;
	if (manualSortDiff !== 0) return manualSortDiff;

	const typePriorityDiff = getCombatantTypePriority(a) - getCombatantTypePriority(b);
	if (typePriorityDiff !== 0) return typePriorityDiff;

	return (a.name ?? '').localeCompare(b.name ?? '');
}

function resolveDropSource(params: {
	combat: Combat;
	dropData: Record<string, string>;
	trackerListElement: HTMLElement | null;
}): {
	source: Combatant.Implementation;
	sourceCombatants: Combatant.Implementation[];
} | null {
	const { combat } = params;
	const sourceCombatantIds = parseDatasetCombatantIds(
		params.trackerListElement?.dataset.dragSourceCombatantIds,
	);
	if (sourceCombatantIds.length > 0) {
		const sourceCombatants = sourceCombatantIds
			.map((combatantId) => combat.combatants.get(combatantId) ?? null)
			.filter((combatant): combatant is Combatant.Implementation => Boolean(combatant));
		if (sourceCombatants.length !== sourceCombatantIds.length) return null;
		if (
			sourceCombatants.some(
				(combatant) =>
					combatant.parent?.id !== combat.id ||
					isCombatantDead(combatant) ||
					!canCurrentUserReorderCombatant(combatant),
			)
		) {
			return null;
		}

		const source = sourceCombatants[0];
		if (!source) return null;
		return { source, sourceCombatants };
	}

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
	return { source, sourceCombatants: [source] };
}

function resolveDropTargetFromEvent(params: { combat: Combat; event: DragCombatEvent }): {
	target: Combatant.Implementation | null;
	targetCombatantIds: string[];
	sortBefore: boolean | null;
} {
	const dropTargetElement = (params.event.target as HTMLElement).closest<HTMLElement>(
		'[data-combatant-id]',
	);
	const targetId = dropTargetElement?.dataset.combatantId ?? '';
	const target = targetId ? (params.combat.combatants.get(targetId) ?? null) : null;
	if (!target || !dropTargetElement) {
		return { target, targetCombatantIds: [], sortBefore: null };
	}

	const rect = dropTargetElement.getBoundingClientRect();
	return {
		target,
		targetCombatantIds: targetId ? [targetId] : [],
		sortBefore: params.event.y < rect.top + rect.height / 2,
	};
}

function resolveDropTargetFromTrackerFallback(params: {
	combat: Combat;
	trackerListElement: HTMLElement | null;
}): {
	target: Combatant.Implementation | null;
	targetCombatantIds: string[];
	sortBefore: boolean | null;
} {
	const targetCombatantIds = parseDatasetCombatantIds(
		params.trackerListElement?.dataset.dropTargetCombatantIds,
	);
	const legacyTargetId = params.trackerListElement?.dataset.dropTargetId ?? '';
	const normalizedTargetCombatantIds =
		targetCombatantIds.length > 0 ? targetCombatantIds : legacyTargetId ? [legacyTargetId] : [];
	if (normalizedTargetCombatantIds.length < 1) {
		return { target: null, targetCombatantIds: [], sortBefore: null };
	}

	const target = params.combat.combatants.get(normalizedTargetCombatantIds[0]) ?? null;
	if (!target) return { target: null, targetCombatantIds: [], sortBefore: null };
	return {
		target,
		targetCombatantIds: normalizedTargetCombatantIds,
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
	const { target, targetCombatantIds, sortBefore } = eventTargetResolution.target
		? eventTargetResolution
		: resolveDropTargetFromTrackerFallback({
				combat: params.combat,
				trackerListElement: params.trackerListElement,
			});
	if (!target) return null;
	if (isCombatantDead(target)) return null;
	if (targetCombatantIds.length < 1) return null;

	const resolvedTargetCombatants = targetCombatantIds.map((combatantId) =>
		params.combat.combatants.get(combatantId),
	);
	if (resolvedTargetCombatants.some((combatant) => !combatant || isCombatantDead(combatant))) {
		return null;
	}
	if (sortBefore === null) return null;
	return { target, targetCombatantIds, sortBefore };
}

function isValidDropPair(
	sourceCombatants: Combatant.Implementation[],
	targetCombatantIds: string[],
	target: Combatant.Implementation,
): boolean {
	if (
		sourceCombatants.some((sourceCombatant) =>
			targetCombatantIds.includes(getCombatantId(sourceCombatant)),
		)
	) {
		return false;
	}

	if (game.user?.isGM) return true;
	if (sourceCombatants.length !== 1 || targetCombatantIds.length !== 1) return false;

	const source = sourceCombatants[0];
	if (source.id === target.id) return false;
	return source.type === 'character' && target.type === 'character';
}

function resolveDropSiblings(params: {
	turns: Combatant.Implementation[];
	sourceCombatants: Combatant.Implementation[];
}): Combatant.Implementation[] {
	const enforcePlayerSectionOnly = !game.user?.isGM;
	const seenCombatantIds = new Set<string>();
	const sourceCombatantIds = new Set(
		params.sourceCombatants
			.map((combatant) => getCombatantId(combatant))
			.filter((combatantId) => combatantId.length > 0),
	);
	return params.turns.filter((combatant) => {
		const combatantId = getCombatantId(combatant);
		if (!combatantId || seenCombatantIds.has(combatantId)) return false;
		seenCombatantIds.add(combatantId);
		if (sourceCombatantIds.has(combatantId)) return false;
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
	const sourceResolution = resolveDropSource({
		combat: params.combat,
		dropData,
		trackerListElement,
	});
	if (!sourceResolution) return null;

	const dropTargetResolution = resolveDropTarget({
		combat: params.combat,
		event: params.event,
		trackerListElement,
	});
	if (!dropTargetResolution) return null;
	if (
		!isValidDropPair(
			sourceResolution.sourceCombatants,
			dropTargetResolution.targetCombatantIds,
			dropTargetResolution.target,
		)
	) {
		return null;
	}

	const siblings = resolveDropSiblings({
		turns: params.turns,
		sourceCombatants: sourceResolution.sourceCombatants,
	});
	return {
		source: sourceResolution.source,
		sourceCombatants: sourceResolution.sourceCombatants,
		target: dropTargetResolution.target,
		targetCombatantIds: dropTargetResolution.targetCombatantIds,
		siblings,
		sortBefore: dropTargetResolution.sortBefore,
		previousActiveTurnIdentity: params.previousActiveTurnIdentity,
	};
}

function shouldUseBlockSort(dropResolution: DropResolution): boolean {
	return dropResolution.sourceCombatants.length > 1 || dropResolution.targetCombatantIds.length > 1;
}

function buildBlockSortUpdateData(
	dropResolution: DropResolution,
): Array<Record<string, unknown>> | null {
	const targetCombatantIdSet = new Set(dropResolution.targetCombatantIds);
	const targetIndexes = dropResolution.siblings.reduce<number[]>((indexes, combatant, index) => {
		const combatantId = getCombatantId(combatant);
		if (combatantId && targetCombatantIdSet.has(combatantId)) indexes.push(index);
		return indexes;
	}, []);
	if (targetIndexes.length < 1) return null;

	const insertIndex = dropResolution.sortBefore
		? targetIndexes[0]
		: targetIndexes[targetIndexes.length - 1] + 1;
	const reorderedCombatants = [...dropResolution.siblings];
	reorderedCombatants.splice(insertIndex, 0, ...dropResolution.sourceCombatants);

	const updateData: Array<Record<string, unknown>> = [];
	for (const [index, combatant] of reorderedCombatants.entries()) {
		const combatantId = getCombatantId(combatant);
		if (!combatantId) continue;
		updateData.push({
			_id: combatantId,
			'system.sort': index + 1,
		});
	}
	return updateData;
}

export async function applyGmSort(params: {
	combat: Combat;
	dropResolution: DropResolution;
	syncTurnToCombatant: SyncTurnToCombatant;
}) {
	if (shouldUseBlockSort(params.dropResolution)) {
		const updateData = buildBlockSortUpdateData(params.dropResolution);
		if (!updateData || updateData.length < 1) return false;

		const updates = await params.combat.updateEmbeddedDocuments('Combatant', updateData);
		params.combat.turns = params.combat.setupTurns();
		await params.syncTurnToCombatant(params.dropResolution.previousActiveTurnIdentity);
		return updates;
	}

	// Perform the sort with full integer normalization for GM reorders.
	type SortableCombatant = Combatant.Implementation & { id: string };
	const sortUpdates = foundry.utils.performIntegerSort(
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
