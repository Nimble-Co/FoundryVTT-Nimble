import { createSubscriber } from 'svelte/reactivity';
import type { NimbleCombatant } from '../combatant/combatant.svelte.js';
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
import { getCurrentUserTargetTokenIds, getTargetTokenName } from '../../utils/tokenTargetLookup.js';
import type { NimbleCombatant } from '../combatant/combatant.svelte.js';
import {
	appendMinionAttackRollOutcome,
	buildNcsGroupAttackChatData,
	createMinionGroupAttackResult,
	getCombatantCurrentActions,
	getCombatantManualSortValue,
	getSourceSortValueForDrop,
	logMinionGroupingCombat,
	normalizeUniqueIds,
	resolveActorItems,
	resolveGroupAttackSpeaker,
	resolveGroupAttackSpeakerAlias,
	resolveMinionAttackSkipReason,
} from './combatCommon.js';
import type {
	ActorWithActivateItem,
	CombatantSystemWithActions,
	DropResolution,
	DropTargetResolution,
	InitiativeRollOutcome,
	ItemLike,
	MinionGroupAttackParams,
	MinionGroupAttackResult,
	MinionGroupAttackRollEntry,
	MinionGroupAttackRollOutcome,
	MinionGroupAttackSelection,
	MinionGroupAttackSkippedMember,
	NormalizedMinionGroupAttackParams,
	ResolvedMinionAttackActionContext,
	ResolvedMinionGroupAttackTargets,
} from './combatTypes.js';
import { handleInitiativeRules } from './handleInitiativeRules.js';

/** Combatant system data with actions */
interface CombatantSystemWithActions {
	actions: {
		base: {
			current: number;
			max: number;
		};
	};
}

function getCombatantTypePriority(combatant: Combatant.Implementation): number {
	if (combatant.type === 'character') return 0;
	return 1;
}

function getCombatantManualSortValue(combatant: Combatant.Implementation): number {
	return Number((combatant.system as unknown as { sort?: number }).sort ?? 0);
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
	#combatantHasAnyActionsRemaining(combatant: Combatant.Implementation): boolean {
		if (combatant.type === 'character') return true;

		const groupId = getMinionGroupId(combatant);
		if (groupId) {
			const summary = getMinionGroupSummaries(this.combatants.contents).get(groupId);
			if (summary?.aliveMembers.length) {
				return summary.aliveMembers.some((member) => getCombatantCurrentActions(member) > 0);
			}
		}

		return getCombatantCurrentActions(combatant) > 0;
	}

	async #advancePastExhaustedTurns(result: this): Promise<this> {
		if (!this.turns.length) return result;

		const hasTurnWithActions = this.turns.some((combatant) =>
			this.#combatantHasAnyActionsRemaining(combatant),
		);
		if (!hasTurnWithActions) return result;

		let nextResult = result;
		const maxIterations = Math.max(this.turns.length, 1);
		for (let iteration = 0; iteration < maxIterations; iteration += 1) {
			const activeCombatant = this.combatant;
			if (!activeCombatant) break;
			if (activeCombatant.type === 'character') break;
			if (this.#combatantHasAnyActionsRemaining(activeCombatant)) break;

			const previousActiveId = activeCombatant.id ?? null;
			nextResult = (await super.nextTurn()) as this;
			this.#syncTurnIndexWithAliveTurns();
			const nextActiveId = this.combatant?.id ?? null;
			if (!nextActiveId || nextActiveId === previousActiveId) break;
		}

		return nextResult;
	}

	async #createNcsGroupAttackChatMessage(params: {
		groupLabel: string | null;
		targetTokenIds: string[];
		targetName: string;
		rollEntries: MinionGroupAttackRollEntry[];
		totalDamage: number;
		skippedMembers: MinionGroupAttackSkippedMember[];
		unsupportedWarnings: string[];
		attackMembers: Combatant.Implementation[];
	}): Promise<ChatMessage | null> {
		if (params.rollEntries.length === 0) return null;

		const speakerCombatant = resolveGroupAttackSpeaker({
			attackMembers: params.attackMembers,
			rollEntries: params.rollEntries,
		});
		const speakerAlias = resolveGroupAttackSpeakerAlias(params.groupLabel);
		const chatData = buildNcsGroupAttackChatData({
			...params,
			speakerCombatant,
			speakerAlias,
		});
		ChatMessage.applyRollMode(
			chatData as Record<string, unknown>,
			chatData.rollMode as foundry.CONST.DICE_ROLL_MODES,
		);

		const chatCard = await ChatMessage.create(chatData as unknown as ChatMessage.CreateData);
		return chatCard ?? null;
	}
	#getRoundBoundaryGroupIdsToDissolve(): string[] {
		return [...getMinionGroupSummaries(this.combatants.contents).keys()];
	}

	async #dissolveMinionGroupsByIds(
		groupIds: string[],
		reason: string,
	): Promise<Combatant.Implementation[]> {
		const targetGroupIds = new Set(
			groupIds
				.map((groupId) => groupId?.trim() ?? '')
				.filter((groupId): groupId is string => groupId.length > 0),
		);
		if (targetGroupIds.size === 0) return [];

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
		if (updates.length === 0) return [];

		const updated = await this.updateEmbeddedDocuments('Combatant', updates);
		this.turns = this.setupTurns();
		await this.#syncTurnToCombatant(previousActiveCombatantId);
		logMinionGroupingCombat('dissolved minion groups', {
			combatId: this.id ?? null,
			groupIds: [...targetGroupIds],
			reason,
		});
		return updated ?? [];
	}

	async #dissolveRoundBoundaryMinionGroups(): Promise<void> {
		if (!game.user?.isGM) return;

		const groupIdsToDissolve = this.#getRoundBoundaryGroupIdsToDissolve();
		if (groupIdsToDissolve.length === 0) return;

		await this.#dissolveMinionGroupsByIds(groupIdsToDissolve, 'ncsModeRoundBoundary');
		logMinionGroupingCombat('dissolved round-boundary minion groups', {
			combatId: this.id ?? null,
			groupIds: groupIdsToDissolve,
			reason: 'ncsModeRoundBoundary',
		});
	}

	#resolveAliveMinionMembersByIds(memberCombatantIds: string[]): Combatant.Implementation[] {
		return this.#resolveCombatantsByIds(normalizeUniqueIds(memberCombatantIds)).filter(
			(member) => isMinionCombatant(member) && !isCombatantDead(member),
		);
	}

	#setCombatantUpdate(
		updatesById: Map<string, Record<string, unknown>>,
		combatantId: string,
		update: Record<string, unknown>,
	): void {
		const current = updatesById.get(combatantId) ?? { _id: combatantId };
		updatesById.set(combatantId, { ...current, ...update });
	}

	#collectRemainingGroupMembers(
		groupId: string,
		selectedMemberIds: ReadonlySet<string>,
	): Combatant.Implementation[] {
		return this.combatants.contents.filter((combatant) => {
			const combatantId = combatant.id ?? '';
			if (!combatantId) return false;
			if (selectedMemberIds.has(combatantId)) return false;
			if (!isMinionCombatant(combatant)) return false;
			return getMinionGroupId(combatant) === groupId;
		});
	}

	#applyGroupDetachmentUpdate(
		groupId: string,
		remainingMembers: Combatant.Implementation[],
		updatesById: Map<string, Record<string, unknown>>,
	): void {
		if (remainingMembers.length <= 1) {
			for (const member of remainingMembers) {
				if (!member.id) continue;
				this.#setCombatantUpdate(updatesById, member.id, { [MINION_GROUP_FLAG_ROOT]: null });
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
			this.#setCombatantUpdate(updatesById, member.id, {
				[MINION_GROUP_ID_PATH]: groupId,
				[MINION_GROUP_ROLE_PATH]: member.id === nextLeader.id ? 'leader' : 'member',
				[MINION_GROUP_TEMPORARY_PATH]: true,
			});
		}
	}

	#buildTemporaryGroupUpdates(
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

	#resolveDesiredActiveIdAfterRegroup(params: {
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

	async #detachMembersFromExistingMinionGroups(memberCombatantIds: string[]): Promise<void> {
		const selectedMemberIds = new Set(normalizeUniqueIds(memberCombatantIds));
		if (selectedMemberIds.size === 0) return;

		const groupedSelectedMinions = this.combatants.contents.filter(
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
			this.#setCombatantUpdate(updatesById, combatantId, { [MINION_GROUP_FLAG_ROOT]: null });
		}

		for (const groupId of affectedGroupIds) {
			const remainingMembers = this.#collectRemainingGroupMembers(groupId, selectedMemberIds);
			this.#applyGroupDetachmentUpdate(groupId, remainingMembers, updatesById);
		}

		const updates = [...updatesById.values()];
		if (updates.length === 0) return;

		await this.updateEmbeddedDocuments('Combatant', updates);
		this.turns = this.setupTurns();
	}

	async #assignNcsTemporaryGroupFromAttackMembers(memberCombatantIds: string[]): Promise<void> {
		if (!game.user?.isGM) return;

		const scopedMemberIds = normalizeUniqueIds(memberCombatantIds);
		if (scopedMemberIds.length < 2) return;

		const scopedMembers = this.#resolveAliveMinionMembersByIds(scopedMemberIds);
		if (scopedMembers.length < 2) return;

		await this.#detachMembersFromExistingMinionGroups(scopedMemberIds);

		const refreshedMembers = this.#resolveAliveMinionMembersByIds(scopedMemberIds);
		if (refreshedMembers.length < 2) return;

		const orderedMembers = this.#sortCombatantsByCurrentTurnOrder(refreshedMembers);
		const leader = orderedMembers[0];
		if (!leader?.id) return;

		const previousActiveCombatantId = this.combatant?.id;
		const temporaryGroupId = foundry.utils.randomID();
		const sharedInitiative = Number(leader.initiative ?? 0);
		const sharedSort = getCombatantManualSortValue(leader);

		const updates = this.#buildTemporaryGroupUpdates(
			orderedMembers,
			leader.id,
			temporaryGroupId,
			sharedInitiative,
			sharedSort,
		);
		if (updates.length === 0) return;

		await this.updateEmbeddedDocuments('Combatant', updates);
		this.turns = this.setupTurns();

		const desiredActiveId = this.#resolveDesiredActiveIdAfterRegroup({
			previousActiveCombatantId,
			leaderId: leader.id,
			orderedMembers,
		});
		await this.#syncTurnToCombatant(desiredActiveId, { persist: false });

		logMinionGroupingCombat('assigned ncs temporary attack group', {
			combatId: this.id ?? null,
			groupId: temporaryGroupId,
			leaderId: leader.id,
			memberIds: orderedMembers.map((member) => member.id),
			sharedInitiative,
			sharedSort,
		});
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

	async #applyNpcActionResetUpdates(): Promise<void> {
		const updates = this.combatants.contents
			.filter((combatant) => combatant.type !== 'character')
			.map((combatant) => {
				const system = combatant.system as unknown as CombatantSystemWithActions;
				return {
					_id: combatant.id,
					'system.actions.base.current': system.actions.base.max,
				};
			});
		if (updates.length < 1) return;
		await this.updateEmbeddedDocuments('Combatant', updates);
	}

	#resolveStartCombatTurnIndex(): number {
		if (this.turns.length < 1) return 0;
		const firstCharacterTurnIndex = this.turns.findIndex(
			(combatant) => combatant.type === 'character',
		);
		return firstCharacterTurnIndex >= 0 ? firstCharacterTurnIndex : 0;
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

		// Initialize actions for non-character combatants.
		await this.#applyNpcActionResetUpdates();

		// After start + auto-roll updates, always begin on the top player card.
		// This preserves pre-combat manual ordering as the first-turn source of truth.
		this.turns = this.setupTurns();
		if (this.turns.length > 0) {
			const nextTurnIndex = this.#resolveStartCombatTurnIndex();
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
		// Reset only non-character combatants' actions at end of round.
		await this.#applyNpcActionResetUpdates();

		await this.#dissolveRoundBoundaryMinionGroups();
	}

	async updateCombatant(
		combatantID: string,
		updates: Record<string, any>,
	): Promise<NimbleCombatant | undefined> {
		const combatant = this.combatants.get(combatantID) as NimbleCombatant | null;

		if (!combatant) {
			console.error(
				`Attempted to update combatant with id ${combatantID}, but the combatant could not be found.`,
			);
			return undefined;
		}

		return combatant.update(updates);
	}

	#buildSelectionsMap(selections: MinionGroupAttackSelection[]): Map<string, string> {
		const selectionsByMemberId = new Map<string, string>();
		for (const selection of selections) {
			const memberCombatantId = selection.memberCombatantId?.trim() ?? '';
			const actionId = selection.actionId?.trim() ?? '';
			if (!memberCombatantId || !actionId) continue;
			selectionsByMemberId.set(memberCombatantId, actionId);
		}
		return selectionsByMemberId;
	}

	#normalizeAttackParams(params: MinionGroupAttackParams): NormalizedMinionGroupAttackParams {
		const memberCombatantIds = normalizeUniqueIds(params.memberCombatantIds ?? []);
		const targetTokenIds = normalizeUniqueIds(params.targetTokenIds ?? []);

		return {
			memberCombatantIds,
			targetTokenIds,
			selectionsByMemberId: this.#buildSelectionsMap(params.selections),
			endTurn: params.endTurn === true,
		};
	}

	#resolveSelectedTargets(
		requestedTargetTokenIds: string[],
	): ResolvedMinionGroupAttackTargets | null {
		const selectedTargetIds = getCurrentUserTargetTokenIds();
		if (selectedTargetIds.length < 1) return null;

		const requestedIds =
			requestedTargetTokenIds.length > 0 ? requestedTargetTokenIds : selectedTargetIds;
		const resolvedTargetTokenIds = requestedIds.filter((targetTokenId) =>
			selectedTargetIds.includes(targetTokenId),
		);
		const activeTargetTokenIds =
			resolvedTargetTokenIds.length > 0 ? resolvedTargetTokenIds : selectedTargetIds;

		return {
			activeTargetTokenIds,
			primaryTargetTokenId: activeTargetTokenIds[0] ?? '',
		};
	}

	#resolveAttackMembers(memberCombatantIds: string[]): Combatant.Implementation[] {
		return this.#resolveCombatantsByIds(memberCombatantIds).filter(
			(member) => isMinionCombatant(member) && !isCombatantDead(member),
		);
	}

	#buildSkippedMinionAttackOutcome(
		memberId: string,
		reason: string,
		unsupportedWarning: string | null = null,
	): MinionGroupAttackRollOutcome {
		return {
			rollEntry: null,
			actionUpdate: null,
			skippedMember: { combatantId: memberId, reason },
			unsupportedWarning,
		};
	}

	#buildUnsupportedMinionAttackWarning(params: {
		memberName: string | null | undefined;
		memberId: string;
		selectedAction: ItemLike;
		selectedActionId: string;
	}): string | null {
		const unsupportedEffectTypes = getUnsupportedActivationEffectTypes(
			params.selectedAction.system?.activation?.effects,
		);
		if (unsupportedEffectTypes.length < 1) return null;
		return `${params.memberName ?? params.memberId}: ${params.selectedAction.name ?? params.selectedActionId} ignores unsupported effect types (${unsupportedEffectTypes.join(', ')})`;
	}

	#resolveMinionAttackActionContext(params: {
		member: Combatant.Implementation;
		selectionsByMemberId: ReadonlyMap<string, string>;
	}): ResolvedMinionAttackActionContext | MinionGroupAttackRollOutcome {
		const memberId = params.member.id ?? '';
		if (!memberId || !isMinionCombatant(params.member)) {
			return {
				rollEntry: null,
				actionUpdate: null,
				skippedMember: null,
				unsupportedWarning: null,
			};
		}

		const selectedActionId = params.selectionsByMemberId.get(memberId) ?? '';
		const currentActions = getCombatantCurrentActions(params.member);
		const actor = (params.member.actor as unknown as ActorWithActivateItem | null) ?? null;
		const selectedAction =
			resolveActorItems(actor).find((item) => item?.id === selectedActionId) ?? null;
		const skipReason = resolveMinionAttackSkipReason({
			selectedActionId,
			currentActions,
			actor,
			selectedAction,
		});
		if (skipReason) {
			return this.#buildSkippedMinionAttackOutcome(memberId, skipReason);
		}

		const resolvedActor = actor as ActorWithActivateItem;
		const resolvedAction = selectedAction as ItemLike;
		const unsupportedWarning = this.#buildUnsupportedMinionAttackWarning({
			memberName: params.member.name,
			memberId,
			selectedAction: resolvedAction,
			selectedActionId,
		});

		return {
			memberId,
			selectedActionId,
			currentActions,
			actor: resolvedActor,
			selectedAction: resolvedAction,
			unsupportedWarning,
		};
	}

	#isMinionAttackRollOutcome(
		value: ResolvedMinionAttackActionContext | MinionGroupAttackRollOutcome,
	): value is MinionGroupAttackRollOutcome {
		return 'rollEntry' in value;
	}

	#buildMinionAttackRollEntry(params: {
		member: Combatant.Implementation;
		memberId: string;
		selectedActionId: string;
		selectedAction: ItemLike;
		formula: string;
		damageRoll: DamageRoll;
	}): MinionGroupAttackRollEntry {
		const isMiss = Boolean(params.damageRoll.isMiss);
		const totalDamage = Number(params.damageRoll.total ?? 0);
		const normalizedTotalDamage = isMiss
			? 0
			: Number.isFinite(totalDamage)
				? Math.max(0, totalDamage)
				: 0;

		return {
			memberCombatantId: params.memberId,
			memberName: params.member.name ?? params.memberId,
			memberImage: getCombatantImage(params.member),
			actionId: params.selectedActionId,
			actionName: params.selectedAction.name ?? params.selectedActionId,
			actionImage:
				typeof params.selectedAction.img === 'string' && params.selectedAction.img.trim().length > 0
					? params.selectedAction.img.trim()
					: null,
			formula: params.formula,
			totalDamage: normalizedTotalDamage,
			isMiss,
			rollData: params.damageRoll.toJSON() as Record<string, unknown>,
		};
	}

	async #rollSingleMinionAttack(params: {
		member: Combatant.Implementation;
		selectionsByMemberId: ReadonlyMap<string, string>;
	}): Promise<MinionGroupAttackRollOutcome> {
		const resolvedActionContext = this.#resolveMinionAttackActionContext(params);
		if (this.#isMinionAttackRollOutcome(resolvedActionContext)) {
			return resolvedActionContext;
		}

		try {
			const formula = getPrimaryDamageFormulaFromActivationEffects(
				resolvedActionContext.selectedAction.system?.activation?.effects,
			);
			if (!formula) {
				return this.#buildSkippedMinionAttackOutcome(
					resolvedActionContext.memberId,
					'noDamageFormula',
					resolvedActionContext.unsupportedWarning,
				);
			}

			const rollData =
				typeof resolvedActionContext.actor.getRollData === 'function'
					? resolvedActionContext.actor.getRollData(resolvedActionContext.selectedAction)
					: {};
			const damageRoll = new DamageRoll(formula, rollData as DamageRoll.Data, {
				canCrit: false,
				canMiss: true,
				rollMode: 0,
				primaryDieValue: 0,
				primaryDieModifier: 0,
			});
			await damageRoll.evaluate();

			return {
				rollEntry: this.#buildMinionAttackRollEntry({
					member: params.member,
					memberId: resolvedActionContext.memberId,
					selectedActionId: resolvedActionContext.selectedActionId,
					selectedAction: resolvedActionContext.selectedAction,
					formula,
					damageRoll,
				}),
				actionUpdate: {
					_id: resolvedActionContext.memberId,
					'system.actions.base.current': Math.max(0, resolvedActionContext.currentActions - 1),
				},
				skippedMember: null,
				unsupportedWarning: resolvedActionContext.unsupportedWarning,
			};
		} catch (error) {
			logMinionGroupingCombat('performMinionGroupAttack member activation failed', {
				combatId: this.id ?? null,
				memberCombatantId: resolvedActionContext.memberId,
				actionId: resolvedActionContext.selectedActionId,
				error,
			});
			return this.#buildSkippedMinionAttackOutcome(
				resolvedActionContext.memberId,
				'activationFailed',
				resolvedActionContext.unsupportedWarning,
			);
		}
	}

	async #applyActionConsumptionUpdates(updates: Record<string, unknown>[]): Promise<void> {
		if (updates.length < 1) return;
		await this.updateEmbeddedDocuments('Combatant', updates);
	}

	async #maybeAssignTemporaryGroup(params: {
		rolledCombatantIds: string[];
		attackMembers: Combatant.Implementation[];
	}): Promise<void> {
		if (params.rolledCombatantIds.length < 1) return;

		const attackMemberIds = params.attackMembers
			.map((member) => member.id)
			.filter((memberId): memberId is string => typeof memberId === 'string');
		if (attackMemberIds.length < 1) return;

		await this.#assignNcsTemporaryGroupFromAttackMembers(attackMemberIds);
	}

	async #buildNcsAttackChatData(params: {
		activeTargetTokenIds: string[];
		rollEntries: MinionGroupAttackRollEntry[];
		skippedMembers: MinionGroupAttackSkippedMember[];
		unsupportedWarnings: string[];
		attackMembers: Combatant.Implementation[];
	}): Promise<{ chatMessageId: string | null; totalDamage: number }> {
		if (params.rollEntries.length < 1) {
			return { chatMessageId: null, totalDamage: 0 };
		}

		const totalDamage = params.rollEntries.reduce((sum, entry) => sum + entry.totalDamage, 0);
		const targetName =
			params.activeTargetTokenIds.length === 1
				? getTargetTokenName(params.activeTargetTokenIds[0])
				: `${params.activeTargetTokenIds.length} targets`;
		const chatCard = await this.#createNcsGroupAttackChatMessage({
			groupLabel: null,
			targetTokenIds: params.activeTargetTokenIds,
			targetName,
			rollEntries: params.rollEntries,
			totalDamage,
			skippedMembers: params.skippedMembers,
			unsupportedWarnings: params.unsupportedWarnings,
			attackMembers: params.attackMembers,
		});

		return {
			chatMessageId: chatCard?.id ?? null,
			totalDamage,
		};
	}

	async #maybeAdvanceTurnAfterAttack(params: {
		endTurn: boolean;
		attackMembers: Combatant.Implementation[];
	}): Promise<boolean> {
		if (!params.endTurn) return false;

		const activeCombatantId = this.combatant?.id ?? '';
		const attackedActiveCombatant = params.attackMembers.some(
			(member) => (member.id ?? '') === activeCombatantId,
		);
		if (!attackedActiveCombatant) {
			logMinionGroupingCombat(
				'performMinionGroupAttack skipped end-turn because active turn was outside attack scope',
				{
					combatId: this.id ?? null,
					activeCombatantId: this.combatant?.id ?? null,
					attackedActiveCombatant,
				},
			);
			return false;
		}

		await this.nextTurn();
		return true;
	}

	#resolveMinionGroupAttackExecutionContext(params: {
		normalizedParams: NormalizedMinionGroupAttackParams;
		result: MinionGroupAttackResult;
	}): {
		resolvedTargets: ResolvedMinionGroupAttackTargets;
		attackMembers: Combatant.Implementation[];
	} | null {
		if (!game.user?.isGM) {
			logMinionGroupingCombat('performMinionGroupAttack blocked because user is not GM');
			return null;
		}

		if (params.normalizedParams.memberCombatantIds.length < 1) {
			logMinionGroupingCombat('performMinionGroupAttack blocked because member scope is missing', {
				memberCombatantIds: params.normalizedParams.memberCombatantIds,
				targetTokenIds: params.normalizedParams.targetTokenIds,
			});
			return null;
		}

		const resolvedTargets = this.#resolveSelectedTargets(params.normalizedParams.targetTokenIds);
		if (!resolvedTargets) {
			logMinionGroupingCombat(
				'performMinionGroupAttack blocked because at least one target is required',
				{ memberCombatantIds: params.normalizedParams.memberCombatantIds },
			);
			return null;
		}

		const attackMembers = this.#resolveAttackMembers(params.normalizedParams.memberCombatantIds);
		if (attackMembers.length < 1) {
			logMinionGroupingCombat(
				'performMinionGroupAttack blocked because no eligible attack members were found',
				{
					combatId: this.id ?? null,
					memberCombatantIds: params.normalizedParams.memberCombatantIds,
				},
			);
			return null;
		}

		params.result.targetTokenId = resolvedTargets.primaryTargetTokenId;
		return { resolvedTargets, attackMembers };
	}

	async #collectMinionAttackRollData(params: {
		attackMembers: Combatant.Implementation[];
		selectionsByMemberId: ReadonlyMap<string, string>;
		result: MinionGroupAttackResult;
	}): Promise<{
		actionUpdates: Record<string, unknown>[];
		rollEntries: MinionGroupAttackRollEntry[];
		unsupportedWarnings: string[];
	}> {
		const actionUpdates: Record<string, unknown>[] = [];
		const unsupportedWarnings = new Set<string>();
		const rollEntries: MinionGroupAttackRollEntry[] = [];
		for (const member of params.attackMembers) {
			const rollOutcome = await this.#rollSingleMinionAttack({
				member,
				selectionsByMemberId: params.selectionsByMemberId,
			});
			appendMinionAttackRollOutcome({
				rollOutcome,
				result: params.result,
				rollEntries,
				actionUpdates,
				unsupportedWarnings,
			});
		}
		return {
			actionUpdates,
			rollEntries,
			unsupportedWarnings: [...unsupportedWarnings],
		};
	}

	async performMinionGroupAttack(
		params: MinionGroupAttackParams,
	): Promise<MinionGroupAttackResult> {
		const normalizedParams = this.#normalizeAttackParams(params);
		const result = createMinionGroupAttackResult(normalizedParams.targetTokenIds);

		logMinionGroupingCombat('performMinionGroupAttack called', {
			combatId: this.id ?? null,
			memberCombatantIds: normalizedParams.memberCombatantIds,
			targetTokenIds: normalizedParams.targetTokenIds,
			selectionCount: normalizedParams.selectionsByMemberId.size,
			requestedEndTurn: normalizedParams.endTurn,
		});

		const executionContext = this.#resolveMinionGroupAttackExecutionContext({
			normalizedParams,
			result,
		});
		if (!executionContext) return result;

		const { resolvedTargets, attackMembers } = executionContext;
		const rollData = await this.#collectMinionAttackRollData({
			attackMembers,
			selectionsByMemberId: normalizedParams.selectionsByMemberId,
			result,
		});
		await this.#applyActionConsumptionUpdates(rollData.actionUpdates);
		await this.#maybeAssignTemporaryGroup({
			rolledCombatantIds: result.rolledCombatantIds,
			attackMembers,
		});

		const chatData = await this.#buildNcsAttackChatData({
			activeTargetTokenIds: resolvedTargets.activeTargetTokenIds,
			rollEntries: rollData.rollEntries,
			skippedMembers: result.skippedMembers,
			unsupportedWarnings: rollData.unsupportedWarnings,
			attackMembers,
		});
		result.totalDamage = chatData.totalDamage;
		result.chatMessageId = chatData.chatMessageId;
		result.endTurnApplied = await this.#maybeAdvanceTurnAfterAttack({
			endTurn: normalizedParams.endTurn,
			attackMembers,
		});
		result.unsupportedSelectionWarnings = rollData.unsupportedWarnings;

		logMinionGroupingCombat('performMinionGroupAttack completed', {
			combatId: this.id ?? null,
			targetTokenId: result.targetTokenId,
			targetTokenIds: resolvedTargets.activeTargetTokenIds,
			rolledCombatantIds: result.rolledCombatantIds,
			skippedMembers: result.skippedMembers,
			unsupportedSelectionWarnings: result.unsupportedSelectionWarnings,
			endTurnApplied: result.endTurnApplied,
			totalDamage: result.totalDamage,
			chatMessageId: result.chatMessageId ?? null,
		});
		return result;
	}

	#applyCharacterInitiativeActionUpdate(
		combatant: Combatant.Implementation,
		combatantUpdates: Record<string, unknown>,
		rollTotal: number,
	): void {
		if (combatant.type !== 'character') return;

		const actionPath = 'system.actions.base.current';
		if (rollTotal >= 20) {
			combatantUpdates[actionPath] = 3;
			return;
		}
		if (rollTotal >= 10) {
			combatantUpdates[actionPath] = 2;
			return;
		}
		combatantUpdates[actionPath] = 1;
	}

	async #buildInitiativeChatData(params: {
		combatant: Combatant.Implementation;
		roll: Roll;
		messageOptions: ChatMessage.CreateData;
		chatRollMode: string | null;
		rollIndex: number;
	}): Promise<ChatMessage.CreateData> {
		const messageData = foundry.utils.mergeObject(
			{
				speaker: ChatMessage.getSpeaker({
					actor: params.combatant.actor,
					token: params.combatant.token,
					alias: params.combatant.name ?? undefined,
				}),
				flavor: game.i18n.format('COMBAT.RollsInitiative', { name: params.combatant.name ?? '' }),
				flags: { 'core.initiativeRoll': true },
			},
			params.messageOptions,
		) as ChatMessage.CreateData;
		const chatData = (await params.roll.toMessage(messageData, {
			create: false,
		})) as ChatMessage.CreateData & { rollMode?: string | null; sound?: string | null };

		// If the combatant is hidden, use a private roll unless an alternative rollMode was requested.
		const msgOpts = params.messageOptions as ChatMessage.CreateData & { rollMode?: string };
		chatData.rollMode =
			'rollMode' in msgOpts
				? (msgOpts.rollMode ?? undefined)
				: params.combatant.hidden
					? CONST.DICE_ROLL_MODES.PRIVATE
					: params.chatRollMode;

		// Play 1 sound for the whole rolled set.
		if (params.rollIndex > 0) chatData.sound = null;
		return chatData;
	}

	async #rollInitiativeForCombatant(params: {
		combatantId: string;
		formula: string | null;
		messageOptions: ChatMessage.CreateData;
		chatRollMode: string | null;
		rollIndex: number;
		combatManaUpdates: Promise<unknown>[];
	}): Promise<InitiativeRollOutcome | null> {
		const combatant = this.combatants.get(params.combatantId);
		if (!combatant?.isOwner) return null;

		const combatantUpdates: Record<string, unknown> = { _id: params.combatantId };

		const roll = combatant.getInitiativeRoll(params.formula ?? undefined);
		await roll.evaluate();
		const rollTotal = roll.total ?? 0;
		combatantUpdates.initiative = rollTotal;
		this.#applyCharacterInitiativeActionUpdate(combatant, combatantUpdates, rollTotal);

		await handleInitiativeRules({
			combatId: this.id,
			combatManaUpdates: params.combatManaUpdates,
			combatant,
		});

		const chatData = await this.#buildInitiativeChatData({
			combatant,
			roll,
			messageOptions: params.messageOptions,
			chatRollMode: params.chatRollMode,
			rollIndex: params.rollIndex,
		});

		return {
			combatantUpdate: combatantUpdates,
			chatData,
		};
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
			const rollOutcome = await this.#rollInitiativeForCombatant({
				combatantId: id,
				formula,
				messageOptions,
				chatRollMode,
				rollIndex: i,
				combatManaUpdates,
			});
			if (!rollOutcome) continue;
			updates.push(rollOutcome.combatantUpdate);
			messages.push(rollOutcome.chatData);
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
		const turns = super.setupTurns();
		return turns.filter((combatant) => !isCombatantDead(combatant));
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
		if (!game.user?.isGM) return false;

	#resolveDropTargetFromEvent(params: {
		event: DragEvent & { target: EventTarget & HTMLElement };
	}): { target: Combatant.Implementation | null; sortBefore: boolean | null } {
		const dropTargetElement = (params.event.target as HTMLElement).closest<HTMLElement>(
			'[data-combatant-id]',
		);
		const targetId = dropTargetElement?.dataset.combatantId ?? '';
		const target = targetId ? (this.combatants.get(targetId) ?? null) : null;
		if (!target || !dropTargetElement) {
			return { target, sortBefore: null };
		}

		const rect = dropTargetElement.getBoundingClientRect();
		return {
			target,
			sortBefore: params.event.y < rect.top + rect.height / 2,
		};
	}

	#resolveDropTargetFromTrackerFallback(params: { trackerListElement: HTMLElement | null }): {
		target: Combatant.Implementation | null;
		sortBefore: boolean | null;
	} {
		const targetId = params.trackerListElement?.dataset.dropTargetId ?? '';
		if (!targetId) return { target: null, sortBefore: null };

		const target = this.combatants.get(targetId) ?? null;
		if (!target) return { target: null, sortBefore: null };
		return {
			target,
			sortBefore: params.trackerListElement?.dataset.dropBefore === 'true',
		};
	}

	#resolveDropTarget(params: {
		event: DragEvent & { target: EventTarget & HTMLElement };
		trackerListElement: HTMLElement | null;
	}): DropTargetResolution | null {
		const eventTargetResolution = this.#resolveDropTargetFromEvent({ event: params.event });
		const { target, sortBefore } = eventTargetResolution.target
			? eventTargetResolution
			: this.#resolveDropTargetFromTrackerFallback({
					trackerListElement: params.trackerListElement,
				});
		if (!target) return null;
		if (isCombatantDead(target)) return null;
		if (sortBefore === null) return null;
		return { target, sortBefore };
	}

	#isValidDropPair(source: Combatant.Implementation, target: Combatant.Implementation): boolean {
		const sourceTypePriority = getCombatantTypePriority(source);
		const targetTypePriority = getCombatantTypePriority(target);
		if (sourceTypePriority !== targetTypePriority) return false;
		if (source.id === target.id) return false;
		return true;
	}

	#resolveDropSiblings(
		source: Combatant.Implementation,
		sourceTypePriority: number,
	): Combatant.Implementation[] {
		return this.turns.filter(
			(combatant) =>
				combatant.id !== source.id &&
				!isCombatantDead(combatant) &&
				getCombatantTypePriority(combatant) === sourceTypePriority,
		);
	}

	#resolveDropContext(
		event: DragEvent & { target: EventTarget & HTMLElement },
	): DropResolution | null {
		const trackerListElement = (event.target as HTMLElement).closest<HTMLElement>(
			'.nimble-combatants',
		);
		const dropData = foundry.applications.ux.TextEditor.implementation.getDragEventData(
			event,
		) as unknown as Record<string, string>;
		const source = this.#resolveDropSource({ dropData, trackerListElement });
		if (!source) return null;

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
		const siblings = this.#resolveDropSiblings(source, sourceTypePriority);
		return {
			source,
			target: dropTargetResolution.target,
			siblings,
			sortBefore: dropTargetResolution.sortBefore,
			previousActiveCombatantId: this.combatant?.id ?? null,
		};
	}

		if (source.id === target.id) return false;

		const siblings = this.turns.filter(
			(c) =>
				c.id !== source.id &&
				!isCombatantDead(c) &&
				getCombatantTypePriority(c) === sourceTypePriority,
		);
		if (sortBefore === null) return false;

			const updateData = sortUpdates.map((u) => {
				const { update } = u;
				return {
					...update,
					_id: u.target.id,
				};
			});

		const updates = await this.updateEmbeddedDocuments('Combatant', updateData);
		this.turns = this.setupTurns();
		await this.#syncTurnToCombatant(dropResolution.previousActiveCombatantId);
		return updates;
	}

	async #applyOwnerSort(dropResolution: DropResolution) {
		// Non-GM owners can reorder their own character card by updating only their card's sort value.
		const newSortValue = getSourceSortValueForDrop(
			dropResolution.source,
			dropResolution.target,
			dropResolution.siblings,
			dropResolution.sortBefore,
		);
		if (newSortValue === null || !Number.isFinite(newSortValue)) return false;

		const updated = await dropResolution.source.update({
			'system.sort': newSortValue,
		} as Record<string, unknown>);
		this.turns = this.setupTurns();
		await this.#syncTurnToCombatant(dropResolution.previousActiveCombatantId, { persist: false });
		return updated ? [updated] : [];
	}

	async _onDrop(event: DragEvent & { target: EventTarget & HTMLElement }) {
		event.preventDefault();

		const dropResolution = this.#resolveDropContext(event);
		if (!dropResolution) return false;

		if (game.user?.isGM) {
			return this.#applyGmSort(dropResolution);
		}

		return this.#applyOwnerSort(dropResolution);
	}
}

export { NimbleCombat };
