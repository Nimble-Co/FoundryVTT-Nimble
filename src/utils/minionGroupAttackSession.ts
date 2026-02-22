export interface MinionGroupAttackSessionContext {
	combatId: string;
	memberCombatantIds: string[];
}

export interface MinionGroupAttackOption {
	actionId: string;
	label: string;
	rollFormula: string | null;
	description?: string | null;
	unsupportedReasons: string[];
}

export interface MinionGroupAttackMember {
	combatantId: string;
	actorType: string;
	actionOptions: MinionGroupAttackOption[];
}

export interface MinionGroupMemberAttackSelection {
	memberCombatantId: string;
	actionId: string | null;
}

export interface MinionGroupAttackSelectionState {
	context: MinionGroupAttackSessionContext;
	selectionsByMemberId: Map<string, MinionGroupMemberAttackSelection>;
}

export function createMinionGroupAttackSelectionState(
	context: MinionGroupAttackSessionContext,
): MinionGroupAttackSelectionState {
	const selectionsByMemberId = new Map<string, MinionGroupMemberAttackSelection>();

	for (const memberCombatantId of context.memberCombatantIds) {
		selectionsByMemberId.set(memberCombatantId, {
			memberCombatantId,
			actionId: null,
		});
	}

	return {
		context,
		selectionsByMemberId,
	};
}

function buildRememberedSelectionKey(combatId: string, actorType: string): string {
	const normalizedCombatId = combatId.trim();
	const normalizedActorType = actorType.trim().toLowerCase();
	return `${normalizedCombatId}:${normalizedActorType}`;
}

export function deriveDefaultMemberActionSelection(
	member: MinionGroupAttackMember,
	context: MinionGroupAttackSessionContext,
	rememberedSelectionsByActorType: ReadonlyMap<string, string>,
): string | null {
	const options = member.actionOptions;
	if (options.length === 0) return null;
	const firstActionId = options[0]?.actionId ?? null;
	if (options.length === 1) return firstActionId;

	const rememberedSelectionKey = buildRememberedSelectionKey(context.combatId, member.actorType);
	const rememberedActionId = rememberedSelectionsByActorType.get(rememberedSelectionKey);
	if (!rememberedActionId) return firstActionId;

	return options.some((option) => option.actionId === rememberedActionId)
		? rememberedActionId
		: firstActionId;
}

export function rememberMemberActionSelection(
	rememberedSelectionsByActorType: Map<string, string>,
	context: MinionGroupAttackSessionContext,
	actorType: string,
	actionId: string,
): void {
	const normalizedActorType = actorType.trim().toLowerCase();
	if (!normalizedActorType) return;
	if (!actionId?.trim()) return;

	rememberedSelectionsByActorType.set(
		buildRememberedSelectionKey(context.combatId, normalizedActorType),
		actionId,
	);
}
