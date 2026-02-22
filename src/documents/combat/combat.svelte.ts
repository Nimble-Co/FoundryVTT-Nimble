import { createSubscriber } from 'svelte/reactivity';
import type { NimbleCombatant } from '../combatant/combatant.svelte.js';
import {
	canCurrentUserReorderCombatant,
	getCombatantTypePriority,
} from '../../utils/combatantOrdering.js';
import { isCombatantDead } from '../../utils/isCombatantDead.js';
import { handleInitiativeRules } from './handleInitiativeRules.js';
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
import { DamageRoll } from '../../dice/DamageRoll.js';
import {
	getPrimaryDamageFormulaFromActivationEffects,
	getUnsupportedActivationEffectTypes,
} from '../../utils/activationEffects.js';
import { getCombatantImage } from '../../utils/combatantImage.js';
import {
	getCurrentUserTargetTokenIds,
	getTargetTokenName,
	getTargetTokenUuid,
} from '../../utils/tokenTargetLookup.js';

/** Combatant system data with actions */
interface CombatantSystemWithActions {
	actions: {
		base: {
			current: number;
			max: number;
		};
	};
}

interface MinionGroupAttackSelection {
	memberCombatantId: string;
	actionId: string | null;
}

interface MinionGroupAttackParams {
	memberCombatantIds: string[];
	targetTokenIds?: string[];
	selections: MinionGroupAttackSelection[];
	endTurn?: boolean;
}

interface MinionGroupAttackSkippedMember {
	combatantId: string;
	reason: string;
}

interface MinionGroupAttackResult {
	targetTokenId: string;
	rolledCombatantIds: string[];
	skippedMembers: MinionGroupAttackSkippedMember[];
	unsupportedSelectionWarnings: string[];
	endTurnApplied: boolean;
	totalDamage: number;
	chatMessageId?: string | null;
}

interface NormalizedMinionGroupAttackParams {
	memberCombatantIds: string[];
	targetTokenIds: string[];
	selectionsByMemberId: Map<string, string>;
	endTurn: boolean;
}

interface ResolvedMinionGroupAttackTargets {
	activeTargetTokenIds: string[];
	primaryTargetTokenId: string;
}

interface MinionGroupAttackRollOutcome {
	rollEntry: MinionGroupAttackRollEntry | null;
	actionUpdate: Record<string, unknown> | null;
	skippedMember: MinionGroupAttackSkippedMember | null;
	unsupportedWarning: string | null;
}

interface DropResolution {
	source: Combatant.Implementation;
	target: Combatant.Implementation;
	siblings: Combatant.Implementation[];
	sortBefore: boolean;
	previousActiveCombatantId: string | null;
}

interface ItemLike {
	id?: string;
	name?: string;
	img?: string;
	system?: {
		activation?: {
			effects?: unknown[];
		};
	};
}

interface ActorWithActivateItem {
	type?: string;
	name?: string;
	items?: { contents?: ItemLike[] } | ItemLike[];
	activateItem?: (id: string, options?: Record<string, unknown>) => Promise<ChatMessage | null>;
	getRollData?: (item?: unknown) => Record<string, unknown>;
}

interface MinionGroupAttackRollEntry {
	memberCombatantId: string;
	memberName: string;
	memberImage: string | null;
	actionId: string;
	actionName: string;
	actionImage: string | null;
	formula: string;
	totalDamage: number;
	isMiss: boolean;
	rollData: Record<string, unknown> | null;
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
	const globals = globalThis as Record<string, unknown>;
	if (globals.NIMBLE_ENABLE_GROUP_LOGS !== true) return;
	if (globals.NIMBLE_DISABLE_GROUP_LOGS === true) return;
	// eslint-disable-next-line no-console
	console.info(`[Nimble][MinionGrouping][Combat] ${message}`, details);
}

function getCombatantCurrentActions(combatant: Combatant.Implementation): number {
	const currentActions = Number(
		(combatant.system as unknown as CombatantSystemWithActions).actions?.base?.current ?? 0,
	);
	if (!Number.isFinite(currentActions)) return 0;
	return currentActions;
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

		const speakerCombatant =
			params.attackMembers.find((member) =>
				params.rollEntries.some((entry) => entry.memberCombatantId === member.id),
			) ?? params.attackMembers[0];
		const speakerAlias = params.groupLabel?.trim()
			? `Minion Group ${params.groupLabel.trim().toUpperCase()}`
			: 'Selected Minions';
		const speakerImage =
			(speakerCombatant ? getCombatantImage(speakerCombatant) : null) ?? 'icons/svg/cowled.svg';
		const speakerPermissions = Number(
			(speakerCombatant?.actor as unknown as { permission?: number } | null)?.permission ?? 0,
		);
		const targetUuids = params.targetTokenIds
			.map((targetTokenId) => getTargetTokenUuid(targetTokenId))
			.filter((uuid): uuid is string => typeof uuid === 'string' && uuid.length > 0);
		const chatData = {
			author: game.user?.id,
			flavor: `${speakerAlias} attacks ${params.targetName}`,
			speaker: ChatMessage.getSpeaker({
				actor: speakerCombatant?.actor,
				token: speakerCombatant?.token,
				alias: speakerAlias,
			}),
			style: CONST.CHAT_MESSAGE_STYLES.OTHER,
			sound: CONFIG.sounds.dice,
			rollMode: game.settings.get('core', 'rollMode'),
			flags: {
				nimble: {
					chatCardType: 'minionGroupAttack',
				},
			},
			system: {
				actorName: speakerAlias,
				actorType: speakerCombatant?.actor?.type ?? 'minion',
				image: speakerImage,
				permissions: Number.isFinite(speakerPermissions) ? speakerPermissions : 0,
				rollMode: 0,
				targets: targetUuids,
				groupLabel: params.groupLabel ?? '',
				targetName: params.targetName,
				totalDamage: params.totalDamage,
				rows: params.rollEntries.map((entry) => ({
					memberCombatantId: entry.memberCombatantId,
					memberName: entry.memberName,
					memberImage: entry.memberImage,
					actionId: entry.actionId,
					actionName: entry.actionName,
					actionImage: entry.actionImage,
					formula: entry.formula,
					totalDamage: entry.totalDamage,
					isMiss: entry.isMiss,
					roll: entry.rollData,
				})),
				skippedMembers: params.skippedMembers.map((member) => ({
					combatantId: member.combatantId,
					reason: member.reason,
				})),
				unsupportedWarnings: [...params.unsupportedWarnings],
			},
			content: '',
			type: 'base',
		};
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

	async #detachMembersFromExistingMinionGroups(memberCombatantIds: string[]): Promise<void> {
		const selectedMemberIds = new Set(
			memberCombatantIds
				.map((memberCombatantId) => memberCombatantId?.trim() ?? '')
				.filter((memberCombatantId): memberCombatantId is string => memberCombatantId.length > 0),
		);
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
			groupedSelectedMinions
				.map((combatant) => getMinionGroupId(combatant))
				.filter((groupId): groupId is string => typeof groupId === 'string' && groupId.length > 0),
		);
		const updatesById = new Map<string, Record<string, unknown>>();
		const setUpdate = (combatantId: string, update: Record<string, unknown>): void => {
			const current = updatesById.get(combatantId) ?? { _id: combatantId };
			updatesById.set(combatantId, { ...current, ...update });
		};

		for (const combatant of groupedSelectedMinions) {
			const combatantId = combatant.id;
			if (!combatantId) continue;
			setUpdate(combatantId, { [MINION_GROUP_FLAG_ROOT]: null });
		}

		for (const groupId of affectedGroupIds) {
			const remainingMembers = this.combatants.contents.filter((combatant) => {
				const combatantId = combatant.id ?? '';
				if (!combatantId) return false;
				if (selectedMemberIds.has(combatantId)) return false;
				if (!isMinionCombatant(combatant)) return false;
				return getMinionGroupId(combatant) === groupId;
			});

			if (remainingMembers.length <= 1) {
				for (const member of remainingMembers) {
					if (!member.id) continue;
					setUpdate(member.id, { [MINION_GROUP_FLAG_ROOT]: null });
				}
				continue;
			}

			const summary = getMinionGroupSummaries(remainingMembers).get(groupId);
			if (!summary) continue;
			const nextLeader =
				getEffectiveMinionGroupLeader(summary, { aliveOnly: true }) ??
				getEffectiveMinionGroupLeader(summary);
			if (!nextLeader?.id) continue;

			for (const member of remainingMembers) {
				if (!member.id) continue;
				setUpdate(member.id, {
					[MINION_GROUP_ID_PATH]: groupId,
					[MINION_GROUP_ROLE_PATH]: member.id === nextLeader.id ? 'leader' : 'member',
					[MINION_GROUP_TEMPORARY_PATH]: true,
				});
			}
		}

		const updates = [...updatesById.values()];
		if (updates.length === 0) return;

		await this.updateEmbeddedDocuments('Combatant', updates);
		this.turns = this.setupTurns();
	}

	async #assignNcsTemporaryGroupFromAttackMembers(memberCombatantIds: string[]): Promise<void> {
		if (!game.user?.isGM) return;

		const scopedMemberIds = [
			...new Set(
				memberCombatantIds
					.map((memberCombatantId) => memberCombatantId?.trim() ?? '')
					.filter((memberCombatantId): memberCombatantId is string => memberCombatantId.length > 0),
			),
		];
		if (scopedMemberIds.length < 2) return;

		const scopedMembers = this.#resolveCombatantsByIds(scopedMemberIds).filter(
			(member) => isMinionCombatant(member) && !isCombatantDead(member),
		);
		if (scopedMembers.length < 2) return;

		await this.#detachMembersFromExistingMinionGroups(scopedMemberIds);

		const refreshedMembers = this.#resolveCombatantsByIds(scopedMemberIds).filter(
			(member) => isMinionCombatant(member) && !isCombatantDead(member),
		);
		if (refreshedMembers.length < 2) return;

		const orderedMembers = this.#sortCombatantsByCurrentTurnOrder(refreshedMembers);
		const leader = orderedMembers[0];
		if (!leader?.id) return;

		const previousActiveCombatantId = this.combatant?.id;
		const temporaryGroupId = foundry.utils.randomID();
		const sharedInitiative = Number(leader.initiative ?? 0);
		const sharedSort = getCombatantManualSortValue(leader);

		const updates = orderedMembers.reduce<Record<string, unknown>[]>((acc, member) => {
			if (!member.id) return acc;

			acc.push({
				_id: member.id,
				[MINION_GROUP_ID_PATH]: temporaryGroupId,
				[MINION_GROUP_ROLE_PATH]: member.id === leader.id ? 'leader' : 'member',
				[MINION_GROUP_TEMPORARY_PATH]: true,
				initiative: sharedInitiative,
				'system.sort': sharedSort,
			});
			return acc;
		}, []);
		if (updates.length === 0) return;

		await this.updateEmbeddedDocuments('Combatant', updates);
		this.turns = this.setupTurns();

		const regroupedIds = new Set(
			orderedMembers
				.map((member) => member.id)
				.filter((memberId): memberId is string => typeof memberId === 'string'),
		);
		const desiredActiveId =
			previousActiveCombatantId && regroupedIds.has(previousActiveCombatantId)
				? leader.id
				: previousActiveCombatantId;
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

		await this.#dissolveRoundBoundaryMinionGroups();
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
		const memberCombatantIds = [
			...new Set(
				(params.memberCombatantIds ?? [])
					.map((memberCombatantId) => memberCombatantId?.trim() ?? '')
					.filter((memberCombatantId): memberCombatantId is string => memberCombatantId.length > 0),
			),
		];
		const targetTokenIds = [
			...new Set(
				(params.targetTokenIds ?? [])
					.map((targetTokenId) => targetTokenId?.trim() ?? '')
					.filter((targetTokenId): targetTokenId is string => targetTokenId.length > 0),
			),
		];

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

	async #rollSingleMinionAttack(params: {
		member: Combatant.Implementation;
		selectionsByMemberId: ReadonlyMap<string, string>;
	}): Promise<MinionGroupAttackRollOutcome> {
		const memberId = params.member.id ?? '';
		if (!memberId || !isMinionCombatant(params.member)) {
			return {
				rollEntry: null,
				actionUpdate: null,
				skippedMember: null,
				unsupportedWarning: null,
			};
		}

		const selectedActionId = params.selectionsByMemberId.get(memberId);
		if (!selectedActionId) {
			return {
				rollEntry: null,
				actionUpdate: null,
				skippedMember: { combatantId: memberId, reason: 'noActionSelected' },
				unsupportedWarning: null,
			};
		}

		const currentActions = getCombatantCurrentActions(params.member);
		if (!Number.isFinite(currentActions) || currentActions < 1) {
			return {
				rollEntry: null,
				actionUpdate: null,
				skippedMember: { combatantId: memberId, reason: 'noActionsRemaining' },
				unsupportedWarning: null,
			};
		}

		const actor = (params.member.actor as unknown as ActorWithActivateItem | null) ?? null;
		if (!actor) {
			return {
				rollEntry: null,
				actionUpdate: null,
				skippedMember: { combatantId: memberId, reason: 'actorCannotActivate' },
				unsupportedWarning: null,
			};
		}

		const actorItems = Array.isArray(actor.items) ? actor.items : (actor.items?.contents ?? []);
		const selectedAction = actorItems.find((item) => item?.id === selectedActionId);
		if (!selectedAction) {
			return {
				rollEntry: null,
				actionUpdate: null,
				skippedMember: { combatantId: memberId, reason: 'actionNotFound' },
				unsupportedWarning: null,
			};
		}

		const unsupportedEffectTypes = getUnsupportedActivationEffectTypes(
			selectedAction.system?.activation?.effects,
		);
		const unsupportedWarning =
			unsupportedEffectTypes.length > 0
				? `${params.member.name ?? memberId}: ${selectedAction.name ?? selectedActionId} ignores unsupported effect types (${unsupportedEffectTypes.join(', ')})`
				: null;

		try {
			const formula = getPrimaryDamageFormulaFromActivationEffects(
				selectedAction.system?.activation?.effects,
			);
			if (!formula) {
				return {
					rollEntry: null,
					actionUpdate: null,
					skippedMember: { combatantId: memberId, reason: 'noDamageFormula' },
					unsupportedWarning,
				};
			}

			const rollData =
				typeof actor.getRollData === 'function' ? actor.getRollData(selectedAction) : {};
			const damageRoll = new DamageRoll(formula, rollData as DamageRoll.Data, {
				canCrit: false,
				canMiss: true,
				rollMode: 0,
				primaryDieValue: 0,
				primaryDieModifier: 0,
			});
			await damageRoll.evaluate();
			const isMiss = Boolean(damageRoll.isMiss);
			const totalDamage = Number(damageRoll.total ?? 0);
			const normalizedTotalDamage = isMiss
				? 0
				: Number.isFinite(totalDamage)
					? Math.max(0, totalDamage)
					: 0;

			return {
				rollEntry: {
					memberCombatantId: memberId,
					memberName: params.member.name ?? memberId,
					memberImage: getCombatantImage(params.member),
					actionId: selectedActionId,
					actionName: selectedAction.name ?? selectedActionId,
					actionImage:
						typeof selectedAction.img === 'string' && selectedAction.img.trim().length > 0
							? selectedAction.img.trim()
							: null,
					formula,
					totalDamage: normalizedTotalDamage,
					isMiss,
					rollData: damageRoll.toJSON() as Record<string, unknown>,
				},
				actionUpdate: {
					_id: memberId,
					'system.actions.base.current': Math.max(0, currentActions - 1),
				},
				skippedMember: null,
				unsupportedWarning,
			};
		} catch (error) {
			logMinionGroupingCombat('performMinionGroupAttack member activation failed', {
				combatId: this.id ?? null,
				memberCombatantId: memberId,
				actionId: selectedActionId,
				error,
			});
			return {
				rollEntry: null,
				actionUpdate: null,
				skippedMember: { combatantId: memberId, reason: 'activationFailed' },
				unsupportedWarning,
			};
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

	async performMinionGroupAttack(
		params: MinionGroupAttackParams,
	): Promise<MinionGroupAttackResult> {
		const normalizedParams = this.#normalizeAttackParams(params);
		const result: MinionGroupAttackResult = {
			targetTokenId: normalizedParams.targetTokenIds[0] ?? '',
			rolledCombatantIds: [],
			skippedMembers: [],
			unsupportedSelectionWarnings: [],
			endTurnApplied: false,
			totalDamage: 0,
			chatMessageId: null,
		};

		logMinionGroupingCombat('performMinionGroupAttack called', {
			combatId: this.id ?? null,
			memberCombatantIds: normalizedParams.memberCombatantIds,
			targetTokenIds: normalizedParams.targetTokenIds,
			selectionCount: normalizedParams.selectionsByMemberId.size,
			requestedEndTurn: normalizedParams.endTurn,
		});

		if (!game.user?.isGM) {
			logMinionGroupingCombat('performMinionGroupAttack blocked because user is not GM');
			return result;
		}
		if (normalizedParams.memberCombatantIds.length < 1) {
			logMinionGroupingCombat('performMinionGroupAttack blocked because member scope is missing', {
				memberCombatantIds: normalizedParams.memberCombatantIds,
				targetTokenIds: normalizedParams.targetTokenIds,
			});
			return result;
		}

		const resolvedTargets = this.#resolveSelectedTargets(normalizedParams.targetTokenIds);
		if (!resolvedTargets) {
			logMinionGroupingCombat(
				'performMinionGroupAttack blocked because at least one target is required',
				{
					memberCombatantIds: normalizedParams.memberCombatantIds,
				},
			);
			return result;
		}
		result.targetTokenId = resolvedTargets.primaryTargetTokenId;

		const attackMembers = this.#resolveAttackMembers(normalizedParams.memberCombatantIds);
		if (attackMembers.length < 1) {
			logMinionGroupingCombat(
				'performMinionGroupAttack blocked because no eligible attack members were found',
				{
					combatId: this.id ?? null,
					memberCombatantIds: normalizedParams.memberCombatantIds,
				},
			);
			return result;
		}

		const actionUpdates: Record<string, unknown>[] = [];
		const unsupportedWarnings = new Set<string>();
		const rollEntries: MinionGroupAttackRollEntry[] = [];
		for (const member of attackMembers) {
			const rollOutcome = await this.#rollSingleMinionAttack({
				member,
				selectionsByMemberId: normalizedParams.selectionsByMemberId,
			});
			if (rollOutcome.unsupportedWarning) {
				unsupportedWarnings.add(rollOutcome.unsupportedWarning);
			}
			if (rollOutcome.skippedMember) {
				result.skippedMembers.push(rollOutcome.skippedMember);
			}
			if (rollOutcome.rollEntry) {
				rollEntries.push(rollOutcome.rollEntry);
				result.rolledCombatantIds.push(rollOutcome.rollEntry.memberCombatantId);
			}
			if (rollOutcome.actionUpdate) {
				actionUpdates.push(rollOutcome.actionUpdate);
			}
		}
		await this.#applyActionConsumptionUpdates(actionUpdates);
		await this.#maybeAssignTemporaryGroup({
			rolledCombatantIds: result.rolledCombatantIds,
			attackMembers,
		});

		const chatData = await this.#buildNcsAttackChatData({
			activeTargetTokenIds: resolvedTargets.activeTargetTokenIds,
			rollEntries,
			skippedMembers: result.skippedMembers,
			unsupportedWarnings: [...unsupportedWarnings],
			attackMembers,
		});
		result.totalDamage = chatData.totalDamage;
		result.chatMessageId = chatData.chatMessageId;
		result.endTurnApplied = await this.#maybeAdvanceTurnAfterAttack({
			endTurn: normalizedParams.endTurn,
			attackMembers,
		});
		result.unsupportedSelectionWarnings = [...unsupportedWarnings];

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
		let result = (await super.nextTurn()) as this;
		this.#syncTurnIndexWithAliveTurns();
		result = await this.#advancePastExhaustedTurns(result);
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

	#resolveDropContext(
		event: DragEvent & { target: EventTarget & HTMLElement },
	): DropResolution | null {
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

		if (!source) return null;
		if (source.parent?.id !== this.id) return null;
		if (isCombatantDead(source)) return null;
		if (!canCurrentUserReorderCombatant(source)) return null;

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

		if (!target) return null;
		if (isCombatantDead(target)) return null;

		const sourceTypePriority = getCombatantTypePriority(source);
		const targetTypePriority = getCombatantTypePriority(target);
		if (sourceTypePriority !== targetTypePriority) return null;

		if (source.id === target.id) return null;
		if (sortBefore === null) return null;

		const siblings = this.turns.filter(
			(combatant) =>
				combatant.id !== source.id &&
				!isCombatantDead(combatant) &&
				getCombatantTypePriority(combatant) === sourceTypePriority,
		);

		return {
			source,
			target,
			siblings,
			sortBefore,
			previousActiveCombatantId: this.combatant?.id ?? null,
		};
	}

	async #applyGmSort(dropResolution: DropResolution) {
		// Perform the sort with full integer normalization for GM reorders.
		type SortableCombatant = Combatant.Implementation & { id: string };
		const sortUpdates = SortingHelpers.performIntegerSort(
			dropResolution.source as SortableCombatant,
			{
				target: dropResolution.target as SortableCombatant | null,
				siblings: dropResolution.siblings as SortableCombatant[],
				sortKey: 'system.sort',
				sortBefore: dropResolution.sortBefore,
			},
		);

		const updateData = sortUpdates.map((updateEntry) => {
			const { update } = updateEntry;
			return {
				...update,
				_id: updateEntry.target.id,
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
