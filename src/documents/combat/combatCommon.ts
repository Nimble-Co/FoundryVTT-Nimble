import { getCombatantImage } from '../../utils/combatantImage.js';
import { getTargetTokenUuid } from '../../utils/tokenTargetLookup.js';
import type {
	ActorWithActivateItem,
	CombatantSystemWithActions,
	ItemLike,
	MinionGroupAttackResult,
	MinionGroupAttackRollEntry,
	MinionGroupAttackRollOutcome,
	MinionGroupAttackSkippedMember,
} from './combatTypes.js';

export function getCombatantManualSortValue(combatant: Combatant.Implementation): number {
	return Number((combatant.system as unknown as { sort?: number }).sort ?? 0);
}

function resolveNeighborSortValue(params: {
	previous: Combatant.Implementation | null;
	next: Combatant.Implementation | null;
	sortBefore: boolean;
}): number | null {
	if (params.previous && params.next) {
		const previousSort = getCombatantManualSortValue(params.previous);
		const nextSort = getCombatantManualSortValue(params.next);
		if (previousSort === nextSort) {
			return previousSort + (params.sortBefore ? -0.5 : 0.5);
		}
		return previousSort + (nextSort - previousSort) / 2;
	}

	if (params.previous) return getCombatantManualSortValue(params.previous) + 1;
	if (params.next) return getCombatantManualSortValue(params.next) - 1;
	return null;
}

export function getSourceSortValueForDrop(
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

	const neighborSortValue = resolveNeighborSortValue({ previous, next, sortBefore });
	if (neighborSortValue !== null) return neighborSortValue;
	return getCombatantManualSortValue(source);
}

export function logMinionGroupingCombat(
	message: string,
	details: Record<string, unknown> = {},
): void {
	const globals = globalThis as Record<string, unknown>;
	if (globals.NIMBLE_ENABLE_GROUP_LOGS !== true) return;
	if (globals.NIMBLE_DISABLE_GROUP_LOGS === true) return;
	console.info(`[Nimble][MinionGrouping][Combat] ${message}`, details);
}

export function getCombatantCurrentActions(combatant: Combatant.Implementation): number {
	const currentActions = Number(
		(combatant.system as unknown as CombatantSystemWithActions).actions?.base?.current ?? 0,
	);
	if (!Number.isFinite(currentActions)) return 0;
	return currentActions;
}

export function normalizeUniqueIds(values: Array<string | null | undefined>): string[] {
	return [
		...new Set(
			values
				.map((value) => value?.trim() ?? '')
				.filter((value): value is string => value.length > 0),
		),
	];
}

export function resolveGroupAttackSpeaker(params: {
	attackMembers: Combatant.Implementation[];
	rollEntries: MinionGroupAttackRollEntry[];
}): Combatant.Implementation | undefined {
	const rolledMemberIds = new Set(
		params.rollEntries
			.map((entry) => entry.memberCombatantId)
			.filter((memberId) => memberId.length > 0),
	);
	return (
		params.attackMembers.find((member) => {
			const memberId = member.id ?? '';
			return memberId.length > 0 && rolledMemberIds.has(memberId);
		}) ?? params.attackMembers[0]
	);
}

export function resolveGroupAttackSpeakerAlias(groupLabel: string | null): string {
	const trimmedLabel = groupLabel?.trim() ?? '';
	return trimmedLabel ? `Minion Group ${trimmedLabel.toUpperCase()}` : 'Selected Minions';
}

function resolveGroupAttackSpeakerImage(
	speakerCombatant: Combatant.Implementation | undefined,
): string {
	return (speakerCombatant ? getCombatantImage(speakerCombatant) : null) ?? 'icons/svg/cowled.svg';
}

function resolveGroupAttackSpeakerPermissions(
	speakerCombatant: Combatant.Implementation | undefined,
): number {
	const speakerPermissions = Number(
		(speakerCombatant?.actor as unknown as { permission?: number } | null)?.permission ?? 0,
	);
	return Number.isFinite(speakerPermissions) ? speakerPermissions : 0;
}

function resolveTargetUuids(targetTokenIds: string[]): string[] {
	return targetTokenIds
		.map((targetTokenId) => getTargetTokenUuid(targetTokenId))
		.filter((uuid): uuid is string => typeof uuid === 'string' && uuid.length > 0);
}

function mapGroupAttackRows(rollEntries: MinionGroupAttackRollEntry[]) {
	return rollEntries.map((entry) => ({
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
	}));
}

function mapSkippedGroupAttackMembers(skippedMembers: MinionGroupAttackSkippedMember[]) {
	return skippedMembers.map((member) => ({
		combatantId: member.combatantId,
		reason: member.reason,
	}));
}

export function buildNcsGroupAttackChatData(params: {
	groupLabel: string | null;
	targetTokenIds: string[];
	targetName: string;
	rollEntries: MinionGroupAttackRollEntry[];
	totalDamage: number;
	skippedMembers: MinionGroupAttackSkippedMember[];
	unsupportedWarnings: string[];
	speakerCombatant: Combatant.Implementation | undefined;
	speakerAlias: string;
}): Record<string, unknown> & { rollMode: string | null } {
	const speakerImage = resolveGroupAttackSpeakerImage(params.speakerCombatant);
	const speakerPermissions = resolveGroupAttackSpeakerPermissions(params.speakerCombatant);
	const targetUuids = resolveTargetUuids(params.targetTokenIds);
	return {
		author: game.user?.id,
		flavor: `${params.speakerAlias} attacks ${params.targetName}`,
		speaker: ChatMessage.getSpeaker({
			actor: params.speakerCombatant?.actor,
			token: params.speakerCombatant?.token,
			alias: params.speakerAlias,
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
			actorName: params.speakerAlias,
			actorType: params.speakerCombatant?.actor?.type ?? 'minion',
			image: speakerImage,
			permissions: Number.isFinite(speakerPermissions) ? speakerPermissions : 0,
			rollMode: 0,
			targets: targetUuids,
			groupLabel: params.groupLabel ?? '',
			targetName: params.targetName,
			totalDamage: params.totalDamage,
			rows: mapGroupAttackRows(params.rollEntries),
			skippedMembers: mapSkippedGroupAttackMembers(params.skippedMembers),
			unsupportedWarnings: [...params.unsupportedWarnings],
		},
		content: '',
		type: 'base',
	};
}

export function resolveActorItems(actor: ActorWithActivateItem | null): ItemLike[] {
	if (!actor) return [];
	return Array.isArray(actor.items) ? actor.items : (actor.items?.contents ?? []);
}

export function resolveMinionAttackSkipReason(params: {
	selectedActionId: string;
	currentActions: number;
	actor: ActorWithActivateItem | null;
	selectedAction: ItemLike | null;
}): string | null {
	const checks: Array<{ valid: boolean; reason: string }> = [
		{ valid: params.selectedActionId.length > 0, reason: 'noActionSelected' },
		{
			valid: Number.isFinite(params.currentActions) && params.currentActions >= 1,
			reason: 'noActionsRemaining',
		},
		{ valid: params.actor !== null, reason: 'actorCannotActivate' },
		{ valid: params.selectedAction !== null, reason: 'actionNotFound' },
	];
	return checks.find((check) => !check.valid)?.reason ?? null;
}

export function createMinionGroupAttackResult(targetTokenIds: string[]): MinionGroupAttackResult {
	return {
		targetTokenId: targetTokenIds[0] ?? '',
		rolledCombatantIds: [],
		skippedMembers: [],
		unsupportedSelectionWarnings: [],
		endTurnApplied: false,
		totalDamage: 0,
		chatMessageId: null,
	};
}

export function appendMinionAttackRollOutcome(params: {
	rollOutcome: MinionGroupAttackRollOutcome;
	result: MinionGroupAttackResult;
	rollEntries: MinionGroupAttackRollEntry[];
	actionUpdates: Record<string, unknown>[];
	unsupportedWarnings: Set<string>;
}): void {
	if (params.rollOutcome.unsupportedWarning) {
		params.unsupportedWarnings.add(params.rollOutcome.unsupportedWarning);
	}
	if (params.rollOutcome.skippedMember) {
		params.result.skippedMembers.push(params.rollOutcome.skippedMember);
	}
	if (params.rollOutcome.rollEntry) {
		params.rollEntries.push(params.rollOutcome.rollEntry);
		params.result.rolledCombatantIds.push(params.rollOutcome.rollEntry.memberCombatantId);
	}
	if (params.rollOutcome.actionUpdate) {
		params.actionUpdates.push(params.rollOutcome.actionUpdate);
	}
}
