import { createSubscriber } from 'svelte/reactivity';
import {
	canOwnerUseHeroicReaction,
	getHeroicReactionAvailability,
	getHeroicReactionAvailabilityUpdate,
	HEROIC_REACTIONS,
	type HeroicReactionKey,
} from '../../utils/heroicActions.js';
import { isCombatantDead } from '../../utils/isCombatantDead.js';
import { getMinionGroupId, getMinionGroupSummaries } from '../../utils/minionGrouping.js';
import type { NimbleCombatant } from '../combatant/combatant.svelte.js';
import { getCombatantBaseActionMax } from './combatantSystem.js';
import { getCombatantCurrentActions, logMinionGroupingCombat } from './combatCommon.js';
import { rollInitiativeForCombatant } from './combatInitiative.js';
import { performMinionGroupAttack } from './combatMinionAttacks.js';
import {
	assignNcsTemporaryGroupFromAttackMembers,
	dissolveRoundBoundaryMinionGroups,
} from './combatMinionGroups.js';
import {
	applyGmSort,
	applyOwnerSort,
	resolveDropContext,
	sortCombatants,
} from './combatSorting.js';
import { expandLegendaryTurns, normalizeMinionTurns } from './combatTurns.js';
import type {
	MinionGroupAttackParams,
	MinionGroupAttackResult,
	TurnIdentity,
} from './combatTypes.js';
import {
	buildExpandedTurnIdentityUpdate,
	getExpandedTurnIdentityHint,
	getPersistedExpandedTurnIdentity,
	setExpandedTurnIdentityHint,
} from './expandedTurnIdentityStore.js';

type CombatWithTurnIdentityHint = Combat & {
	_nimbleExpandedTurnIdentity?: TurnIdentity | null;
};

class NimbleCombat extends Combat {
	#subscribe: ReturnType<typeof createSubscriber>;
	#expandedTurnIdentity: TurnIdentity | null = null;
	#pendingAtomicTurnIdentity: TurnIdentity | null = null;
	#didInterceptAtomicTurnStateUpdate = false;

	#readStoredExpandedTurnIdentity(): TurnIdentity | null {
		const persistedTurnIdentity = getPersistedExpandedTurnIdentity(this);
		if (persistedTurnIdentity) {
			this.#storeExpandedTurnIdentity(persistedTurnIdentity);
			return persistedTurnIdentity;
		}
		const hintedTurnIdentity = getExpandedTurnIdentityHint(this.id ?? null);
		if (hintedTurnIdentity) {
			this.#storeExpandedTurnIdentity(hintedTurnIdentity);
		}
		return hintedTurnIdentity;
	}

	#storeExpandedTurnIdentity(turnIdentity: TurnIdentity | null): void {
		this.#expandedTurnIdentity = turnIdentity;
		(this as CombatWithTurnIdentityHint)._nimbleExpandedTurnIdentity = turnIdentity;
		setExpandedTurnIdentityHint(this.id ?? null, turnIdentity);
	}

	#resolveTurnIdentityAtIndex(
		turns: Combatant.Implementation[],
		turnIndex: number | null,
	): TurnIdentity | null {
		if (
			!Number.isInteger(turnIndex) ||
			turnIndex == null ||
			turnIndex < 0 ||
			turnIndex >= turns.length
		) {
			return null;
		}
		const combatantId = turns[turnIndex]?.id ?? '';
		if (!combatantId) return null;
		return {
			combatantId,
			occurrence: this.#getCombatantOccurrenceAtIndex(turns, combatantId, turnIndex),
		};
	}

	#resolveCurrentTurnIdentity(
		turns: Combatant.Implementation[] = this.turns,
		fallbackCombatantId?: string | null,
	): TurnIdentity | null {
		const storedTurnIdentity = this.#readStoredExpandedTurnIdentity();
		if (storedTurnIdentity) return storedTurnIdentity;
		if (this.#expandedTurnIdentity) return this.#expandedTurnIdentity;

		const normalizedCurrentTurn =
			typeof this.turn === 'number' && this.turn >= 0 && this.turn < turns.length
				? this.turn
				: null;
		const indexedTurnIdentity = this.#resolveTurnIdentityAtIndex(turns, normalizedCurrentTurn);
		if (indexedTurnIdentity) return indexedTurnIdentity;

		const explicitCombatantId = fallbackCombatantId ?? this.combatant?.id ?? null;

		if (explicitCombatantId) {
			return { combatantId: explicitCombatantId, occurrence: null };
		}

		return null;
	}

	#resolveNextTurnIdentity(turns: Combatant.Implementation[] = this.turns): TurnIdentity | null {
		if (turns.length < 1) return null;
		const normalizedCurrentTurn =
			typeof this.turn === 'number' && this.turn >= 0 && this.turn < turns.length ? this.turn : 0;
		const nextTurnIndex = (normalizedCurrentTurn + 1) % turns.length;
		return this.#resolveTurnIdentityAtIndex(turns, nextTurnIndex);
	}

	#resolvePreviousTurnIdentity(
		turns: Combatant.Implementation[] = this.turns,
	): TurnIdentity | null {
		if (turns.length < 1) return null;
		const normalizedCurrentTurn =
			typeof this.turn === 'number' && this.turn >= 0 && this.turn < turns.length ? this.turn : 0;
		const previousTurnIndex = (normalizedCurrentTurn - 1 + turns.length) % turns.length;
		return this.#resolveTurnIdentityAtIndex(turns, previousTurnIndex);
	}

	#findTurnIndexByIdentity(
		turns: Combatant.Implementation[],
		turnIdentity: TurnIdentity | null,
	): number {
		if (!turnIdentity?.combatantId) return -1;
		return this.#findTurnIndexByOccurrence(
			turns,
			turnIdentity.combatantId,
			turnIdentity.occurrence,
		);
	}

	#buildAtomicTurnStateUpdate(updateData: Record<string, unknown> = {}): Record<string, unknown> {
		const shouldAugmentTurnState =
			this.#pendingAtomicTurnIdentity !== null || 'turn' in updateData || 'round' in updateData;
		if (!shouldAugmentTurnState) return { ...updateData };

		const nextUpdateData = { ...updateData };
		const normalizedTurns = this.setupTurns();

		if (normalizedTurns.length < 1) {
			nextUpdateData.turn = 0;
			Object.assign(nextUpdateData, buildExpandedTurnIdentityUpdate(null));
			this.#storeExpandedTurnIdentity(null);
			return nextUpdateData;
		}

		const requestedTurnIdentity =
			this.#pendingAtomicTurnIdentity &&
			this.#findTurnIndexByIdentity(normalizedTurns, this.#pendingAtomicTurnIdentity) >= 0
				? this.#pendingAtomicTurnIdentity
				: null;
		const fallbackTurn = Number.isInteger(nextUpdateData.turn)
			? Number(nextUpdateData.turn)
			: Number.isInteger(this.turn)
				? Number(this.turn)
				: 0;
		const fallbackTurnIndex = Math.min(Math.max(fallbackTurn, 0), normalizedTurns.length - 1);
		const targetTurnIndex =
			requestedTurnIdentity == null
				? fallbackTurnIndex
				: this.#findTurnIndexByIdentity(normalizedTurns, requestedTurnIdentity);
		const persistedTurnIdentity =
			this.#resolveTurnIdentityAtIndex(normalizedTurns, targetTurnIndex) ?? requestedTurnIdentity;

		nextUpdateData.turn = targetTurnIndex;
		Object.assign(nextUpdateData, buildExpandedTurnIdentityUpdate(persistedTurnIdentity));
		this.#storeExpandedTurnIdentity(persistedTurnIdentity);
		return nextUpdateData;
	}

	async #runAtomicTurnStateOperation<T>(
		preferredTurnIdentity: TurnIdentity | null,
		operation: () => Promise<T>,
	): Promise<{ intercepted: boolean; result: T }> {
		const previousPendingTurnIdentity = this.#pendingAtomicTurnIdentity;
		const previousInterceptedState = this.#didInterceptAtomicTurnStateUpdate;
		this.#pendingAtomicTurnIdentity = preferredTurnIdentity;
		this.#didInterceptAtomicTurnStateUpdate = false;
		try {
			const result = await operation();
			return {
				intercepted: this.#didInterceptAtomicTurnStateUpdate,
				result,
			};
		} finally {
			this.#pendingAtomicTurnIdentity = previousPendingTurnIdentity;
			this.#didInterceptAtomicTurnStateUpdate = previousInterceptedState;
		}
	}

	async #persistAtomicTurnState(updateData: Record<string, unknown> = {}): Promise<void> {
		const nextUpdateData = this.#buildAtomicTurnStateUpdate(updateData);
		if (Object.keys(nextUpdateData).length < 1) return;
		await this.update(nextUpdateData);
	}

	async #syncTurnToCombatant(
		combatantIdOrIdentity: string | TurnIdentity | null | undefined,
		options: { persist?: boolean } = {},
	): Promise<void> {
		const turnIdentity =
			typeof combatantIdOrIdentity === 'string'
				? { combatantId: combatantIdOrIdentity, occurrence: null }
				: (combatantIdOrIdentity ?? null);
		if (!turnIdentity?.combatantId) return;

		const nextTurnIndex = this.#findTurnIndexByIdentity(this.turns, turnIdentity);
		if (nextTurnIndex < 0) return;
		const normalizedCurrentTurn = Number.isInteger(this.turn) ? Number(this.turn) : 0;
		if (nextTurnIndex === normalizedCurrentTurn) return;

		// Keep local state consistent immediately; persist for GM-driven operations.
		this.turn = nextTurnIndex;
		this.#storeExpandedTurnIdentity(
			this.#resolveTurnIdentityAtIndex(this.turns, nextTurnIndex) ?? turnIdentity,
		);
		if (options.persist === false) return;
		await this.#persistAtomicTurnState({ turn: nextTurnIndex });
	}

	#getCombatantOccurrenceAtIndex(
		turns: Combatant.Implementation[],
		combatantId: string,
		inclusiveIndex: number,
	): number {
		let occurrence = -1;
		for (let index = 0; index <= inclusiveIndex && index < turns.length; index += 1) {
			if ((turns[index]?.id ?? '') === combatantId) occurrence += 1;
		}
		return occurrence;
	}

	#findTurnIndexByOccurrence(
		turns: Combatant.Implementation[],
		combatantId: string,
		desiredOccurrence: number | null,
	): number {
		let occurrence = -1;
		for (const [index, turnCombatant] of turns.entries()) {
			if ((turnCombatant?.id ?? '') !== combatantId) continue;
			occurrence += 1;
			if (desiredOccurrence === null || occurrence === desiredOccurrence) return index;
		}
		return -1;
	}

	#syncTurnIndexWithAliveTurns(options: { preferredTurnIdentity?: TurnIdentity | null } = {}) {
		const currentTurnIdentity =
			options.preferredTurnIdentity ?? this.#resolveCurrentTurnIdentity(this.turns);
		const aliveTurns = this.setupTurns();
		this.turns = aliveTurns;

		if (aliveTurns.length === 0) {
			this.turn = 0;
			this.#storeExpandedTurnIdentity(null);
			return;
		}

		if (currentTurnIdentity?.combatantId) {
			const matchedIndex = this.#findTurnIndexByIdentity(aliveTurns, currentTurnIdentity);
			if (matchedIndex >= 0) {
				this.turn = matchedIndex;
				this.#storeExpandedTurnIdentity(
					this.#resolveTurnIdentityAtIndex(aliveTurns, matchedIndex) ?? currentTurnIdentity,
				);
				return;
			}
		}

		const currentTurn = Number.isInteger(this.turn) ? Number(this.turn) : 0;
		this.turn = Math.min(Math.max(currentTurn, 0), aliveTurns.length - 1);
		this.#storeExpandedTurnIdentity(this.#resolveTurnIdentityAtIndex(aliveTurns, this.turn));
	}
	#combatantHasAnyActionsRemaining(combatant: Combatant.Implementation): boolean {
		if (combatant.type === 'character' || combatant.type === 'soloMonster') return true;

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
			if (activeCombatant.type === 'character' || activeCombatant.type === 'soloMonster') break;
			if (this.#combatantHasAnyActionsRemaining(activeCombatant)) break;

			const previousActiveId = activeCombatant.id ?? null;
			const preferredNextTurnIdentity = this.#resolveNextTurnIdentity();
			const { intercepted, result: nextTurnResult } = await this.#runAtomicTurnStateOperation(
				preferredNextTurnIdentity,
				async () => (await super.nextTurn()) as this,
			);
			nextResult = nextTurnResult;
			this.#syncTurnIndexWithAliveTurns({ preferredTurnIdentity: preferredNextTurnIdentity });
			if (!intercepted) {
				await this.#persistAtomicTurnState({ turn: this.turn });
			}
			const nextActiveId = this.combatant?.id ?? null;
			if (!nextActiveId || nextActiveId === previousActiveId) break;
		}

		return nextResult;
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
				return {
					_id: combatant.id,
					'system.actions.base.current': getCombatantBaseActionMax(combatant),
				};
			});
		if (updates.length < 1) return;
		await this.updateEmbeddedDocuments('Combatant', updates);
	}

	#buildHeroicReactionAvailabilityUpdate(available: boolean): Record<string, unknown> {
		const update: Record<string, unknown> = {};
		for (const reactionKey of HEROIC_REACTIONS) {
			for (const [path, value] of Object.entries(
				getHeroicReactionAvailabilityUpdate(reactionKey, available),
			)) {
				update[path] = value;
			}
		}
		return update;
	}

	async #refreshCharacterHeroicReactions(): Promise<void> {
		const updates = this.combatants.contents.reduce<Record<string, unknown>[]>((acc, combatant) => {
			if (combatant.type !== 'character' || !combatant.id) return acc;
			const needsRefresh = HEROIC_REACTIONS.some(
				(reactionKey) => !getHeroicReactionAvailability(combatant, reactionKey),
			);
			if (!needsRefresh) return acc;
			acc.push({
				_id: combatant.id,
				...this.#buildHeroicReactionAvailabilityUpdate(true),
			});
			return acc;
		}, []);
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
		this.turns = this.setupTurns();
		const preferredStartTurnIdentity = this.#resolveTurnIdentityAtIndex(
			this.turns,
			this.#resolveStartCombatTurnIndex(),
		);
		const { intercepted, result } = await this.#runAtomicTurnStateOperation(
			preferredStartTurnIdentity,
			async () => (await super.startCombat()) as this,
		);

		const sceneId = this.scene?.id;
		const unrolledCharacterIds =
			sceneId == null
				? []
				: this.combatants
						.filter(
							(combatant) =>
								combatant.initiative === null &&
								combatant.type === 'character' &&
								combatant.sceneId === sceneId,
						)
						.map((combatant) => combatant.id)
						.filter((combatantId): combatantId is string => combatantId != null);

		if (unrolledCharacterIds.length > 0) {
			await this.rollInitiative(unrolledCharacterIds, { updateTurn: false });
		}

		await this.#applyNpcActionResetUpdates();
		await this.#refreshCharacterHeroicReactions();

		if (preferredStartTurnIdentity) {
			this.#syncTurnIndexWithAliveTurns({ preferredTurnIdentity: preferredStartTurnIdentity });
		} else {
			this.#syncTurnIndexWithAliveTurns();
		}
		if (!intercepted && this.turns.length > 0) {
			await this.#persistAtomicTurnState({ turn: this.turn });
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
			await combatant.update({
				'system.actions.base.current': getCombatantBaseActionMax(combatant),
			} as Record<string, unknown>);
		}
	}

	override async _onEndRound() {
		// Reset only non-character combatants' actions at end of round.
		await this.#applyNpcActionResetUpdates();

		await dissolveRoundBoundaryMinionGroups({
			combat: this,
			resolveCurrentTurnIdentity: () => this.#resolveCurrentTurnIdentity(),
			syncTurnToCombatant: (combatantIdOrIdentity, options) =>
				this.#syncTurnToCombatant(combatantIdOrIdentity, options),
		});
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

	async toggleHeroicReactionAvailability(
		combatantId: string,
		reactionKey: HeroicReactionKey,
	): Promise<boolean> {
		if (!combatantId) return false;

		const combatant = this.combatants.get(combatantId);
		if (!combatant || combatant.parent?.id !== this.id) return false;
		if (combatant.type !== 'character') return false;
		if (isCombatantDead(combatant)) return false;

		const currentlyAvailable = getHeroicReactionAvailability(combatant, reactionKey);
		const canAdministerSpentReaction = Boolean(game.user?.isGM);
		const canSpendAvailableReaction = Boolean(
			game.user?.isGM || (canOwnerUseHeroicReaction(reactionKey) && combatant.actor?.isOwner),
		);
		if (!currentlyAvailable) {
			if (!canAdministerSpentReaction) return false;
			await this.updateEmbeddedDocuments('Combatant', [
				{
					_id: combatantId,
					...getHeroicReactionAvailabilityUpdate(reactionKey, true),
				},
			]);
			return true;
		}

		if (!canSpendAvailableReaction) return false;
		const currentActions = getCombatantCurrentActions(combatant);
		if (!game.user?.isGM) {
			if ((this.round ?? 0) < 1) return false;
			if ((this.combatant?.id ?? null) === combatantId) return false;
			if (currentActions < 1) return false;
		}

		const reactionAvailabilityUpdate = {
			_id: combatantId,
			...getHeroicReactionAvailabilityUpdate(reactionKey, false),
		} as Record<string, unknown>;
		if (!game.user?.isGM) {
			reactionAvailabilityUpdate['system.actions.base.current'] = Math.max(0, currentActions - 1);
		}

		await this.updateEmbeddedDocuments('Combatant', [reactionAvailabilityUpdate]);
		return true;
	}

	async performMinionGroupAttack(
		params: MinionGroupAttackParams,
	): Promise<MinionGroupAttackResult> {
		return performMinionGroupAttack({
			combat: this,
			attackParams: params,
			assignNcsTemporaryGroupFromAttackMembers: (memberCombatantIds) =>
				assignNcsTemporaryGroupFromAttackMembers({
					combat: this,
					turns: this.turns,
					memberCombatantIds,
					resolveCurrentTurnIdentity: () => this.#resolveCurrentTurnIdentity(),
					syncTurnToCombatant: (combatantIdOrIdentity, options) =>
						this.#syncTurnToCombatant(combatantIdOrIdentity, options),
				}),
		});
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
			const rollOutcome = await rollInitiativeForCombatant({
				combat: this,
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
		const aliveTurns = super.setupTurns().filter((combatant) => !isCombatantDead(combatant));
		const minionNormalizedTurns = normalizeMinionTurns(aliveTurns);
		return expandLegendaryTurns(minionNormalizedTurns);
	}

	override async nextTurn(): Promise<this> {
		this.#syncTurnIndexWithAliveTurns();
		const preferredNextTurnIdentity = this.#resolveNextTurnIdentity();
		const { intercepted, result: nextTurnResult } = await this.#runAtomicTurnStateOperation(
			preferredNextTurnIdentity,
			async () => (await super.nextTurn()) as this,
		);
		let result = nextTurnResult;
		this.#syncTurnIndexWithAliveTurns({ preferredTurnIdentity: preferredNextTurnIdentity });
		if (!intercepted) {
			await this.#persistAtomicTurnState({ turn: this.turn });
		}
		result = await this.#advancePastExhaustedTurns(result);
		return result;
	}

	override async nextRound(): Promise<this> {
		this.#syncTurnIndexWithAliveTurns();
		const preferredFirstTurnIdentity = this.#resolveTurnIdentityAtIndex(this.turns, 0);
		const { intercepted, result } = await this.#runAtomicTurnStateOperation(
			preferredFirstTurnIdentity,
			async () => (await super.nextRound()) as this,
		);
		this.#syncTurnIndexWithAliveTurns({ preferredTurnIdentity: preferredFirstTurnIdentity });
		if (!intercepted) {
			await this.#persistAtomicTurnState({ turn: this.turn });
		}
		await this.#refreshCharacterHeroicReactions();
		return result;
	}

	override async previousTurn(): Promise<this> {
		this.#syncTurnIndexWithAliveTurns();
		const preferredPreviousTurnIdentity = this.#resolvePreviousTurnIdentity();
		const { intercepted, result } = await this.#runAtomicTurnStateOperation(
			preferredPreviousTurnIdentity,
			async () => (await super.previousTurn()) as this,
		);
		this.#syncTurnIndexWithAliveTurns({
			preferredTurnIdentity: preferredPreviousTurnIdentity,
		});
		if (!intercepted) {
			await this.#persistAtomicTurnState({ turn: this.turn });
		}
		return result;
	}

	override async previousRound(): Promise<this> {
		this.#syncTurnIndexWithAliveTurns();
		const preferredLastTurnIdentity = this.#resolveTurnIdentityAtIndex(
			this.turns,
			Math.max(this.turns.length - 1, 0),
		);
		const { intercepted, result } = await this.#runAtomicTurnStateOperation(
			preferredLastTurnIdentity,
			async () => (await super.previousRound()) as this,
		);
		this.#syncTurnIndexWithAliveTurns({ preferredTurnIdentity: preferredLastTurnIdentity });
		if (!intercepted) {
			await this.#persistAtomicTurnState({ turn: this.turn });
		}
		return result;
	}

	override update(...args: Parameters<Combat['update']>): Promise<this | undefined> {
		const [updateData, operation] = args;
		if (updateData == null || typeof updateData !== 'object' || Array.isArray(updateData)) {
			return super.update(...args) as Promise<this | undefined>;
		}

		const shouldAugmentTurnState =
			this.#pendingAtomicTurnIdentity !== null || 'turn' in updateData || 'round' in updateData;
		if (!shouldAugmentTurnState) {
			return super.update(...args) as Promise<this | undefined>;
		}

		this.#didInterceptAtomicTurnStateUpdate = true;
		const nextUpdateData = this.#buildAtomicTurnStateUpdate(
			updateData as Record<string, unknown>,
		) as Parameters<Combat['update']>[0];
		return super.update(nextUpdateData, operation) as Promise<this | undefined>;
	}

	override _sortCombatants(a: Combatant.Implementation, b: Combatant.Implementation): number {
		return sortCombatants(a, b);
	}

	async _onDrop(event: DragEvent & { target: EventTarget & HTMLElement }) {
		event.preventDefault();

		const dropResolution = resolveDropContext({
			combat: this,
			turns: this.turns,
			event,
			previousActiveTurnIdentity: this.#resolveCurrentTurnIdentity(),
		});
		if (!dropResolution) return false;

		if (game.user?.isGM) {
			return applyGmSort({
				combat: this,
				dropResolution,
				syncTurnToCombatant: (combatantIdOrIdentity, options) =>
					this.#syncTurnToCombatant(combatantIdOrIdentity, options),
			});
		}

		return applyOwnerSort({
			combat: this,
			dropResolution,
			syncTurnToCombatant: (combatantIdOrIdentity, options) =>
				this.#syncTurnToCombatant(combatantIdOrIdentity, options),
		});
	}
}

export { NimbleCombat };
