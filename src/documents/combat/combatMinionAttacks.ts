import type { ConditionCreature } from '#types/conditionRollMode.d.ts';
import type { FormulaActor, FormulaOwner } from '#types/formulaReferences.d.ts';
import type { HeldChange } from '#types/heldChange.d.ts';
import { fireAttackEvents } from '#utils/lastsUntil/lastsUntilEvents.js';
import { DamageRoll } from '../../dice/DamageRoll.js';
import {
	getPrimaryDamageFormulaFromActivationEffects,
	getUnsupportedActivationEffectTypes,
} from '../../utils/activationEffects.js';
import { getCombatantImage } from '../../utils/combat/combatantImage.js';
import { isCombatantDead } from '../../utils/combat/isCombatantDead.js';
import resolveMinionAttackActionCost from '../../utils/combat/resolveMinionAttackActionCost.js';
import { attackDeliveryFromAttackType } from '../../utils/damage/attackDelivery.js';
import { attackHeldPlanOf } from '../../utils/heldChange/attackHeldPlan.js';
import {
	firstTargetActor,
	type heldChangesForAttack,
	isMelee,
} from '../../utils/heldChange/heldChange.js';
import { isMinionCombatant } from '../../utils/minions/minionGrouping.js';
import { withConditionSources } from '../../utils/rolls/appliedConditionRollModes.js';
import { attackConditionLines } from '../../utils/rolls/attackConditionLines.js';
import { endUsedConditions } from '../../utils/rolls/endUsedConditions.js';
import { checkFormulaReferences } from '../../utils/rolls/formulaReferences.js';
import { soleTarget } from '../../utils/tokens/soleTarget.js';
import {
	getCurrentUserTargetTokenIds,
	getTargetTokenName,
} from '../../utils/tokens/tokenTargetLookup.js';
import {
	appendMinionAttackRollOutcome,
	buildNcsGroupAttackChatData,
	createMinionGroupAttackResult,
	getCombatantCurrentActions,
	logMinionGroupingCombat,
	normalizeUniqueIds,
	resolveActorItems,
	resolveGroupAttackSpeaker,
	resolveGroupAttackSpeakerAlias,
	resolveMinionAttackSkipReason,
} from './combatCommon.js';
import type {
	ActorWithActivateItem,
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

function buildSelectionsMap(selections: MinionGroupAttackSelection[]): Map<string, string> {
	const selectionsByMemberId = new Map<string, string>();
	for (const selection of selections) {
		const memberCombatantId = selection.memberCombatantId?.trim() ?? '';
		const actionId = selection.actionId?.trim() ?? '';
		if (!memberCombatantId || !actionId) continue;
		selectionsByMemberId.set(memberCombatantId, actionId);
	}
	return selectionsByMemberId;
}

function normalizeAttackParams(params: MinionGroupAttackParams): NormalizedMinionGroupAttackParams {
	const memberCombatantIds = normalizeUniqueIds(params.memberCombatantIds ?? []);
	const targetTokenIds = normalizeUniqueIds(params.targetTokenIds ?? []);

	return {
		memberCombatantIds,
		targetTokenIds,
		selectionsByMemberId: buildSelectionsMap(params.selections),
		endTurn: params.endTurn === true,
	};
}

function resolveSelectedTargets(
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

function resolveAttackMembers(
	combat: Combat,
	memberCombatantIds: string[],
): Combatant.Implementation[] {
	return resolveCombatantsByIds(combat, memberCombatantIds).filter(
		(member) => isMinionCombatant(member) && !isCombatantDead(member),
	);
}

function buildSkippedMinionAttackOutcome(
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

function buildUnsupportedMinionAttackWarning(params: {
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

function resolveMinionAttackActionContext(params: {
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
		return buildSkippedMinionAttackOutcome(memberId, skipReason);
	}

	const resolvedActor = actor as ActorWithActivateItem;
	const resolvedAction = selectedAction as ItemLike;
	const unsupportedWarning = buildUnsupportedMinionAttackWarning({
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

function isMinionAttackRollOutcome(
	value: ResolvedMinionAttackActionContext | MinionGroupAttackRollOutcome,
): value is MinionGroupAttackRollOutcome {
	return 'rollEntry' in value;
}

export function buildMinionAttackRollEntry(params: {
	member: Combatant.Implementation;
	memberId: string;
	selectedActionId: string;
	selectedAction: ItemLike;
	formula: string;
	damageRoll: DamageRoll;
	held: HeldChange[];
	mustAttackLabel?: string;
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
		primaryDieBonuses: params.held.map((change) => ({ label: change.label, value: change.value })),
		...(params.mustAttackLabel ? { mustAttackLabel: params.mustAttackLabel } : {}),
	};
}

async function rollSingleMinionAttack(params: {
	combat: Combat;
	member: Combatant.Implementation;
	targetActor: Parameters<typeof heldChangesForAttack>[0]['target'];
	/** The attack's only target, whose conditions change the roll mode. */
	soleTargetActor: ConditionCreature | null;
	selectionsByMemberId: ReadonlyMap<string, string>;
}): Promise<MinionGroupAttackRollOutcome> {
	const resolvedActionContext = resolveMinionAttackActionContext(params);
	if (isMinionAttackRollOutcome(resolvedActionContext)) {
		return resolvedActionContext;
	}

	try {
		const formula = getPrimaryDamageFormulaFromActivationEffects(
			resolvedActionContext.selectedAction.system?.activation?.effects,
		);
		if (!formula) {
			return buildSkippedMinionAttackOutcome(
				resolvedActionContext.memberId,
				'noDamageFormula',
				resolvedActionContext.unsupportedWarning,
			);
		}

		const rollData =
			typeof resolvedActionContext.actor.getRollData === 'function'
				? resolvedActionContext.actor.getRollData(resolvedActionContext.selectedAction)
				: {};
		const conditions = attackConditionLines(
			resolvedActionContext.actor,
			resolvedActionContext.selectedAction.system?.activation,
			params.soleTargetActor,
		).filter((line) => line.on);
		const held = attackHeldPlanOf({
			attacker: resolvedActionContext.actor as never,
			target: params.targetActor,
			area: false,
			attack: true,
			melee: isMelee(
				attackDeliveryFromAttackType(
					(
						resolvedActionContext.selectedAction.system?.activation as
							| { targets?: { attackType?: string } }
							| undefined
					)?.targets?.attackType,
				),
			),
			// Only the conditions give a minion group attack disadvantage.
			noDisadvantageToIgnore: !conditions.some((line) => line.step < 0),
		});
		checkFormulaReferences(
			formula,
			resolvedActionContext.actor as FormulaActor,
			{ item: resolvedActionContext.selectedAction as FormulaOwner['item'] },
			{ rollData },
		);
		const rollOptions: DamageRoll.Options = {
			canCrit: false,
			canMiss: true,
			rollMode: 0,
			primaryDieValue: 0,
			primaryDieModifier: held.primaryDieBonus,
			...(conditions.length > 0
				? {
						rollModeSources: withConditionSources([0], conditions),
						conditionRollModes: conditions,
					}
				: {}),
		};
		held.applyToRoll(rollOptions);
		const damageRoll = new DamageRoll(formula, rollData as DamageRoll.Data, rollOptions);
		await damageRoll.evaluate();
		await held.spend();
		await endUsedConditions(resolvedActionContext.actor, conditions);

		const actionCost = resolveMinionAttackActionCost(resolvedActionContext.selectedAction);
		return {
			rollEntry: buildMinionAttackRollEntry({
				member: params.member,
				memberId: resolvedActionContext.memberId,
				selectedActionId: resolvedActionContext.selectedActionId,
				selectedAction: resolvedActionContext.selectedAction,
				formula,
				damageRoll,
				held: held.primaryDie,
				mustAttackLabel: held.mustAttackOther?.label,
			}),
			actionUpdate: {
				_id: resolvedActionContext.memberId,
				'system.actions.base.current': Math.max(
					0,
					resolvedActionContext.currentActions - actionCost,
				),
			},
			skippedMember: null,
			unsupportedWarning: resolvedActionContext.unsupportedWarning,
		};
	} catch (error) {
		logMinionGroupingCombat('performMinionGroupAttack member activation failed', {
			combatId: params.combat.id ?? null,
			memberCombatantId: resolvedActionContext.memberId,
			actionId: resolvedActionContext.selectedActionId,
			error,
		});
		return buildSkippedMinionAttackOutcome(
			resolvedActionContext.memberId,
			'activationFailed',
			resolvedActionContext.unsupportedWarning,
		);
	}
}

async function applyActionConsumptionUpdates(
	combat: Combat,
	updates: Record<string, unknown>[],
): Promise<void> {
	if (updates.length < 1) return;
	await combat.updateEmbeddedDocuments('Combatant', updates);
}

async function maybeAssignTemporaryGroup(params: {
	rolledCombatantIds: string[];
	attackMembers: Combatant.Implementation[];
	assignNcsTemporaryGroupFromAttackMembers: (memberCombatantIds: string[]) => Promise<void>;
}): Promise<void> {
	if (params.rolledCombatantIds.length < 1) return;

	const attackMemberIds = params.attackMembers
		.map((member) => member.id)
		.filter((memberId): memberId is string => typeof memberId === 'string');
	if (attackMemberIds.length < 1) return;

	await params.assignNcsTemporaryGroupFromAttackMembers(attackMemberIds);
}

async function createNcsGroupAttackChatMessage(params: {
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
	ChatMessage.applyMode(chatData as Record<string, unknown>);

	const chatCard = await ChatMessage.create(chatData as unknown as ChatMessage.CreateData);
	return chatCard ?? null;
}

async function buildNcsAttackChatData(params: {
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
	const chatCard = await createNcsGroupAttackChatMessage({
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

/** The attack event of each actor whose member rolled. */
function fireMemberAttackEvents(
	attackMembers: Combatant.Implementation[],
	rolledCombatantIds: string[],
): void {
	const rolled = new Set(rolledCombatantIds);
	const attackers = new Set<Actor>();
	for (const member of attackMembers) {
		if (member.actor && rolled.has(member.id ?? '')) attackers.add(member.actor as Actor);
	}
	for (const actor of attackers) fireAttackEvents(actor);
}

async function maybeAdvanceTurnAfterAttack(params: {
	combat: Combat;
	endTurn: boolean;
	attackMembers: Combatant.Implementation[];
}): Promise<boolean> {
	if (!params.endTurn) return false;

	const activeCombatantId = params.combat.combatant?.id ?? '';
	const attackedActiveCombatant = params.attackMembers.some(
		(member) => (member.id ?? '') === activeCombatantId,
	);
	if (!attackedActiveCombatant) {
		logMinionGroupingCombat(
			'performMinionGroupAttack skipped end-turn because active turn was outside attack scope',
			{
				combatId: params.combat.id ?? null,
				activeCombatantId: params.combat.combatant?.id ?? null,
				attackedActiveCombatant,
			},
		);
		return false;
	}

	await params.combat.nextTurn();
	return true;
}

function resolveMinionGroupAttackExecutionContext(params: {
	combat: Combat;
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

	const resolvedTargets = resolveSelectedTargets(params.normalizedParams.targetTokenIds);
	if (!resolvedTargets) {
		logMinionGroupingCombat(
			'performMinionGroupAttack blocked because at least one target is required',
			{ memberCombatantIds: params.normalizedParams.memberCombatantIds },
		);
		return null;
	}

	const attackMembers = resolveAttackMembers(
		params.combat,
		params.normalizedParams.memberCombatantIds,
	);
	if (attackMembers.length < 1) {
		logMinionGroupingCombat(
			'performMinionGroupAttack blocked because no eligible attack members were found',
			{
				combatId: params.combat.id ?? null,
				memberCombatantIds: params.normalizedParams.memberCombatantIds,
			},
		);
		return null;
	}

	params.result.targetTokenId = resolvedTargets.primaryTargetTokenId;
	return { resolvedTargets, attackMembers };
}

async function collectMinionAttackRollData(params: {
	combat: Combat;
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
	const targetActor = firstTargetActor();
	const soleTargetActor = soleTarget(game.user?.targets)?.actor ?? null;
	for (const member of params.attackMembers) {
		const rollOutcome = await rollSingleMinionAttack({
			combat: params.combat,
			member,
			targetActor,
			soleTargetActor,
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

export async function performMinionGroupAttack(params: {
	combat: Combat;
	attackParams: MinionGroupAttackParams;
	assignNcsTemporaryGroupFromAttackMembers: (memberCombatantIds: string[]) => Promise<void>;
}): Promise<MinionGroupAttackResult> {
	const normalizedParams = normalizeAttackParams(params.attackParams);
	const result = createMinionGroupAttackResult(normalizedParams.targetTokenIds);

	logMinionGroupingCombat('performMinionGroupAttack called', {
		combatId: params.combat.id ?? null,
		memberCombatantIds: normalizedParams.memberCombatantIds,
		targetTokenIds: normalizedParams.targetTokenIds,
		selectionCount: normalizedParams.selectionsByMemberId.size,
		requestedEndTurn: normalizedParams.endTurn,
	});

	const executionContext = resolveMinionGroupAttackExecutionContext({
		combat: params.combat,
		normalizedParams,
		result,
	});
	if (!executionContext) return result;

	const { resolvedTargets, attackMembers } = executionContext;
	const rollData = await collectMinionAttackRollData({
		combat: params.combat,
		attackMembers,
		selectionsByMemberId: normalizedParams.selectionsByMemberId,
		result,
	});
	await applyActionConsumptionUpdates(params.combat, rollData.actionUpdates);
	await maybeAssignTemporaryGroup({
		rolledCombatantIds: result.rolledCombatantIds,
		attackMembers,
		assignNcsTemporaryGroupFromAttackMembers: params.assignNcsTemporaryGroupFromAttackMembers,
	});

	const chatData = await buildNcsAttackChatData({
		activeTargetTokenIds: resolvedTargets.activeTargetTokenIds,
		rollEntries: rollData.rollEntries,
		skippedMembers: result.skippedMembers,
		unsupportedWarnings: rollData.unsupportedWarnings,
		attackMembers,
	});
	result.totalDamage = chatData.totalDamage;
	result.chatMessageId = chatData.chatMessageId;
	fireMemberAttackEvents(attackMembers, result.rolledCombatantIds);
	result.endTurnApplied = await maybeAdvanceTurnAfterAttack({
		combat: params.combat,
		endTurn: normalizedParams.endTurn,
		attackMembers,
	});
	result.unsupportedSelectionWarnings = rollData.unsupportedWarnings;

	logMinionGroupingCombat('performMinionGroupAttack completed', {
		combatId: params.combat.id ?? null,
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
