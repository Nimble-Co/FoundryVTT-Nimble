export type NimbleCombatantSystemMap = DataModelConfig['Combatant'];
export type NimbleCombatantSystem = NimbleCombatantSystemMap[keyof NimbleCombatantSystemMap];
export type CombatantBaseActions = NimbleCombatantSystem['actions']['base'];

export interface MinionGroupAttackSelection {
	memberCombatantId: string;
	actionId: string | null;
}

export interface MinionGroupAttackParams {
	memberCombatantIds: string[];
	targetTokenIds?: string[];
	selections: MinionGroupAttackSelection[];
	endTurn?: boolean;
}

export interface MinionGroupAttackSkippedMember {
	combatantId: string;
	reason: string;
}

export interface MinionGroupAttackResult {
	targetTokenId: string;
	rolledCombatantIds: string[];
	skippedMembers: MinionGroupAttackSkippedMember[];
	unsupportedSelectionWarnings: string[];
	endTurnApplied: boolean;
	totalDamage: number;
	chatMessageId?: string | null;
}

export interface NormalizedMinionGroupAttackParams {
	memberCombatantIds: string[];
	targetTokenIds: string[];
	selectionsByMemberId: Map<string, string>;
	endTurn: boolean;
}

export interface ResolvedMinionGroupAttackTargets {
	activeTargetTokenIds: string[];
	primaryTargetTokenId: string;
}

export interface MinionGroupAttackRollOutcome {
	rollEntry: MinionGroupAttackRollEntry | null;
	actionUpdate: Record<string, unknown> | null;
	skippedMember: MinionGroupAttackSkippedMember | null;
	unsupportedWarning: string | null;
}

export interface ResolvedMinionAttackActionContext {
	memberId: string;
	selectedActionId: string;
	currentActions: number;
	actor: ActorWithActivateItem;
	selectedAction: ItemLike;
	unsupportedWarning: string | null;
}

export interface TurnIdentity {
	combatantId: string;
	occurrence: number | null;
}

export interface DropResolution {
	source: Combatant.Implementation;
	target: Combatant.Implementation;
	siblings: Combatant.Implementation[];
	sortBefore: boolean;
	previousActiveTurnIdentity: TurnIdentity | null;
}

export interface DropTargetResolution {
	target: Combatant.Implementation;
	sortBefore: boolean;
}

export interface ItemLike {
	id?: string;
	name?: string;
	img?: string;
	system?: {
		activation?: {
			effects?: unknown[];
		};
	};
}

export interface ActorWithActivateItem {
	type?: string;
	name?: string;
	items?: { contents?: ItemLike[] } | ItemLike[];
	activateItem?: (id: string, options?: Record<string, unknown>) => Promise<ChatMessage | null>;
	getRollData?: (item?: unknown) => Record<string, unknown>;
}

export interface MinionGroupAttackRollEntry {
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

export interface InitiativeRollOutcome {
	combatantUpdate: Record<string, unknown>;
	chatData: ChatMessage.CreateData;
}
