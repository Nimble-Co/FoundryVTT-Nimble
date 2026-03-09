import type { CombatTrackerVisibilityPermissionConfig } from '../../../settings/combatTrackerSettings.js';

export interface SceneCombatantLists {
	aliveCombatants: Combatant.Implementation[];
	deadCombatants: Combatant.Implementation[];
}

export interface TrackEntry {
	key: string;
	kind: 'combatant' | 'monster-stack';
	combatant?: Combatant.Implementation;
}

export interface CombatantDropPreview {
	sourceId: string;
	targetId: string;
	before: boolean;
}

export interface VirtualizedAliveEntries {
	enabled: boolean;
	startIndex: number;
	endIndex: number;
	leadingWidthPx: number;
	trailingWidthPx: number;
	entries: TrackEntry[];
}

export interface CtWidthPreviewEventDetail {
	active?: boolean;
	widthLevel?: unknown;
}

export interface CanvasTokenLike {
	center?: { x: number; y: number } | null;
	document?: { id?: string | null } | null;
}

export type HpBadgeState = 'green' | 'yellow' | 'red' | 'unknown';
export type HpBadgeMode = 'hidden' | 'value' | 'state';

export type CombatWithDrop = Combat & {
	_onDrop?: (event: DragEvent & { target: EventTarget & HTMLElement }) => Promise<unknown>;
};

export type CombatWithHeroicReactionToggle = Combat & {
	toggleHeroicReactionAvailability?: (
		combatantId: string,
		reactionKey: 'defend' | 'interpose' | 'opportunityAttack' | 'help',
	) => Promise<boolean>;
};

export interface CombatantCardResourceChip {
	key: 'mana' | 'wounds' | 'defend' | 'interpose';
	iconClass: string;
	text?: string;
	title: string;
	active?: boolean;
	tone: 'mana' | 'wounds' | 'utility';
}

export interface PlayerCombatantDrawerCell {
	key: 'hp' | 'wounds' | 'defend' | 'interpose' | 'opportunityAttack' | 'help';
	iconClass?: string;
	text?: string;
	title: string;
	active?: boolean;
	visible: boolean;
}

export interface PlayerCombatantDrawerData {
	hp: PlayerCombatantDrawerCell;
	wounds: PlayerCombatantDrawerCell;
	defend: PlayerCombatantDrawerCell;
	interpose: PlayerCombatantDrawerCell;
	opportunityAttack: PlayerCombatantDrawerCell;
	help: PlayerCombatantDrawerCell;
}

export interface ResolveActiveEntryKeyParams {
	activeCombatantId: string | null;
	activeOccurrence: number | null;
	aliveEntries: TrackEntry[];
	collapseMonsters: boolean;
	monsterCombatants: Combatant.Implementation[];
}

export interface BuildVirtualizedAliveEntriesParams {
	entries: TrackEntry[];
	enabled: boolean;
	scrollLeft: number;
	viewportWidth: number;
}

export interface ResolveNextCombatantActionsForSlotParams {
	slot: number;
	currentActions: number;
	maxActions: number;
}

export interface CtTopTrackerSettingPatch {
	playersCanExpandMonsterCards?: boolean;
	centerActiveCardEnabled?: boolean;
	resourceDrawerHoverEnabled?: boolean;
	ctEnabled?: boolean;
	ctWidthLevel?: number;
	ctCardSizeLevel?: number;
	ctBadgeSizeLevel?: number;
	useActionDice?: boolean;
	layoutVersionDelta?: number;
	shouldCenterActiveEntry?: boolean;
	visibilityPermissions?: CombatTrackerVisibilityPermissionConfig;
}
