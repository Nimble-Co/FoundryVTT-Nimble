import { createSubscriber } from 'svelte/reactivity';
import type { NimbleCombatant } from '../combatant/combatant.svelte.js';
import {
	canCurrentUserReorderCombatant,
	getCombatantTypePriority,
} from '../../utils/combatantOrdering.js';
import { isCombatantDead } from '../../utils/isCombatantDead.js';
import { handleInitiativeRules } from './handleInitiativeRules.js';
import {
	formatMinionGroupLabel,
	getEffectiveMinionGroupLeader,
	getMinionGroupId,
	getMinionGroupLabel,
	getMinionGroupLabelIndex,
	getMinionGroupMemberNumber,
	getMinionGroupRole,
	getMinionGroupSummaries,
	isMinionCombatant,
	isMinionGrouped,
	MINION_GROUP_FLAG_ROOT,
	MINION_GROUP_ID_PATH,
	MINION_GROUP_LABEL_INDEX_PATH,
	MINION_GROUP_LABEL_PATH,
	MINION_GROUP_MEMBER_NUMBER_PATH,
	MINION_GROUP_ROLE_PATH,
} from '../../utils/minionGrouping.js';

const MINION_GROUP_COUNTER_NEXT_LABEL_INDEX_PATH = 'flags.nimble.minionGrouping.nextLabelIndex';

/** Combatant system data with actions */
interface CombatantSystemWithActions {
	actions: {
		base: {
			current: number;
			max: number;
		};
	};
}

function getCombatantManualSortValue(combatant: Combatant.Implementation): number {
	return Number((combatant.system as unknown as { sort?: number }).sort ?? 0);
}

function getSourceSortValueForDrop(
	source: Combatant.Implementation,
	target: Combatant.Implementation,
	siblings: Combatant.Implementation[],
	sortBefore: boolean,
): number | null {
	const targetIndex = siblings.findIndex((combatant) => combatant.id === target.id);
	if (targetIndex < 0) return null;

	const insertIndex = sortBefore ? targetIndex : targetIndex + 1;
	const previous = insertIndex > 0 ? siblings[insertIndex - 1] : null;
	const next = insertIndex < siblings.length ? siblings[insertIndex] : null;

	if (previous && next) {
		const previousSort = getCombatantManualSortValue(previous);
		const nextSort = getCombatantManualSortValue(next);
		if (previousSort === nextSort) {
			return previousSort + (sortBefore ? -0.5 : 0.5);
		}
		return previousSort + (nextSort - previousSort) / 2;
	}

	if (previous) return getCombatantManualSortValue(previous) + 1;
	if (next) return getCombatantManualSortValue(next) - 1;

	return getCombatantManualSortValue(source);
}

function logMinionGroupingCombat(message: string, details: Record<string, unknown> = {}) {
	if ((globalThis as Record<string, unknown>).NIMBLE_DISABLE_GROUP_LOGS === true) return;
	// eslint-disable-next-line no-console
	console.info(`[Nimble][MinionGrouping][Combat] ${message}`, details);
}

class NimbleCombat extends Combat {
	#subscribe: ReturnType<typeof createSubscriber>;

	#resolveCombatantsByIds(ids: string[]): Combatant.Implementation[] {
		const seen = new Set<string>();
		const resolved: Combatant.Implementation[] = [];

		for (const id of ids) {
			if (!id || seen.has(id)) continue;
			seen.add(id);

			const combatant = this.combatants.get(id);
			if (!combatant) continue;
			if (combatant.parent?.id !== this.id) continue;
			resolved.push(combatant);
		}

		return resolved;
	}

	#sortCombatantsByCurrentTurnOrder(
		combatants: Combatant.Implementation[],
	): Combatant.Implementation[] {
		const turnOrder = new Map<string, number>();
		for (const [index, turnCombatant] of this.turns.entries()) {
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

	async #syncTurnToCombatant(
		combatantId: string | null | undefined,
		options: { persist?: boolean } = {},
	): Promise<void> {
		if (!combatantId) return;

		const nextTurnIndex = this.turns.findIndex((turnCombatant) => turnCombatant.id === combatantId);
		if (nextTurnIndex < 0) return;
		const normalizedCurrentTurn = Number.isInteger(this.turn) ? Number(this.turn) : 0;
		if (nextTurnIndex === normalizedCurrentTurn) return;

		// Keep local state consistent immediately; persist for GM-driven operations.
		this.turn = nextTurnIndex;
		const shouldPersist = options.persist ?? true;
		if (!shouldPersist || !game.user?.isGM) return;

		await this.update({ turn: nextTurnIndex });
	}

	#syncTurnIndexWithAliveTurns() {
		const currentCombatantId =
			typeof this.turn === 'number' && this.turn >= 0 && this.turn < this.turns.length
				? (this.turns[this.turn]?.id ?? null)
				: (this.combatant?.id ?? null);

		const aliveTurns = this.setupTurns();
		this.turns = aliveTurns;

		if (aliveTurns.length === 0) {
			this.turn = 0;
			return;
		}

		if (currentCombatantId) {
			const matchedIndex = aliveTurns.findIndex((combatant) => combatant.id === currentCombatantId);
			if (matchedIndex >= 0) {
				this.turn = matchedIndex;
				return;
			}
		}

		const currentTurn = Number.isInteger(this.turn) ? Number(this.turn) : 0;
		this.turn = Math.min(Math.max(currentTurn, 0), aliveTurns.length - 1);
	}
	#getStoredNextMinionGroupLabelIndex(): number {
		const stored = Number(
			foundry.utils.getProperty(this, MINION_GROUP_COUNTER_NEXT_LABEL_INDEX_PATH),
		);
		if (!Number.isFinite(stored) || stored < 0) return 0;
		return Math.floor(stored);
	}

	#getAssignedMinionGroupLabelIndexesFromCombatants(): Set<number> {
		const assignedIndexes = new Set<number>();

		for (const combatant of this.combatants.contents) {
			if (!isMinionCombatant(combatant)) continue;
			if (!getMinionGroupId(combatant)) continue;

			const labelIndex = getMinionGroupLabelIndex(combatant);
			if (typeof labelIndex === 'number') assignedIndexes.add(labelIndex);
		}

		return assignedIndexes;
	}

	#getFirstAvailableMinionGroupLabelIndex(): number {
		const assignedIndexes = this.#getAssignedMinionGroupLabelIndexesFromCombatants();
		let nextAvailable = 0;
		while (assignedIndexes.has(nextAvailable)) nextAvailable += 1;
		return nextAvailable;
	}

	#getNextMinionGroupLabelIndex(): number {
		return this.#getFirstAvailableMinionGroupLabelIndex();
	}

	async #persistNextMinionGroupLabelIndex(nextLabelIndex: number): Promise<void> {
		const normalized = Math.max(0, Math.floor(nextLabelIndex));
		if (this.#getStoredNextMinionGroupLabelIndex() === normalized) return;

		await this.update({
			[MINION_GROUP_COUNTER_NEXT_LABEL_INDEX_PATH]: normalized,
		} as Record<string, unknown>);
	}

	async #resetMinionGroupLabelCounterIfNoGroupsRemain(reason: string): Promise<void> {
		const remainingGroups = getMinionGroupSummaries(this.combatants.contents).size;
		if (remainingGroups > 0) return;

		if (this.#getStoredNextMinionGroupLabelIndex() === 0) return;

		await this.#persistNextMinionGroupLabelIndex(0);
		logMinionGroupingCombat('reset minion group label counter because no groups remain', {
			combatId: this.id ?? null,
			reason,
		});
	}

	#resolveStableGroupMemberNumbers(members: Combatant.Implementation[]): {
		numbersById: Map<string, number>;
		maxMemberNumber: number;
		backfillUpdates: Record<string, unknown>[];
	} {
		const numbersById = new Map<string, number>();
		const usedNumbers = new Set<number>();
		const pendingMembers: Combatant.Implementation[] = [];

		for (const member of members) {
			if (!member.id) continue;

			const existingMemberNumber = getMinionGroupMemberNumber(member);
			if (typeof existingMemberNumber === 'number' && !usedNumbers.has(existingMemberNumber)) {
				numbersById.set(member.id, existingMemberNumber);
				usedNumbers.add(existingMemberNumber);
				continue;
			}

			pendingMembers.push(member);
		}

		let nextMemberNumber = 1;
		const backfillUpdates: Record<string, unknown>[] = [];
		for (const member of pendingMembers) {
			if (!member.id) continue;
			while (usedNumbers.has(nextMemberNumber)) nextMemberNumber += 1;

			numbersById.set(member.id, nextMemberNumber);
			usedNumbers.add(nextMemberNumber);
			backfillUpdates.push({
				_id: member.id,
				[MINION_GROUP_MEMBER_NUMBER_PATH]: nextMemberNumber,
			});
			nextMemberNumber += 1;
		}

		let maxMemberNumber = 0;
		for (const memberNumber of usedNumbers) {
			if (memberNumber > maxMemberNumber) maxMemberNumber = memberNumber;
		}

		return {
			numbersById,
			maxMemberNumber,
			backfillUpdates,
		};
	}
	constructor(
		data?: Combat.CreateData,
		context?: foundry.abstract.Document.ConstructionContext<Combat.Parent>,
	) {
		super(data, context);

		this.#subscribe = createSubscriber((update) => {
			const updateCombat = Hooks.on('updateCombat', (combat) => {
				if (combat.id === this.id) update();
			});

			const combatantHooks = ['create', 'delete', 'update'].reduce(
				(hooks, hookType) => {
					const hookName = `${hookType}Combatant` as
						| 'createCombatant'
						| 'deleteCombatant'
						| 'updateCombatant';
					hooks[hookType] = Hooks.on(hookName, (combatant, _, options) => {
						if ((options as { diff?: boolean }).diff === false) return;
						if (combatant.parent?.id === this.id) update();
					});

					return hooks;
				},
				{} as Record<string, number>,
			);

			return () => {
				Hooks.off('updateCombat', updateCombat);
				Hooks.off('createCombatant', combatantHooks.create);
				Hooks.off('deleteCombatant', combatantHooks.delete);
				Hooks.off('updateCombatant', combatantHooks.update);
			};
		});
	}

	get reactive() {
		this.#subscribe();

		return this;
	}

	override async startCombat(): Promise<this> {
		const result = await super.startCombat();

		// Roll initiative for any unrolled combatants
		const sceneId = this.scene?.id;
		if (!sceneId) return result;

		const unrolled = this.combatants.filter(
			(c) => c.initiative === null && c.type === 'character' && c.sceneId === sceneId,
		);
		if (unrolled.length > 0) {
			await this.rollInitiative(
				unrolled.map((c) => c.id).filter((id): id is string => id !== null),
				{ updateTurn: false },
			);
		}

		// Initialize actions for non-character combatants (NPCs, minions, solo monsters)
		// Characters get their actions set during initiative roll
		type CombatantUpdate = { _id: string | null; 'system.actions.base.current': number };
		const npcUpdates = this.combatants.reduce<CombatantUpdate[]>((updates, combatant) => {
			if (combatant.type !== 'character') {
				const system = combatant.system as unknown as CombatantSystemWithActions;
				updates.push({
					_id: combatant.id,
					'system.actions.base.current': system.actions.base.max,
				});
			}
			return updates;
		}, []);

		if (npcUpdates.length > 0) {
			await this.updateEmbeddedDocuments('Combatant', npcUpdates);
		}

		// After start + auto-roll updates, always begin on the top player card.
		// This preserves pre-combat manual ordering as the first-turn source of truth.
		this.turns = this.setupTurns();
		if (this.turns.length > 0) {
			const firstCharacterTurnIndex = this.turns.findIndex(
				(combatant) => combatant.type === 'character',
			);
			const nextTurnIndex = firstCharacterTurnIndex >= 0 ? firstCharacterTurnIndex : 0;
			await this.update({ turn: nextTurnIndex });
		}

		return result;
	}

	override async createEmbeddedDocuments<EmbeddedName extends Combat.Embedded.Name>(
		embeddedName: EmbeddedName,
		data: foundry.abstract.Document.CreateDataForName<EmbeddedName>[] | undefined,
		operation?: object,
	): Promise<foundry.abstract.Document.StoredForName<EmbeddedName>[] | undefined> {
		let normalizedData = data;

		if (embeddedName === 'Combatant' && Array.isArray(data)) {
			let normalizedCount = 0;
			normalizedData = data.map((entry) => {
				if (!entry || typeof entry !== 'object') return entry;
				const asRecord = entry as Record<string, unknown>;
				if (asRecord.type !== 'minion') return entry;
				normalizedCount += 1;
				return {
					...asRecord,
					type: 'npc',
				};
			}) as foundry.abstract.Document.CreateDataForName<EmbeddedName>[];

			if (normalizedCount > 0) {
				logMinionGroupingCombat('normalized invalid combatant create type from minion to npc', {
					combatId: this.id ?? null,
					normalizedCount,
				});
			}
		}

		return super.createEmbeddedDocuments(embeddedName, normalizedData, operation);
	}

	override async _onEndTurn(combatant: Combatant.Implementation, context: Combat.TurnEventContext) {
		await super._onEndTurn(combatant, context);

		if (combatant.type === 'character') {
			const system = combatant.system as unknown as CombatantSystemWithActions;
			await combatant.update({
				'system.actions.base.current': system.actions.base.max,
			} as Record<string, unknown>);
		}
	}

	override async _onEndRound() {
		type CombatantUpdate = { _id: string | null; 'system.actions.base.current': number };

		// Reset only non-character combatants' actions at end of round
		// (Characters refresh their actions at end of their turn via _onEndTurn)
		const updates = this.combatants.reduce<CombatantUpdate[]>((updates, currentCombatant) => {
			if (currentCombatant.type !== 'character') {
				const system = currentCombatant.system as unknown as CombatantSystemWithActions;
				updates.push({
					_id: currentCombatant.id,
					'system.actions.base.current': system.actions.base.max,
				});
			}
			return updates;
		}, []);

		if (updates.length > 0) {
			await this.updateEmbeddedDocuments('Combatant', updates);
		}
	}

	async updateCombatant(
		combatantID: string,
		updates: Record<string, any>,
	): Promise<NimbleCombatant | undefined> {
		const combatant = this.combatants.get(combatantID) as NimbleCombatant | null;

		if (!combatant) {
			// eslint-disable-next-line no-console
			console.error(
				`Attempted to update combatant with id ${combatantID}, but the combatant could not be found.`,
			);
			return undefined;
		}

		return combatant.update(updates);
	}

	async createMinionGroup(combatantIds: string[]): Promise<Combatant.Implementation[]> {
		logMinionGroupingCombat('createMinionGroup called', {
			combatId: this.id ?? null,
			combatantIds,
		});
		if (!game.user?.isGM) {
			logMinionGroupingCombat('createMinionGroup blocked because user is not GM');
			return [];
		}

		const selectedCombatants = this.#resolveCombatantsByIds(combatantIds);
		const minions = selectedCombatants.filter(
			(combatant) =>
				isMinionCombatant(combatant) && !isCombatantDead(combatant) && !isMinionGrouped(combatant),
		);

		if (minions.length < 2) {
			logMinionGroupingCombat(
				'createMinionGroup blocked because fewer than 2 valid ungrouped alive minions were found',
				{
					selectedCombatants: selectedCombatants.map((combatant) => ({
						id: combatant.id ?? null,
						name: combatant.name ?? null,
						actorType: combatant.actor?.type ?? null,
						isDead: isCombatantDead(combatant),
						groupId: getMinionGroupId(combatant),
					})),
				},
			);
			return [];
		}

		const ordered = this.#sortCombatantsByCurrentTurnOrder(minions);
		const leader = ordered[0];
		if (!leader?.id) {
			logMinionGroupingCombat('createMinionGroup blocked because no leader could be resolved');
			return [];
		}

		const previousActiveId = this.combatant?.id;
		const groupId = foundry.utils.randomID();
		const groupLabelIndex = this.#getNextMinionGroupLabelIndex();
		const groupLabel = formatMinionGroupLabel(groupLabelIndex);
		const sharedInitiative = Number(leader.initiative ?? 0);
		const sharedSort = getCombatantManualSortValue(leader);

		const updates = ordered.reduce<Record<string, unknown>[]>((acc, combatant, memberIndex) => {
			if (!combatant.id) return acc;

			acc.push({
				_id: combatant.id,
				[MINION_GROUP_ID_PATH]: groupId,
				[MINION_GROUP_ROLE_PATH]: combatant.id === leader.id ? 'leader' : 'member',
				[MINION_GROUP_LABEL_PATH]: groupLabel,
				[MINION_GROUP_LABEL_INDEX_PATH]: groupLabelIndex,
				[MINION_GROUP_MEMBER_NUMBER_PATH]: memberIndex + 1,
				initiative: sharedInitiative,
				'system.sort': sharedSort,
			});
			return acc;
		}, []);

		if (updates.length === 0) {
			logMinionGroupingCombat(
				'createMinionGroup blocked because no update payloads were generated',
			);
			return [];
		}

		const updated = await this.updateEmbeddedDocuments('Combatant', updates);
		await this.#persistNextMinionGroupLabelIndex(groupLabelIndex + 1);
		this.turns = this.setupTurns();
		const selectedIds = new Set(minions.map((combatant) => combatant.id).filter(Boolean));
		const desiredActiveId =
			previousActiveId && selectedIds.has(previousActiveId) ? leader.id : previousActiveId;
		await this.#syncTurnToCombatant(desiredActiveId);

		logMinionGroupingCombat('createMinionGroup completed', {
			groupId,
			groupLabel,
			groupLabelIndex,
			leaderId: leader.id,
			memberIds: ordered.map((combatant) => combatant.id),
			sharedInitiative,
			sharedSort,
		});
		return updated ?? [];
	}

	async addMinionsToGroup(
		groupId: string,
		combatantIds: string[],
	): Promise<Combatant.Implementation[]> {
		logMinionGroupingCombat('addMinionsToGroup called', {
			combatId: this.id ?? null,
			groupId,
			combatantIds,
		});
		if (!game.user?.isGM) {
			logMinionGroupingCombat('addMinionsToGroup blocked because user is not GM');
			return [];
		}
		if (!groupId) {
			logMinionGroupingCombat('addMinionsToGroup blocked because groupId is empty');
			return [];
		}

		const summaries = getMinionGroupSummaries(this.combatants.contents);
		const existingSummary = summaries.get(groupId);
		if (!existingSummary) {
			logMinionGroupingCombat('addMinionsToGroup blocked because target group was not found', {
				groupId,
			});
			return [];
		}

		const selectedCombatants = this.#resolveCombatantsByIds(combatantIds);
		const additions = selectedCombatants.filter(
			(combatant) =>
				isMinionCombatant(combatant) && !isCombatantDead(combatant) && !isMinionGrouped(combatant),
		);
		if (additions.length === 0) {
			logMinionGroupingCombat(
				'addMinionsToGroup blocked because no valid ungrouped minions were selected',
				{
					selectedCombatants: selectedCombatants.map((combatant) => ({
						id: combatant.id ?? null,
						name: combatant.name ?? null,
						actorType: combatant.actor?.type ?? null,
						isDead: isCombatantDead(combatant),
						groupId: getMinionGroupId(combatant),
					})),
				},
			);
			return [];
		}

		const leader =
			getEffectiveMinionGroupLeader(existingSummary, { aliveOnly: true }) ??
			getEffectiveMinionGroupLeader(existingSummary);
		if (!leader?.id) {
			logMinionGroupingCombat(
				'addMinionsToGroup blocked because no group leader could be resolved',
				{
					groupId,
				},
			);
			return [];
		}
		const previousActiveId = this.combatant?.id;

		const updatesById = new Map<string, Record<string, unknown>>();
		const setUpdate = (combatantId: string, update: Record<string, unknown>) => {
			const current = updatesById.get(combatantId) ?? { _id: combatantId };
			updatesById.set(combatantId, { ...current, ...update });
		};
		const sharedInitiative = Number(leader.initiative ?? 0);
		const sharedSort = getCombatantManualSortValue(leader);
		const groupLabelIndex = existingSummary.labelIndex;
		const groupLabel =
			typeof groupLabelIndex === 'number'
				? formatMinionGroupLabel(groupLabelIndex)
				: (existingSummary.label ?? null);
		const normalizedGroupLabel = groupLabel?.trim().toUpperCase() ?? null;
		const memberNumberAssignment = this.#resolveStableGroupMemberNumbers(existingSummary.members);
		const leaderHasDesiredLabel = getMinionGroupLabel(leader) === normalizedGroupLabel;
		const leaderHasDesiredLabelIndex =
			typeof groupLabelIndex === 'number'
				? getMinionGroupLabelIndex(leader) === groupLabelIndex
				: getMinionGroupLabelIndex(leader) === null;

		if (
			getMinionGroupRole(leader) !== 'leader' ||
			(!leaderHasDesiredLabel && normalizedGroupLabel !== null) ||
			(!leaderHasDesiredLabelIndex && typeof groupLabelIndex === 'number')
		) {
			setUpdate(leader.id, {
				[MINION_GROUP_ID_PATH]: groupId,
				[MINION_GROUP_ROLE_PATH]: 'leader',
				...(normalizedGroupLabel ? { [MINION_GROUP_LABEL_PATH]: normalizedGroupLabel } : {}),
				...(typeof groupLabelIndex === 'number'
					? { [MINION_GROUP_LABEL_INDEX_PATH]: groupLabelIndex }
					: {}),
			});
		}

		for (const backfill of memberNumberAssignment.backfillUpdates) {
			const backfillId = typeof backfill._id === 'string' ? backfill._id : null;
			if (!backfillId) continue;
			const changes = { ...backfill };
			delete changes._id;
			setUpdate(backfillId, changes);
		}

		let nextMemberNumber = memberNumberAssignment.maxMemberNumber + 1;
		for (const combatant of additions) {
			if (!combatant.id) continue;
			setUpdate(combatant.id, {
				[MINION_GROUP_ID_PATH]: groupId,
				[MINION_GROUP_ROLE_PATH]: 'member',
				...(normalizedGroupLabel ? { [MINION_GROUP_LABEL_PATH]: normalizedGroupLabel } : {}),
				...(typeof groupLabelIndex === 'number'
					? { [MINION_GROUP_LABEL_INDEX_PATH]: groupLabelIndex }
					: {}),
				[MINION_GROUP_MEMBER_NUMBER_PATH]: nextMemberNumber,
				initiative: sharedInitiative,
				'system.sort': sharedSort,
			});
			nextMemberNumber += 1;
		}

		const updates = [...updatesById.values()];

		if (updates.length === 0) {
			logMinionGroupingCombat(
				'addMinionsToGroup blocked because no update payloads were generated',
				{
					groupId,
				},
			);
			return [];
		}

		const updated = await this.updateEmbeddedDocuments('Combatant', updates);
		this.turns = this.setupTurns();
		const addedIds = new Set(additions.map((combatant) => combatant.id).filter(Boolean));
		const desiredActiveId =
			previousActiveId && addedIds.has(previousActiveId) ? leader.id : previousActiveId;
		await this.#syncTurnToCombatant(desiredActiveId);
		logMinionGroupingCombat('addMinionsToGroup completed', {
			groupId,
			leaderId: leader.id,
			addedIds: additions.map((combatant) => combatant.id),
			updates: updates.length,
		});
		return updated ?? [];
	}

	async removeMinionsFromGroups(combatantIds: string[]): Promise<Combatant.Implementation[]> {
		logMinionGroupingCombat('removeMinionsFromGroups called', {
			combatId: this.id ?? null,
			combatantIds,
		});
		if (!game.user?.isGM) {
			logMinionGroupingCombat('removeMinionsFromGroups blocked because user is not GM');
			return [];
		}

		const selectedCombatants = this.#resolveCombatantsByIds(combatantIds);
		const groupedMinions = selectedCombatants.filter(
			(combatant) => isMinionCombatant(combatant) && isMinionGrouped(combatant),
		);
		if (groupedMinions.length === 0) {
			logMinionGroupingCombat(
				'removeMinionsFromGroups blocked because no grouped minions were found in selection',
			);
			return [];
		}

		const previousActiveCombatantId = this.combatant?.id;
		const previousActiveGroupId = getMinionGroupId(this.combatant);
		const affectedGroupIds = new Set(
			groupedMinions
				.map((combatant) => getMinionGroupId(combatant))
				.filter((id): id is string => !!id),
		);

		const updatesById = new Map<string, Record<string, unknown>>();
		const setUpdate = (combatantId: string, update: Record<string, unknown>) => {
			const current = updatesById.get(combatantId) ?? { _id: combatantId };
			updatesById.set(combatantId, { ...current, ...update });
		};

		for (const combatant of groupedMinions) {
			if (!combatant.id) continue;
			setUpdate(combatant.id, { [MINION_GROUP_FLAG_ROOT]: null });
		}

		const groupedRemovalIds = new Set(groupedMinions.map((combatant) => combatant.id));
		const currentSummaries = getMinionGroupSummaries(this.combatants.contents);

		for (const groupId of affectedGroupIds) {
			const summary = currentSummaries.get(groupId);
			if (!summary) continue;
			const groupLabelIndex = summary.labelIndex;
			const groupLabel =
				typeof groupLabelIndex === 'number'
					? formatMinionGroupLabel(groupLabelIndex)
					: (summary.label ?? null);

			const remainingMembers = summary.members.filter(
				(member) => member.id && !groupedRemovalIds.has(member.id),
			);

			if (remainingMembers.length <= 1) {
				for (const member of remainingMembers) {
					if (!member.id) continue;
					setUpdate(member.id, { [MINION_GROUP_FLAG_ROOT]: null });
				}
				continue;
			}

			const memberNumberAssignment = this.#resolveStableGroupMemberNumbers(remainingMembers);
			for (const backfill of memberNumberAssignment.backfillUpdates) {
				const backfillId = typeof backfill._id === 'string' ? backfill._id : null;
				if (!backfillId) continue;
				const changes = { ...backfill };
				delete changes._id;
				setUpdate(backfillId, changes);
			}

			const remainingSummary = getMinionGroupSummaries(remainingMembers).get(groupId);
			if (!remainingSummary) continue;

			const nextLeader =
				getEffectiveMinionGroupLeader(remainingSummary, { aliveOnly: true }) ??
				getEffectiveMinionGroupLeader(remainingSummary);
			if (!nextLeader?.id) continue;

			for (const member of remainingMembers) {
				if (!member.id) continue;
				const desiredRole = member.id === nextLeader.id ? 'leader' : 'member';
				const desiredMemberNumber = memberNumberAssignment.numbersById.get(member.id);
				const roleMatches = getMinionGroupRole(member) === desiredRole;
				const labelMatches = !groupLabel || getMinionGroupLabel(member) === groupLabel;
				const labelIndexMatches =
					typeof groupLabelIndex !== 'number' ||
					getMinionGroupLabelIndex(member) === groupLabelIndex;
				const memberNumberMatches =
					typeof desiredMemberNumber !== 'number' ||
					getMinionGroupMemberNumber(member) === desiredMemberNumber;
				if (roleMatches && labelMatches && labelIndexMatches && memberNumberMatches) continue;

				setUpdate(member.id, {
					[MINION_GROUP_ID_PATH]: groupId,
					[MINION_GROUP_ROLE_PATH]: desiredRole,
					...(groupLabel ? { [MINION_GROUP_LABEL_PATH]: groupLabel } : {}),
					...(typeof groupLabelIndex === 'number'
						? { [MINION_GROUP_LABEL_INDEX_PATH]: groupLabelIndex }
						: {}),
					...(typeof desiredMemberNumber === 'number'
						? { [MINION_GROUP_MEMBER_NUMBER_PATH]: desiredMemberNumber }
						: {}),
				});
			}
		}

		const updates = [...updatesById.values()];
		if (updates.length === 0) {
			logMinionGroupingCombat(
				'removeMinionsFromGroups blocked because no update payloads were generated',
			);
			return [];
		}

		const updated = await this.updateEmbeddedDocuments('Combatant', updates);
		this.turns = this.setupTurns();
		let desiredActiveId = previousActiveCombatantId;

		if (previousActiveGroupId && affectedGroupIds.has(previousActiveGroupId)) {
			const nextSummaries = getMinionGroupSummaries(this.combatants.contents);
			const nextSummary = nextSummaries.get(previousActiveGroupId);
			const nextLeader = nextSummary
				? (getEffectiveMinionGroupLeader(nextSummary, { aliveOnly: true }) ??
					getEffectiveMinionGroupLeader(nextSummary))
				: null;
			desiredActiveId = nextLeader?.id ?? desiredActiveId;
		}
		await this.#syncTurnToCombatant(desiredActiveId);

		await this.#resetMinionGroupLabelCounterIfNoGroupsRemain('removeMinionsFromGroups');

		logMinionGroupingCombat('removeMinionsFromGroups completed', {
			removedIds: groupedMinions.map((combatant) => combatant.id),
			affectedGroupIds: [...affectedGroupIds],
			updates: updates.length,
		});
		return updated ?? [];
	}

	async dissolveMinionGroups(groupIds: string[]): Promise<Combatant.Implementation[]> {
		logMinionGroupingCombat('dissolveMinionGroups called', {
			combatId: this.id ?? null,
			groupIds,
		});
		if (!game.user?.isGM) {
			logMinionGroupingCombat('dissolveMinionGroups blocked because user is not GM');
			return [];
		}

		const targetGroupIds = new Set(groupIds.filter((groupId) => groupId.length > 0));
		if (targetGroupIds.size === 0) {
			logMinionGroupingCombat(
				'dissolveMinionGroups blocked because no valid group ids were provided',
			);
			return [];
		}

		const previousActiveCombatantId = this.combatant?.id;
		const updates = this.combatants.contents.reduce<Record<string, unknown>[]>((acc, combatant) => {
			if (!combatant.id || !isMinionCombatant(combatant)) return acc;

			const groupId = getMinionGroupId(combatant);
			if (!groupId || !targetGroupIds.has(groupId)) return acc;

			acc.push({
				_id: combatant.id,
				[MINION_GROUP_FLAG_ROOT]: null,
			});
			return acc;
		}, []);

		if (updates.length === 0) {
			logMinionGroupingCombat(
				'dissolveMinionGroups blocked because no members were found for target groups',
				{
					targetGroupIds: [...targetGroupIds],
				},
			);
			return [];
		}

		const updated = await this.updateEmbeddedDocuments('Combatant', updates);
		this.turns = this.setupTurns();
		await this.#syncTurnToCombatant(previousActiveCombatantId);
		await this.#resetMinionGroupLabelCounterIfNoGroupsRemain('dissolveMinionGroups');
		logMinionGroupingCombat('dissolveMinionGroups completed', {
			targetGroupIds: [...targetGroupIds],
			updates: updates.length,
		});
		return updated ?? [];
	}

	override async rollInitiative(
		ids: string | string[],
		options?: Combat.InitiativeOptions & { rollOptions?: Record<string, unknown> },
	): Promise<this> {
		const { formula = null, updateTurn = true, messageOptions = {} } = options ?? {};

		// Structure Input data
		const combatantIds = typeof ids === 'string' ? [ids] : ids;
		const currentId = this.combatant?.id;
		const chatRollMode = game.settings.get('core', 'rollMode');

		// Iterate over Combatants, performing an initiative roll for each
		const updates: Record<string, unknown>[] = [];
		const combatManaUpdates: Promise<unknown>[] = [];
		const messages: ChatMessage.CreateData[] = [];

		for await (const [i, id] of combatantIds.entries()) {
			// Get Combatant data (non-strictly)
			const combatant = this.combatants.get(id);
			const combatantUpdates: Record<string, unknown> = { _id: id };
			if (!combatant?.isOwner) continue;

			// Produce an initiative roll for the Combatant
			const roll = combatant.getInitiativeRoll(formula ?? undefined);
			await roll.evaluate();
			combatantUpdates.initiative = roll.total ?? 0;

			if (combatant.type === 'character') {
				const actionPath = 'system.actions.base.current';
				const total = roll.total ?? 0;

				if (total >= 20) combatantUpdates[actionPath] = 3;
				else if (total >= 10) combatantUpdates[actionPath] = 2;
				else combatantUpdates[actionPath] = 1;
			}

			await handleInitiativeRules({
				combatId: this.id,
				combatManaUpdates,
				combatant,
			});

			updates.push(combatantUpdates);

			// Construct chat message data
			const messageData = foundry.utils.mergeObject(
				{
					speaker: ChatMessage.getSpeaker({
						actor: combatant.actor,
						token: combatant.token,
						alias: combatant.name ?? undefined,
					}),
					flavor: game.i18n.format('COMBAT.RollsInitiative', { name: combatant.name ?? '' }),
					flags: { 'core.initiativeRoll': true },
				},
				messageOptions,
			) as ChatMessage.CreateData;
			const chatData = (await roll.toMessage(messageData, {
				create: false,
			})) as ChatMessage.CreateData & {
				rollMode?: string | null;
				sound?: string | null;
			};

			// If the combatant is hidden, use a private roll unless an alternative rollMode
			// was explicitly requested
			const msgOpts = messageOptions as ChatMessage.CreateData & { rollMode?: string };
			chatData.rollMode =
				'rollMode' in msgOpts
					? (msgOpts.rollMode ?? undefined)
					: combatant.hidden
						? CONST.DICE_ROLL_MODES.PRIVATE
						: chatRollMode;

			// Play 1 sound for the whole rolled set
			if (i > 0) chatData.sound = null;
			messages.push(chatData);
		}

		// Update multiple combatants
		await this.updateEmbeddedDocuments('Combatant', updates);

		if (combatManaUpdates.length > 0) {
			await Promise.all(combatManaUpdates);
		}

		// Ensure the turn order remains with the same combatant
		if (updateTurn && currentId) {
			await this.update({ turn: this.turns.findIndex((t) => t.id === currentId) });
		}

		// Create multiple chat messages
		await ChatMessage.implementation.create(messages);
		return this;
	}

	override setupTurns(): Combatant.Implementation[] {
		const aliveTurns = super.setupTurns().filter((combatant) => !isCombatantDead(combatant));
		const groupedSummaries = getMinionGroupSummaries(aliveTurns);
		if (groupedSummaries.size === 0) return aliveTurns;

		const leaderIds = new Set<string>();
		for (const summary of groupedSummaries.values()) {
			const leader = getEffectiveMinionGroupLeader(summary, { aliveOnly: true });
			if (leader?.id) leaderIds.add(leader.id);
		}

		return aliveTurns.filter((combatant) => {
			const groupId = getMinionGroupId(combatant);
			if (!groupId) return true;
			return leaderIds.has(combatant.id ?? '');
		});
	}

	override async nextTurn(): Promise<this> {
		this.#syncTurnIndexWithAliveTurns();
		const result = (await super.nextTurn()) as this;
		this.#syncTurnIndexWithAliveTurns();
		return result;
	}

	override async nextRound(): Promise<this> {
		this.#syncTurnIndexWithAliveTurns();
		const result = (await super.nextRound()) as this;
		this.#syncTurnIndexWithAliveTurns();
		return result;
	}

	override _sortCombatants(a: Combatant.Implementation, b: Combatant.Implementation): number {
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

	async _onDrop(event: DragEvent & { target: EventTarget & HTMLElement }) {
		event.preventDefault();

		const trackerListElement = (event.target as HTMLElement).closest<HTMLElement>(
			'.nimble-combatants',
		);
		const dropData = foundry.applications.ux.TextEditor.implementation.getDragEventData(
			event,
		) as unknown as Record<string, string>;

		const { combatants } = this;

		let source = fromUuidSync(
			dropData.uuid as `Combatant.${string}`,
		) as Combatant.Implementation | null;
		if (!source && trackerListElement?.dataset.dragSourceId) {
			source = combatants.get(trackerListElement.dataset.dragSourceId) ?? null;
		}

		if (!source) return false;
		if (source.parent?.id !== this.id) return false;
		if (isCombatantDead(source)) return false;
		if (!canCurrentUserReorderCombatant(source)) return false;

		let dropTarget = (event.target as HTMLElement).closest<HTMLElement>('[data-combatant-id]');
		let target = dropTarget ? combatants.get(dropTarget.dataset.combatantId ?? '') : null;
		let sortBefore: boolean | null = null;

		if (target && dropTarget) {
			sortBefore =
				event.y <
				dropTarget.getBoundingClientRect().top + dropTarget.getBoundingClientRect().height / 2;
		}

		if (!target && trackerListElement?.dataset.dropTargetId) {
			target = combatants.get(trackerListElement.dataset.dropTargetId) ?? null;
			if (target) {
				dropTarget = trackerListElement.querySelector<HTMLElement>(
					`[data-combatant-id="${target.id}"]`,
				);
				sortBefore = trackerListElement.dataset.dropBefore === 'true';
			}
		}

		if (!target) return false;
		if (isCombatantDead(target)) return false;

		const sourceTypePriority = getCombatantTypePriority(source);
		const targetTypePriority = getCombatantTypePriority(target);
		if (sourceTypePriority !== targetTypePriority) return false;

		if (source.id === target.id) return false;
		const previousActiveCombatantId = this.combatant?.id;

		const siblings = this.turns.filter(
			(c) =>
				c.id !== source.id &&
				!isCombatantDead(c) &&
				getCombatantTypePriority(c) === sourceTypePriority,
		);
		if (sortBefore === null) return false;

		if (game.user?.isGM) {
			// Perform the sort with full integer normalization for GM reorders.
			type SortableCombatant = Combatant.Implementation & { id: string };
			const sortUpdates = SortingHelpers.performIntegerSort(source as SortableCombatant, {
				target: target as SortableCombatant | null,
				siblings: siblings as SortableCombatant[],
				sortKey: 'system.sort',
				sortBefore,
			});

			const updateData = sortUpdates.map((u) => {
				const { update } = u;
				return {
					...update,
					_id: u.target.id,
				};
			});

			const updates = await this.updateEmbeddedDocuments('Combatant', updateData);
			this.turns = this.setupTurns();
			await this.#syncTurnToCombatant(previousActiveCombatantId);

			return updates;
		}

		// Non-GM owners can reorder their own character card by updating only their card's sort value.
		const newSortValue = getSourceSortValueForDrop(source, target, siblings, sortBefore);
		if (newSortValue === null || !Number.isFinite(newSortValue)) return false;

		const updated = await source.update({ 'system.sort': newSortValue } as Record<string, unknown>);
		this.turns = this.setupTurns();
		await this.#syncTurnToCombatant(previousActiveCombatantId, { persist: false });
		return updated ? [updated] : [];
	}
}

export { NimbleCombat };
