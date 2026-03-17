import {
	getCombatTrackerCtCardSizeLevel,
	getCombatTrackerCtEnabled,
	getCombatTrackerCtWidthLevel,
	getCombatTrackerNonPlayerHpBarEnabled,
	getCombatTrackerNonPlayerHpBarTextMode,
	getCombatTrackerPlayerHpBarTextMode,
	getCombatTrackerResourceDrawerHoverEnabled,
} from '../../../settings/combatTrackerSettings.js';
import {
	canCurrentUserEndTurn as canCurrentUserEndCombatantTurn,
	getCombatantCurrentActions,
} from '../../../utils/combatTurnActions.js';
import { canOwnerUseHeroicReaction, type HeroicReactionKey } from '../../../utils/heroicActions.js';
import {
	buildAliveEntries,
	buildCombatSyncSignature,
	getActiveCombatant,
	getActiveCombatantId,
	getActiveCombatantOccurrence,
	getCombatantId,
	getCombatantsForScene,
	getCombatForCurrentScene,
	getRoundBoundaryKey,
	getRoundSeparatorInsertionIndex,
	isCombatStarted,
	isMonsterOrMinionCombatant,
	isPlayerCombatant,
	orderEntriesForCenteredActive,
	resolveActiveEntryKey,
	syncCombatTurnsForCt,
} from './combat.utils.js';
import {
	CT_MONSTER_CARDS_EXPANDED_FLAG_PATH,
	CT_PLAYERS_CAN_VIEW_EXPANDED_MONSTERS_FLAG_PATH,
} from './constants.js';
import {
	getCtCardScale,
	normalizeCtCardSizeLevel,
	normalizeCtWidthLevel,
	resolveCtTrackMaxWidth,
	trackDependency,
} from './layout.utils.js';
import {
	resolveActionCombatState,
	resolveCtTopTrackerSettingPatch,
	resolveMonsterCardsExpandedState,
} from './state.js';
import type {
	CombatantDropPreview,
	CtTopTrackerSettingPatch,
	CtWidthPreviewEventDetail,
} from './types.js';

function getSharedMonsterCardsExpanded(combat: Combat | null): boolean {
	if (!combat) return false;
	return Boolean(foundry.utils.getProperty(combat, CT_MONSTER_CARDS_EXPANDED_FLAG_PATH));
}

function getPlayersCanViewExpandedMonsters(combat: Combat | null): boolean {
	if (!combat) return false;
	return Boolean(
		foundry.utils.getProperty(combat, CT_PLAYERS_CAN_VIEW_EXPANDED_MONSTERS_FLAG_PATH),
	);
}

export class CtTopTrackerStore {
	preferredCombatId = $state<string | null>(null);

	currentCombat = $state<Combat | null>(null);

	sceneAliveCombatants = $state<Combatant.Implementation[]>([]);

	sceneDeadCombatants = $state<Combatant.Implementation[]>([]);

	playersCanViewExpandedMonsters = $state(false);

	playerHpBarTextMode = $state(getCombatTrackerPlayerHpBarTextMode());

	nonPlayerHpBarEnabled = $state(getCombatTrackerNonPlayerHpBarEnabled());

	nonPlayerHpBarTextMode = $state(getCombatTrackerNonPlayerHpBarTextMode());

	resourceDrawerHoverEnabled = $state(getCombatTrackerResourceDrawerHoverEnabled());

	ctEnabled = $state(getCombatTrackerCtEnabled());

	ctWidthLevel = $state(getCombatTrackerCtWidthLevel());

	ctCardSizeLevel = $state(getCombatTrackerCtCardSizeLevel());

	layoutVersion = $state(0);

	activeDragSourceKey = $state<string | null>(null);

	activeDragSourceCombatantIds = $state<string[]>([]);

	dragHandleArmedEntryKey = $state<string | null>(null);

	dragPreview = $state<CombatantDropPreview | null>(null);

	renderVersion = $state(0);

	lastCombatSignature = $state('');

	ctWidthPreviewLevel = $state<number | null>(null);

	ctCardSizePreviewLevel = $state<number | null>(null);

	sharedMonsterCardsExpanded = $state(false);

	monsterCardsExpanded = $state(false);

	sceneMonsterAliveCombatants = $derived(
		this.sceneAliveCombatants.filter((combatant) => isMonsterOrMinionCombatant(combatant)),
	);

	sceneMonsterDeadCombatants = $derived(
		this.sceneDeadCombatants.filter((combatant) => isMonsterOrMinionCombatant(combatant)),
	);

	sceneAllMonsterCombatants = $derived([
		...this.sceneMonsterAliveCombatants,
		...this.sceneMonsterDeadCombatants,
	]);

	hasMonsterCombatants = $derived(this.sceneAllMonsterCombatants.length > 0);

	canCurrentUserToggleMonsterCards = $derived(Boolean(game.user?.isGM));

	canCurrentUserViewExpandedMonsters = $derived(
		Boolean(game.user?.isGM) || this.playersCanViewExpandedMonsters,
	);

	shouldCollapseMonsterCards = $derived(this.hasMonsterCombatants && !this.monsterCardsExpanded);

	renderedDeadCombatants = $derived(
		this.sceneDeadCombatants.filter((combatant) => isPlayerCombatant(combatant)),
	);

	aliveEntries = $derived.by(() =>
		buildAliveEntries(this.sceneAliveCombatants, this.shouldCollapseMonsterCards),
	);

	activeCombatantId = $derived.by(() => {
		trackDependency(this.renderVersion);
		return getActiveCombatantId(this.currentCombat);
	});

	activeCombatant = $derived.by(() => {
		trackDependency(this.renderVersion);
		return getActiveCombatant(this.currentCombat);
	});

	canCurrentUserEndTurn = $derived.by(() => canCurrentUserEndCombatantTurn(this.activeCombatant));

	activeEntryKey = $derived.by(() => {
		const activeOccurrence = this.activeCombatantId
			? getActiveCombatantOccurrence(this.currentCombat, this.activeCombatantId)
			: null;
		return resolveActiveEntryKey({
			activeCombatantId: this.activeCombatantId,
			activeOccurrence,
			aliveEntries: this.aliveEntries,
			collapseMonsters: this.shouldCollapseMonsterCards,
		});
	});

	orderedAliveEntries = $derived.by(() =>
		orderEntriesForCenteredActive(this.aliveEntries, this.activeEntryKey, true),
	);

	roundBoundaryKey = $derived.by(() =>
		getRoundBoundaryKey(
			this.sceneAliveCombatants,
			this.aliveEntries,
			this.shouldCollapseMonsterCards,
		),
	);

	roundSeparatorIndex = $derived.by(() =>
		getRoundSeparatorInsertionIndex(this.orderedAliveEntries, this.roundBoundaryKey),
	);

	combatStarted = $derived.by(() => {
		trackDependency(this.renderVersion);
		return isCombatStarted(this.currentCombat);
	});

	currentRoundLabel = $derived.by(() => {
		trackDependency(this.renderVersion);
		return Math.max(1, this.currentCombat?.round ?? 1);
	});

	ctTrackMaxWidth = $derived.by(() => {
		trackDependency(this.layoutVersion);
		return resolveCtTrackMaxWidth(this.ctWidthLevel);
	});

	ctWidthPreviewVisible = $derived(this.ctWidthPreviewLevel !== null);

	ctWidthPreviewMaxWidth = $derived.by(() =>
		resolveCtTrackMaxWidth(this.ctWidthPreviewLevel ?? this.ctWidthLevel),
	);

	ctCardSizePreviewActive = $derived(this.ctCardSizePreviewLevel !== null);

	ctEffectiveCardSizeLevel = $derived(this.ctCardSizePreviewLevel ?? this.ctCardSizeLevel);

	ctCardScale = $derived.by(() => getCtCardScale(this.ctEffectiveCardSizeLevel));

	resolveActionCombat(): Combat | null {
		const resolvedState = resolveActionCombatState({
			currentCombat: this.currentCombat,
			preferredCombatId: this.preferredCombatId,
		});
		this.preferredCombatId = resolvedState.preferredCombatId;
		return resolvedState.combat;
	}

	refreshCurrentCombat(force = false): boolean {
		const combat = getCombatForCurrentScene(this.preferredCombatId);
		syncCombatTurnsForCt(combat);
		const sceneId = canvas.scene?.id;
		const signature = buildCombatSyncSignature(combat, sceneId);
		if (!force && signature === this.lastCombatSignature) return false;
		this.lastCombatSignature = signature;
		const { aliveCombatants, deadCombatants } = getCombatantsForScene(combat, sceneId);
		this.currentCombat = combat;
		this.preferredCombatId = combat?.id ?? combat?._id ?? null;
		this.sceneAliveCombatants = aliveCombatants;
		this.sceneDeadCombatants = deadCombatants;
		this.playersCanViewExpandedMonsters = getPlayersCanViewExpandedMonsters(combat);
		this.sharedMonsterCardsExpanded = getSharedMonsterCardsExpanded(combat);
		this.renderVersion += 1;
		this.syncMonsterCardsExpanded();
		return true;
	}

	async toggleMonsterCardsExpanded(): Promise<boolean> {
		if (!this.canCurrentUserToggleMonsterCards) return false;
		const combat = this.resolveActionCombat();
		if (!combat) return false;
		const nextExpanded = !this.sharedMonsterCardsExpanded;
		await combat.update({
			[CT_MONSTER_CARDS_EXPANDED_FLAG_PATH]: nextExpanded,
		} as Record<string, unknown>);
		this.sharedMonsterCardsExpanded = nextExpanded;
		this.syncMonsterCardsExpanded();
		return true;
	}

	syncMonsterCardsExpanded(): void {
		const normalizedMonsterCardsExpanded = resolveMonsterCardsExpandedState({
			hasMonsterCombatants: this.hasMonsterCombatants,
			canCurrentUserViewExpandedMonsters: this.canCurrentUserViewExpandedMonsters,
			sharedMonsterCardsExpanded: this.sharedMonsterCardsExpanded,
		});
		if (this.monsterCardsExpanded !== normalizedMonsterCardsExpanded) {
			this.monsterCardsExpanded = normalizedMonsterCardsExpanded;
		}
	}

	clearDropPreview(): void {
		this.dragPreview = null;
	}

	clearDragState(): void {
		this.activeDragSourceKey = null;
		this.activeDragSourceCombatantIds = [];
		this.dragHandleArmedEntryKey = null;
		this.dragPreview = null;
	}

	applySettingPatch(settingKey: unknown): CtTopTrackerSettingPatch | null {
		const patch = resolveCtTopTrackerSettingPatch(settingKey);
		if (!patch) return null;

		if (patch.resourceDrawerHoverEnabled !== undefined) {
			this.resourceDrawerHoverEnabled = patch.resourceDrawerHoverEnabled;
		}
		if (patch.playerHpBarTextMode !== undefined) {
			this.playerHpBarTextMode = patch.playerHpBarTextMode;
		}
		if (patch.nonPlayerHpBarEnabled !== undefined) {
			this.nonPlayerHpBarEnabled = patch.nonPlayerHpBarEnabled;
		}
		if (patch.nonPlayerHpBarTextMode !== undefined) {
			this.nonPlayerHpBarTextMode = patch.nonPlayerHpBarTextMode;
		}
		if (patch.ctEnabled !== undefined) {
			this.ctEnabled = patch.ctEnabled;
		}
		if (patch.ctWidthLevel !== undefined) {
			this.ctWidthLevel = patch.ctWidthLevel;
		}
		if (patch.ctCardSizeLevel !== undefined) {
			this.ctCardSizeLevel = patch.ctCardSizeLevel;
		}
		if (patch.layoutVersionDelta) {
			this.layoutVersion += patch.layoutVersionDelta;
		}
		this.syncMonsterCardsExpanded();
		return patch;
	}

	applyWidthPreviewDetail(detail: CtWidthPreviewEventDetail): void {
		if (detail.active === false) {
			this.ctWidthPreviewLevel = null;
			return;
		}
		if (detail.active !== true) return;
		this.ctWidthPreviewLevel = normalizeCtWidthLevel(detail.widthLevel);
	}

	applyCardSizePreviewDetail(detail: { active?: boolean; cardSizeLevel?: unknown }): void {
		if (detail.active === false) {
			this.ctCardSizePreviewLevel = null;
			return;
		}
		if (detail.active !== true) return;
		this.ctCardSizePreviewLevel = normalizeCtCardSizeLevel(detail.cardSizeLevel);
	}

	invalidateLayout(): void {
		this.layoutVersion += 1;
	}

	replaceCurrentCombat(combat: Combat | null): void {
		this.currentCombat = combat;
		this.renderVersion += 1;
	}

	canToggleHeroicReactionFromDrawer(
		combatant: Combatant.Implementation,
		reactionKey: HeroicReactionKey,
		reactionActive: boolean | undefined,
	): boolean {
		if (game.user?.isGM) return true;
		if (reactionActive === false) return false;
		if (!isCombatStarted(this.currentCombat)) return false;
		if ((this.currentCombat?.combatant?.id ?? null) === getCombatantId(combatant)) return false;
		if (getCombatantCurrentActions(combatant) < 1) return false;
		return canOwnerUseHeroicReaction(reactionKey) && Boolean(combatant.actor?.isOwner);
	}
}
