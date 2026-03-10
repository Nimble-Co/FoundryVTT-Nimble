import type {
	CombatTrackerNonPlayerHpBarTextMode,
	CombatTrackerPlayerHpBarTextMode,
} from '../../../settings/combatTrackerSettings.js';

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

export interface PlayerCombatantReactionCell {
	key: 'defend' | 'interpose' | 'opportunityAttack' | 'help';
	iconClass: string;
	title: string;
	active?: boolean;
	visible: boolean;
}

export interface PlayerCombatantBarData {
	key: 'hp' | 'wounds';
	visible: boolean;
	fillPercent: number;
	centerText: string | null;
	title: string;
	toneClass: string;
	iconClass?: string;
}

export interface PlayerCombatantDrawerData {
	rowCount: number;
	hpBar: PlayerCombatantBarData;
	woundsBar: PlayerCombatantBarData;
	defend: PlayerCombatantReactionCell;
	interpose: PlayerCombatantReactionCell;
	opportunityAttack: PlayerCombatantReactionCell;
	help: PlayerCombatantReactionCell;
}

export interface NonPlayerCombatantHpBarData {
	visible: boolean;
	fillPercent: number;
	centerText: string | null;
	toneClass: string;
	tooltip: string | null;
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

export interface CtTopTrackerSettingPatch {
	playersCanExpandMonsterCards?: boolean;
	resourceDrawerHoverEnabled?: boolean;
	playerHpBarTextMode?: CombatTrackerPlayerHpBarTextMode;
	nonPlayerHpBarEnabled?: boolean;
	nonPlayerHpBarTextMode?: CombatTrackerNonPlayerHpBarTextMode;
	ctEnabled?: boolean;
	ctWidthLevel?: number;
	ctCardSizeLevel?: number;
	layoutVersionDelta?: number;
	shouldCenterActiveEntry?: boolean;
}
