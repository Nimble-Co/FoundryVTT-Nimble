<script lang="ts">
	import { onDestroy, onMount, tick } from 'svelte';
	import { fade } from 'svelte/transition';
	import GenericDialog from '../../documents/dialogs/GenericDialog.svelte.js';
	import {
		canCurrentUserDisplayNonPlayerHitpointsOnCards,
		getCombatTrackerCenterActiveCardEnabled,
		getCombatTrackerNcctCardSizeLevel,
		getCombatTrackerNcctEnabled,
		getCombatTrackerNcctWidthLevel,
		getCombatTrackerPlayersCanExpandMonsterCards,
		isCombatTrackerCardSizeLevelSettingKey,
		isCombatTrackerCenterActiveCardSettingKey,
		isCombatTrackerEnabledSettingKey,
		isCombatTrackerNonPlayerHitpointPermissionSettingKey,
		isCombatTrackerPlayerMonsterExpansionSettingKey,
		isCombatTrackerWidthLevelSettingKey,
	} from '../../settings/combatTrackerSettings.js';
	import NcctSettingsDialogComponent from '../dialogs/NcctSettingsDialog.svelte';
	import { canCurrentUserReorderCombatant } from '../../utils/combatantOrdering.js';
	import {
		COMBATANT_ACTIONS_CURRENT_PATH,
		canCurrentUserEndTurn as canCurrentUserEndCombatantTurn,
		getCombatantCurrentActions,
		getCombatantMaxActions,
	} from '../../utils/combatTurnActions.js';
	import { getCombatantImage } from '../../utils/combatantImage.js';
	import { getActorHpValue, isCombatantDead } from '../../utils/isCombatantDead.js';

	interface SceneCombatantLists {
		aliveCombatants: Combatant.Implementation[];
		deadCombatants: Combatant.Implementation[];
	}

	interface TrackEntry {
		key: string;
		kind: 'combatant' | 'monster-stack';
		combatant?: Combatant.Implementation;
	}

	interface CombatantDropPreview {
		sourceId: string;
		targetId: string;
		before: boolean;
	}

	interface VirtualizedAliveEntries {
		enabled: boolean;
		startIndex: number;
		endIndex: number;
		leadingWidthPx: number;
		trailingWidthPx: number;
		entries: TrackEntry[];
	}

	type HpBadgeState = 'green' | 'yellow' | 'red' | 'unknown';

	type CombatWithDrop = Combat & {
		_onDrop?: (event: DragEvent & { target: EventTarget & HTMLElement }) => Promise<unknown>;
	};

	const PORTRAIT_FALLBACK_IMAGE = 'icons/svg/mystery-man.svg';
	const ACTION_DICE_ICON_CLASSES = [
		'fa-solid fa-dice-one',
		'fa-solid fa-dice-two',
		'fa-solid fa-dice-three',
	] as const;
	const MAX_RENDERED_ACTION_DICE = ACTION_DICE_ICON_CLASSES.length;
	const MIN_TOP_OFFSET_PX = 0;
	const DRAG_TARGET_EXPANSION_REM = 0.85;
	const DRAG_SWITCH_UPPER_RATIO = 0.4;
	const DRAG_SWITCH_LOWER_RATIO = 0.6;
	const NCCT_MIN_WIDTH_LEVEL = 1;
	const NCCT_MAX_WIDTH_LEVEL = 6;
	const NCCT_MIN_CARD_SIZE_LEVEL = 1;
	const NCCT_MAX_CARD_SIZE_LEVEL = 6;
	const NCCT_MIN_SAFE_TRACK_WIDTH_PX = 420;
	const NCCT_FALLBACK_SIDE_RESERVED_PX = 84;
	const NCCT_EDGE_GUTTER_PX = 12;
	const NCCT_MIN_WIDTH_RATIO = 0.52;
	const NCCT_MAX_WIDTH_RATIO = 2;
	const NCCT_MIN_CARD_SCALE = 0.78;
	const NCCT_MAX_CARD_SCALE = 1.2;
	const NCCT_WIDTH_RATIO_STEP =
		(NCCT_MAX_WIDTH_RATIO - NCCT_MIN_WIDTH_RATIO) /
		(NCCT_MAX_WIDTH_LEVEL - NCCT_MIN_WIDTH_LEVEL);
	const NCCT_CARD_SCALE_STEP =
		(NCCT_MAX_CARD_SCALE - NCCT_MIN_CARD_SCALE) /
		(NCCT_MAX_CARD_SIZE_LEVEL - NCCT_MIN_CARD_SIZE_LEVEL);
	const NCCT_VIRTUALIZATION_ENTRY_THRESHOLD = 80;
	const NCCT_VIRTUALIZATION_OVERSCAN = 12;
	const NCCT_ESTIMATED_ENTRY_WIDTH_REM = 6.53;
	const NCCT_SETTINGS_DIALOG_UNIQUE_ID = 'nimble-ncct-settings-dialog';
	let preferredCombatId: string | null = null;

	function normalizeNcctWidthLevel(value: unknown): number {
		const numericValue = Number(value);
		if (!Number.isFinite(numericValue)) return 2;
		const roundedValue = Math.round(numericValue);
		return Math.min(NCCT_MAX_WIDTH_LEVEL, Math.max(NCCT_MIN_WIDTH_LEVEL, roundedValue));
	}

	function getViewportWidthPx(): number {
		return Math.max(0, globalThis.innerWidth || document.documentElement.clientWidth || 0);
	}

	function getNcctWidthRatio(widthLevel: number): number {
		const normalizedWidthLevel = normalizeNcctWidthLevel(widthLevel);
		return NCCT_MIN_WIDTH_RATIO + (normalizedWidthLevel - NCCT_MIN_WIDTH_LEVEL) * NCCT_WIDTH_RATIO_STEP;
	}

	function normalizeNcctCardSizeLevel(value: unknown): number {
		const numericValue = Number(value);
		if (!Number.isFinite(numericValue)) return 3;
		const roundedValue = Math.round(numericValue);
		return Math.min(NCCT_MAX_CARD_SIZE_LEVEL, Math.max(NCCT_MIN_CARD_SIZE_LEVEL, roundedValue));
	}

	function getNcctCardScale(cardSizeLevel: number): number {
		const normalizedCardSizeLevel = normalizeNcctCardSizeLevel(cardSizeLevel);
		return (
			NCCT_MIN_CARD_SCALE +
			(normalizedCardSizeLevel - NCCT_MIN_CARD_SIZE_LEVEL) * NCCT_CARD_SCALE_STEP
		);
	}

	function getVisibleUiRect(selector: string): DOMRect | null {
		const element = document.querySelector<HTMLElement>(selector);
		if (!element) return null;
		const style = globalThis.getComputedStyle(element);
		if (style.display === 'none' || style.visibility === 'hidden') return null;
		const rect = element.getBoundingClientRect();
		if (rect.width <= 0 || rect.height <= 0) return null;
		return rect;
	}

	function getSafeNcctTrackWidthPx(): number {
		const viewportWidth = getViewportWidthPx();
		if (viewportWidth <= 0) return NCCT_MIN_SAFE_TRACK_WIDTH_PX;

		const leftUiRect = getVisibleUiRect('#ui-left');
		const rightUiRect = getVisibleUiRect('#ui-right');
		const leftInset = leftUiRect
			? Math.max(0, leftUiRect.right + NCCT_EDGE_GUTTER_PX)
			: NCCT_FALLBACK_SIDE_RESERVED_PX;
		const rightInset = rightUiRect
			? Math.max(0, viewportWidth - rightUiRect.left + NCCT_EDGE_GUTTER_PX)
			: NCCT_FALLBACK_SIDE_RESERVED_PX;
		const safeWidth = viewportWidth - leftInset - rightInset;
		return Math.max(240, safeWidth);
	}

	function resolveNcctTrackMaxWidth(widthLevel: number): string {
		const widthRatio = getNcctWidthRatio(widthLevel);
		const safeWidthPx = getSafeNcctTrackWidthPx();
		const minimumWidthPx = Math.min(NCCT_MIN_SAFE_TRACK_WIDTH_PX, safeWidthPx);
		const resolvedWidthPx = Math.max(minimumWidthPx, Math.round(safeWidthPx * widthRatio));
		return `${resolvedWidthPx}px`;
	}

	function isLegendaryCombatant(combatant: Combatant.Implementation): boolean {
		return combatant.type === 'soloMonster';
	}

	function isPlayerCombatant(combatant: Combatant.Implementation): boolean {
		return combatant.type === 'character';
	}

	function isMonsterOrMinionCombatant(combatant: Combatant.Implementation): boolean {
		return !isPlayerCombatant(combatant) && !isLegendaryCombatant(combatant);
	}

	function getCombatantId(
		combatant: { id?: string | null; _id?: string | null } | null | undefined,
	): string {
		return combatant?.id ?? combatant?._id ?? '';
	}

	function buildCombatantEntryKey(combatantId: string, occurrence: number): string {
		return `combatant-${combatantId}-${occurrence}`;
	}

	function getCombatantOccurrenceAtIndex(
		combatants: Combatant.Implementation[],
		combatantId: string,
		inclusiveIndex: number,
	): number {
		let occurrence = -1;
		for (let index = 0; index <= inclusiveIndex && index < combatants.length; index += 1) {
			const id = getCombatantId(combatants[index]);
			if (id === combatantId) occurrence += 1;
		}
		return occurrence;
	}

	function findTurnIndexByOccurrence(
		turns: Combatant.Implementation[],
		combatantId: string,
		desiredOccurrence: number | null,
	): number {
		let occurrence = -1;
		for (const [index, turnCombatant] of turns.entries()) {
			if (getCombatantId(turnCombatant) !== combatantId) continue;
			occurrence += 1;
			if (desiredOccurrence === null || occurrence === desiredOccurrence) return index;
		}
		return -1;
	}

	function syncCombatTurnsForNcct(combat: Combat | null): void {
		if (!combat) return;

		const existingTurns = combat.turns;
		const normalizedCurrentTurn =
			typeof combat.turn === 'number' &&
			combat.turn >= 0 &&
			combat.turn < existingTurns.length
				? combat.turn
				: null;
		const currentCombatantId =
			normalizedCurrentTurn !== null
				? getCombatantId(existingTurns[normalizedCurrentTurn])
				: getCombatantId(combat.combatant);
		const currentOccurrence =
			currentCombatantId && normalizedCurrentTurn !== null
				? getCombatantOccurrenceAtIndex(existingTurns, currentCombatantId, normalizedCurrentTurn)
				: null;

		let normalizedTurns: Combatant.Implementation[];
		try {
			normalizedTurns = combat.setupTurns();
		} catch (_error) {
			return;
		}

		combat.turns = normalizedTurns;
		if (normalizedTurns.length === 0) {
			combat.turn = 0;
			return;
		}

		if (currentCombatantId) {
			const matchedIndex = findTurnIndexByOccurrence(
				normalizedTurns,
				currentCombatantId,
				currentOccurrence,
			);
			if (matchedIndex >= 0) {
				combat.turn = matchedIndex;
				return;
			}
		}

		const fallbackTurn = Number.isInteger(combat.turn) ? Number(combat.turn) : 0;
		combat.turn = Math.min(Math.max(fallbackTurn, 0), normalizedTurns.length - 1);
	}

	function getCombatantSceneId(combatant: Combatant.Implementation): string | undefined {
		if (combatant.sceneId) return combatant.sceneId;
		if (combatant.token?.parent?.id) return combatant.token.parent.id;

		const sceneId = canvas.scene?.id;
		if (sceneId && combatant.tokenId) {
			const tokenDoc = canvas.scene?.tokens?.get(combatant.tokenId);
			if (tokenDoc) return sceneId;
		}

		return undefined;
	}

	function hasCombatantsForScene(combat: Combat, sceneId: string): boolean {
		return combat.combatants.contents.some(
			(combatant) => getCombatantSceneId(combatant) === sceneId,
		);
	}

	function isCombatStarted(combat: Combat | null): boolean {
		if (!combat) return false;
		const asRecord = combat as unknown as { started?: boolean };
		if (typeof asRecord.started === 'boolean') return asRecord.started;
		return (combat.round ?? 0) > 0;
	}

	function isCombatRoundStarted(combat: Combat | null): boolean {
		return (combat?.round ?? 0) > 0;
	}

	function getCombatSelectionScore(
		combat: Combat,
		sceneId: string,
		activeCombat: Combat | null,
		viewedCombat: Combat | null,
	): number {
		let score = 0;
		if (isCombatStarted(combat)) score += 10000;
		if (combat.round && combat.round > 0) score += Math.min(2000, combat.round * 10);
		if (combat.active) score += 1000;
		if (combat === activeCombat && combat.scene?.id === sceneId) score += 3000;
		if (combat === viewedCombat && combat.scene?.id === sceneId) score += 2000;
		score += Math.min(500, combat.combatants.size * 5);
		return score;
	}

	function getCombatForCurrentScene(): Combat | null {
		const sceneId = canvas.scene?.id;
		if (!sceneId) return null;

		const activeCombat = game.combat;
		const viewedCombat = game.combats.viewed ?? null;
		const sceneCombats = game.combats.contents.filter((combat) => {
			if (combat.scene?.id === sceneId) return true;
			return hasCombatantsForScene(combat, sceneId);
		});
		if (sceneCombats.length < 1) return null;

		if (preferredCombatId) {
			const preferredCombat = sceneCombats.find(
				(combat) => (combat.id ?? combat._id ?? null) === preferredCombatId,
			);
			if (preferredCombat) return preferredCombat;
		}

		if (activeCombat) {
			const activeCombatId = activeCombat.id ?? activeCombat._id ?? null;
			const activeSceneCombat = sceneCombats.find(
				(combat) => combat === activeCombat || (combat.id ?? combat._id ?? null) === activeCombatId,
			);
			if (activeSceneCombat) return activeSceneCombat;
		}

		if (viewedCombat) {
			const viewedCombatId = viewedCombat.id ?? viewedCombat._id ?? null;
			const viewedSceneCombat = sceneCombats.find(
				(combat) => combat === viewedCombat || (combat.id ?? combat._id ?? null) === viewedCombatId,
			);
			if (viewedSceneCombat) return viewedSceneCombat;
		}

		sceneCombats.sort((left, right) => {
			const leftScore = getCombatSelectionScore(left, sceneId, activeCombat, viewedCombat);
			const rightScore = getCombatSelectionScore(right, sceneId, activeCombat, viewedCombat);
			return rightScore - leftScore;
		});
		return sceneCombats[0] ?? null;
	}

	function resolveActionCombat(): Combat | null {
		const sceneCombat = getCombatForCurrentScene();
		if (sceneCombat) {
			syncCombatTurnsForNcct(sceneCombat);
			preferredCombatId = sceneCombat.id ?? sceneCombat._id ?? null;
			return sceneCombat;
		}

		const currentCombatId = currentCombat?.id ?? currentCombat?._id ?? '';
		if (!currentCombatId) return currentCombat;
		const fallbackCombat = game.combats.get(currentCombatId) ?? currentCombat;
		syncCombatTurnsForNcct(fallbackCombat);
		return fallbackCombat;
	}

	function logNcctControl(action: string, details: Record<string, unknown> = {}): void {
		console.info(`[Nimble][NCCT] ${action}`, details);
	}

	function sortDeadCombatants(
		left: Combatant.Implementation,
		right: Combatant.Implementation,
	): number {
		const typeDiff =
			Number(isMonsterOrMinionCombatant(left)) - Number(isMonsterOrMinionCombatant(right));
		if (typeDiff !== 0) return typeDiff;
		return (left.name ?? '').localeCompare(right.name ?? '');
	}

	function getCombatantsForScene(
		combat: Combat | null,
		sceneId: string | undefined,
	): SceneCombatantLists {
		if (!combat || !sceneId) return { aliveCombatants: [], deadCombatants: [] };

		const combatantsForScene = combat.combatants.contents.filter(
			(combatant) =>
				getCombatantSceneId(combatant) === sceneId && combatant.visible && combatant._id != null,
		);
		const turnCombatants = combat.turns
			.map((turnCombatant) => {
				const combatantId = turnCombatant.id ?? turnCombatant._id ?? '';
				if (!combatantId) return null;
				return combat.combatants.get(combatantId) ?? turnCombatant;
			})
			.filter((combatant): combatant is Combatant.Implementation => Boolean(combatant))
			.filter(
				(combatant) =>
					getCombatantSceneId(combatant) === sceneId &&
					combatant.visible &&
					combatant._id != null,
			);
		const turnCombatantIds = new Set(turnCombatants.map((combatant) => combatant.id ?? ''));

		const aliveCombatants = [
			...turnCombatants.filter((combatant) => !isCombatantDead(combatant)),
			...combatantsForScene.filter((combatant) => {
				if (isCombatantDead(combatant)) return false;
				return !turnCombatantIds.has(combatant.id ?? '');
			}),
		];
		const deadCombatants = combatantsForScene
			.filter((combatant) => isCombatantDead(combatant))
			.sort(sortDeadCombatants);

		return { aliveCombatants, deadCombatants };
	}

	function getCombatantDisplayName(combatant: Combatant.Implementation): string {
		return (
			combatant.token?.reactive?.name ??
			combatant.token?.name ??
			combatant.token?.actor?.reactive?.name ??
			combatant.reactive?.name ??
			combatant.name ??
			'Unknown'
		);
	}

	function getCombatantHpText(combatant: Combatant.Implementation): string {
		const hpValue = getActorHpValue(combatant.actor);
		if (hpValue === null) return '--';
		return Number.isInteger(hpValue) ? String(hpValue) : hpValue.toFixed(1);
	}

	function getCombatantHpMaxValue(combatant: Combatant.Implementation): number | null {
		const hpMaxRaw = Number(
			foundry.utils.getProperty(combatant.actor, 'system.attributes.hp.max') as number | null,
		);
		if (!Number.isFinite(hpMaxRaw) || hpMaxRaw <= 0) return null;
		return hpMaxRaw;
	}

	function getCombatantHpBadgeState(combatant: Combatant.Implementation): HpBadgeState {
		const hpCurrent = getActorHpValue(combatant.actor);
		const hpMax = getCombatantHpMaxValue(combatant);
		if (hpCurrent === null || hpMax === null) return 'unknown';

		const hpRatio = hpCurrent / hpMax;
		if (hpRatio <= 1 / 3) return 'red';
		if (hpRatio <= 2 / 3) return 'yellow';
		return 'green';
	}

	function getCombatantHpBadgeClass(combatant: Combatant.Implementation): string {
		const state = getCombatantHpBadgeState(combatant);
		switch (state) {
			case 'red':
				return 'nimble-ncct__badge--hp-red';
			case 'yellow':
				return 'nimble-ncct__badge--hp-yellow';
			case 'green':
				return 'nimble-ncct__badge--hp-green';
			default:
				return 'nimble-ncct__badge--hp-unknown';
		}
	}

	function shouldRenderHpBadge(combatant: Combatant.Implementation): boolean {
		if (isPlayerCombatant(combatant)) return true;
		return canCurrentUserViewNonPlayerHitpoints;
	}

	function getActionState(combatant: Combatant.Implementation): {
		current: number;
		max: number;
		overflow: number;
		slots: number[];
	} {
		const normalizedCurrent = getCombatantCurrentActions(combatant);
		const normalizedMax = getCombatantMaxActions(combatant);
		const visiblePips = Math.min(normalizedMax, MAX_RENDERED_ACTION_DICE);
		return {
			current: normalizedCurrent,
			max: normalizedMax,
			overflow: Math.max(0, normalizedMax - MAX_RENDERED_ACTION_DICE),
			slots: Array.from({ length: visiblePips }, (_value, index) => index),
		};
	}

	function getActionDiceIconClass(slot: number): (typeof ACTION_DICE_ICON_CLASSES)[number] {
		const clampedIndex = Math.max(0, Math.min(slot, ACTION_DICE_ICON_CLASSES.length - 1));
		return ACTION_DICE_ICON_CLASSES[clampedIndex];
	}

	function hasCombatantTurnRemainingThisRound(combatant: Combatant.Implementation): boolean {
		if (isPlayerCombatant(combatant) || isLegendaryCombatant(combatant)) return true;
		return getCombatantCurrentActions(combatant) > 0;
	}

	function isFriendlyCombatant(combatant: Combatant.Implementation): boolean {
		const tokenDisposition = Number(
			combatant.token?.disposition ?? combatant.token?.object?.document?.disposition ?? NaN,
		);
		return tokenDisposition === CONST.TOKEN_DISPOSITIONS.FRIENDLY;
	}

	function isEligibleForInitiativeRoll(combatant: Combatant.Implementation): boolean {
		return combatant.type === 'character' || isFriendlyCombatant(combatant);
	}

	function getTrackEntryCombatantId(entry: TrackEntry): string {
		return getCombatantId(entry.combatant);
	}

	function buildAliveEntries(
		combatants: Combatant.Implementation[],
		collapseMonsters: boolean,
		includeMonsterStack: boolean,
	): TrackEntry[] {
		const entries: TrackEntry[] = [];
		const occurrenceByCombatantId = new Map<string, number>();
		let stackInserted = false;
		for (const combatant of combatants) {
			if (collapseMonsters && isMonsterOrMinionCombatant(combatant)) {
				if (!stackInserted) {
					entries.push({ key: 'monster-stack', kind: 'monster-stack' });
					stackInserted = true;
				}
				continue;
			}
			const combatantId = getCombatantId(combatant);
			const occurrence = occurrenceByCombatantId.get(combatantId) ?? 0;
			occurrenceByCombatantId.set(combatantId, occurrence + 1);
			entries.push({
				key: combatantId ? buildCombatantEntryKey(combatantId, occurrence) : `combatant-${entries.length}`,
				kind: 'combatant',
				combatant,
			});
		}

		if (collapseMonsters && includeMonsterStack && !stackInserted) {
			entries.push({ key: 'monster-stack', kind: 'monster-stack' });
		}
		return entries;
	}

	function getActiveCombatantId(combat: Combat | null): string | null {
		if (!combat) return null;
		const turnIndex = Number(combat.turn ?? -1);
		if (Number.isInteger(turnIndex) && turnIndex >= 0 && turnIndex < combat.turns.length) {
			return combat.turns[turnIndex]?.id ?? null;
		}
		return combat.combatant?.id ?? null;
	}

	function getActiveCombatant(combat: Combat | null): Combatant.Implementation | null {
		if (!combat) return null;
		const activeId = getActiveCombatantId(combat);
		if (!activeId) return null;
		return (
			combat.combatants.get(activeId) ??
			combat.turns.find((turnCombatant) => turnCombatant.id === activeId) ??
			null
		);
	}

	function getActiveCombatantOccurrence(combat: Combat | null, activeId: string): number | null {
		if (!combat) return null;
		const turnIndex = Number(combat.turn ?? -1);
		if (!Number.isInteger(turnIndex) || turnIndex < 0 || turnIndex >= combat.turns.length) return null;
		return getCombatantOccurrenceAtIndex(combat.turns, activeId, turnIndex);
	}

	function resolveActiveEntryKey(params: {
		activeCombatantId: string | null;
		activeOccurrence: number | null;
		aliveEntries: TrackEntry[];
		collapseMonsters: boolean;
		monsterCombatants: Combatant.Implementation[];
	}): string | null {
		const { activeCombatantId, activeOccurrence, aliveEntries, collapseMonsters, monsterCombatants } =
			params;
		if (!activeCombatantId) return aliveEntries[0]?.key ?? null;

		if (
			collapseMonsters &&
			monsterCombatants.some((combatant) => getCombatantId(combatant) === activeCombatantId)
		) {
			return 'monster-stack';
		}

		if (activeOccurrence !== null) {
			const activeCombatantKey = buildCombatantEntryKey(activeCombatantId, activeOccurrence);
			if (aliveEntries.some((entry) => entry.key === activeCombatantKey)) return activeCombatantKey;
		}

		const fallbackEntry = aliveEntries.find(
			(entry) => entry.kind === 'combatant' && getTrackEntryCombatantId(entry) === activeCombatantId,
		);
		return fallbackEntry?.key ?? aliveEntries[0]?.key ?? null;
	}

	function orderEntriesForCenteredActive(
		entries: TrackEntry[],
		activeKey: string | null,
		centerActiveCards: boolean,
	): TrackEntry[] {
		if (!centerActiveCards) return entries;
		if (entries.length <= 1 || !activeKey) return entries;
		const activeIndex = entries.findIndex((entry) => entry.key === activeKey);
		if (activeIndex < 0) return entries;

		const halfLength = Math.floor(entries.length / 2);
		return Array.from({ length: entries.length }, (_value, index) => {
			const sourceIndex = (activeIndex - halfLength + index + entries.length) % entries.length;
			return entries[sourceIndex];
		});
	}

	function findRoundBoundaryIndex(sceneAliveCombatants: Combatant.Implementation[]): number {
		if (sceneAliveCombatants.length < 1) return -1;
		for (let index = sceneAliveCombatants.length - 1; index >= 0; index -= 1) {
			if (hasCombatantTurnRemainingThisRound(sceneAliveCombatants[index])) return index;
		}
		return sceneAliveCombatants.length - 1;
	}

	function getRoundBoundaryKey(
		sceneAliveCombatants: Combatant.Implementation[],
		collapseMonsters: boolean,
	): string | null {
		const boundaryIndex = findRoundBoundaryIndex(sceneAliveCombatants);
		if (boundaryIndex < 0) return null;

		const lastCurrentRoundCombatant = sceneAliveCombatants[boundaryIndex];
		if (!lastCurrentRoundCombatant) return null;

		if (collapseMonsters && isMonsterOrMinionCombatant(lastCurrentRoundCombatant)) {
			return 'monster-stack';
		}

		const combatantId = getCombatantId(lastCurrentRoundCombatant);
		if (!combatantId) return null;
		const occurrence = getCombatantOccurrenceAtIndex(sceneAliveCombatants, combatantId, boundaryIndex);
		return buildCombatantEntryKey(combatantId, occurrence);
	}

	function getRoundSeparatorInsertionIndex(
		orderedEntries: TrackEntry[],
		roundBoundaryKey: string | null,
	): number {
		if (orderedEntries.length < 1 || !roundBoundaryKey) return -1;
		const boundaryIndex = orderedEntries.findIndex((entry) => entry.key === roundBoundaryKey);
		if (boundaryIndex < 0) return -1;
		return (boundaryIndex + 1) % orderedEntries.length;
	}

	function buildCombatSyncSignature(combat: Combat | null, sceneId: string | undefined): string {
		if (!combat || !sceneId) return 'none';

		const combatId = combat.id ?? combat._id ?? 'unknown';
		const started = isCombatStarted(combat) ? 1 : 0;
		const round = Number(combat.round ?? 0);
		const turn = Number(combat.turn ?? -1);
		const activeId = getActiveCombatantId(combat) ?? '';
		const turns = combat.turns
			.filter((combatant) => getCombatantSceneId(combatant) === sceneId)
			.map((combatant) => combatant.id ?? combatant._id ?? '')
			.join(',');
		const actionSummary = combat.combatants.contents
			.filter((combatant) => getCombatantSceneId(combatant) === sceneId)
			.map((combatant) => {
				const currentActions = getCombatantCurrentActions(combatant);
				const maxActions = getCombatantMaxActions(combatant);
				return `${combatant.id ?? combatant._id ?? ''}:${currentActions}:${maxActions}:${Number(isCombatantDead(combatant))}`;
			})
			.join('|');

		return `${combatId}|${started}|${round}|${turn}|${activeId}|${turns}|${actionSummary}`;
	}

	async function rollEligibleInitiative(combat: Combat): Promise<void> {
		const sceneId = canvas.scene?.id;
		const eligibleIds = combat.combatants.contents
			.filter((combatant) => {
				if (sceneId && getCombatantSceneId(combatant) !== sceneId) return false;
				if (!isEligibleForInitiativeRoll(combatant)) return false;
				return combatant.initiative == null;
			})
			.map((combatant) => combatant.id)
			.filter((id): id is string => Boolean(id));
		if (eligibleIds.length < 1) {
			ui.notifications?.info('No eligible player or friendly NPC initiatives to roll.');
			return;
		}
		await combat.rollInitiative(eligibleIds, { updateTurn: false });
	}

	function canCurrentUserRollInitiativeForCombatant(combatant: Combatant.Implementation): boolean {
		const currentUser = game.user;
		if (!currentUser) return false;
		if (currentUser.isGM) return true;
		if (!combatant.actor) return false;
		return combatant.actor.testUserPermission(
			currentUser,
			CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER,
		);
	}

	function shouldShowInitiativePromptForCombatant(combatant: Combatant.Implementation): boolean {
		if (combatStarted) return false;
		if (!isPlayerCombatant(combatant)) return false;
		return combatant.initiative == null;
	}

	async function handleCombatantInitiativeRoll(
		event: MouseEvent,
		combatant: Combatant.Implementation,
	): Promise<void> {
		event.preventDefault();
		event.stopPropagation();

		if (!shouldShowInitiativePromptForCombatant(combatant)) return;
		if (!canCurrentUserRollInitiativeForCombatant(combatant)) {
			ui.notifications?.warn('Only the GM or the hero owner can roll initiative.');
			return;
		}

		const actionCombat = resolveActionCombat();
		const combatantId = getCombatantId(combatant);
		if (!actionCombat || !combatantId) return;

		try {
			await actionCombat.rollInitiative([combatantId], { updateTurn: false });
			updateCurrentCombat(true);
		} catch (error) {
			console.error('[Nimble][NCCT] Initiative roll failed', { combatantId, error });
			const errorMessage = error instanceof Error ? error.message : String(error);
			ui.notifications?.error(`Unable to roll initiative: ${errorMessage}`);
		}
	}

	function openNcctSettingsDialog(): void {
		const dialogWidth = 760;
		const clampInsetPx = 12;

		try {
			const dialog = GenericDialog.getOrCreate(
				'NCCT Settings',
				NcctSettingsDialogComponent,
				{},
				{
					icon: 'fa-solid fa-gear',
					width: dialogWidth,
					uniqueId: NCCT_SETTINGS_DIALOG_UNIQUE_ID,
				},
			);
			void dialog.render(true).then(() => {
				const dialogElement = dialog.element;
				const measuredWidth =
					dialogElement?.offsetWidth ??
					(typeof dialog.position.width === 'number' ? dialog.position.width : dialogWidth);
				const measuredHeight = dialogElement?.offsetHeight ?? 0;
				const centeredLeft = Math.round((window.innerWidth - measuredWidth) / 2);
				const centeredTop = Math.round((window.innerHeight - measuredHeight) / 2);
				dialog.setPosition({
					left: Math.max(clampInsetPx, centeredLeft),
					top: Math.max(clampInsetPx, centeredTop),
				});
			});
		} catch (_error) {
			ui.notifications?.warn('NCCT settings are unavailable in this context.');
		}
	}

	function updateTopOffset(): void {
		topOffsetPx = MIN_TOP_OFFSET_PX;
	}

	function updatePlayerMonsterExpansionPermission(): void {
		playersCanExpandMonsterCards = getCombatTrackerPlayersCanExpandMonsterCards();
	}

	function updateNonPlayerHitpointPermission(): void {
		canCurrentUserViewNonPlayerHitpoints = canCurrentUserDisplayNonPlayerHitpointsOnCards();
	}

	async function centerActiveEntryInView(activeKey: string | null): Promise<void> {
		if (!trackElement) return;
		await tick();
		if (!trackElement) return;
		if (!centerActiveCardEnabled) return;
		if (!activeKey) {
			const centeredScrollLeft = Math.max(
				0,
				(trackElement.scrollWidth - trackElement.clientWidth) / 2,
			);
			trackElement.scrollTo({ left: centeredScrollLeft, behavior: 'smooth' });
			updateTrackViewportMetrics();
			return;
		}

		const activeIndex = orderedAliveEntries.findIndex((entry) => entry.key === activeKey);
		const activeElement = trackElement.querySelector<HTMLElement>(
			`[data-track-key='${activeKey}']`,
		);
		const scrollLeft = activeElement
			? activeElement.offsetLeft - trackElement.clientWidth / 2 + activeElement.clientWidth / 2
			: activeIndex >= 0
				? activeIndex * getEstimatedNcctEntryWidthPx() -
					trackElement.clientWidth / 2 +
					getEstimatedNcctEntryWidthPx() / 2
				: null;
		if (scrollLeft == null) return;
		trackElement.scrollTo({ left: Math.max(0, scrollLeft), behavior: 'smooth' });
		updateTrackViewportMetrics();
	}

	function updateCurrentCombat(force = false): void {
		queueMicrotask(() => {
			const combat = getCombatForCurrentScene();
			syncCombatTurnsForNcct(combat);
			const sceneId = canvas.scene?.id;
			const signature = buildCombatSyncSignature(combat, sceneId);
			if (!force && signature === lastCombatSignature) return;
			lastCombatSignature = signature;
			const { aliveCombatants, deadCombatants } = getCombatantsForScene(combat, sceneId);
			currentCombat = combat;
			preferredCombatId = combat?.id ?? combat?._id ?? null;
			sceneAliveCombatants = aliveCombatants;
			sceneDeadCombatants = deadCombatants;
			renderVersion += 1;
			queueMicrotask(() => {
				updateTrackViewportMetrics();
			});
		});
	}

	function localizeWithFallback(key: string, fallback: string): string {
		const localized = game.i18n?.localize?.(key);
		if (typeof localized === 'string' && localized !== key) return localized;
		return fallback;
	}

	async function confirmEndEncounter(): Promise<boolean> {
		const dialogApi = foundry.applications?.api?.DialogV2;
		const title = localizeWithFallback('COMBAT.EndTitle', 'End Encounter?');
		const prompt = localizeWithFallback(
			'COMBAT.EndConfirmation',
			'End this encounter and empty the turn tracker?',
		);
		const yesLabel = localizeWithFallback('Yes', 'Yes');
		const noLabel = localizeWithFallback('No', 'No');

		if (!dialogApi?.wait) {
			return globalThis.confirm(prompt);
		}

		const result = await dialogApi.wait({
			window: { title },
			content: `<p>${prompt}</p>`,
			modal: true,
			rejectClose: false,
			buttons: [
				{
					action: 'no',
					icon: 'fa-solid fa-xmark',
					label: noLabel,
				},
				{
					action: 'yes',
					icon: 'fa-solid fa-check',
					label: yesLabel,
					default: true,
				},
			],
		});

		return result === true || result === 'yes';
	}

	async function handleEndTurnFromCard(event: MouseEvent): Promise<void> {
		event.preventDefault();
		event.stopPropagation();
		if (!canCurrentUserEndTurn) return;
		const actionCombat = resolveActionCombat();
		if (!actionCombat) return;
		await actionCombat.nextTurn();
		updateCurrentCombat(true);
	}

	function toggleMonsterCardExpansion(event: MouseEvent): void {
		event.preventDefault();
		event.stopPropagation();
		if (!canCurrentUserExpandMonsterCards) return;
		monsterCardsExpanded = !monsterCardsExpanded;
		void tick().then(() => {
			void centerActiveEntryInView(activeEntryKey);
		});
	}

	function canCurrentUserAdjustCombatantActions(combatant: Combatant.Implementation): boolean {
		if (isCombatantDead(combatant)) return false;
		if (game.user?.isGM) return true;
		return Boolean(combatant.actor?.isOwner);
	}

	function resolveNextCombatantActionsForSlot(params: {
		slot: number;
		currentActions: number;
		maxActions: number;
	}): number {
		const clampedMax = Math.max(0, Math.floor(params.maxActions));
		const clampedCurrent = Math.min(clampedMax, Math.max(0, Math.floor(params.currentActions)));
		const targetFromSlot = Math.min(clampedMax, Math.max(0, params.slot + 1));
		if (targetFromSlot === clampedCurrent) return Math.max(0, clampedCurrent - 1);
		return targetFromSlot;
	}

	async function handleActionDieClick(
		event: MouseEvent,
		combatant: Combatant.Implementation,
		slot: number,
	): Promise<void> {
		event.preventDefault();
		event.stopPropagation();

		if (!canCurrentUserAdjustCombatantActions(combatant)) return;
		const combat = resolveActionCombat();
		const combatantId = getCombatantId(combatant);
		if (!combat || !combatantId) return;

		const combatantDocument = combat.combatants.get(combatantId) ?? combatant;
		const currentActions = getCombatantCurrentActions(combatantDocument);
		const maxActions = getCombatantMaxActions(combatantDocument);
		const nextActions = resolveNextCombatantActionsForSlot({
			slot,
			currentActions,
			maxActions,
		});
		if (nextActions === currentActions) return;

		try {
			await combat.updateEmbeddedDocuments('Combatant', [
				{
					_id: combatantId,
					[COMBATANT_ACTIONS_CURRENT_PATH]: nextActions,
				},
			]);
			updateCurrentCombat(true);
		} catch (error) {
			console.error('[Nimble][NCCT] Failed to update combatant actions', {
				combatantId,
				nextActions,
				error,
			});
		}
	}

	function getCombatantToken(combatant: Combatant.Implementation): Token | null {
		const tokenId = combatant.tokenId ?? combatant.token?.id ?? combatant.token?._id;
		if (!tokenId) return null;

		const tokenLayer = canvas.tokens;
		if (!tokenLayer) return null;

		const tokenFromLayer = (tokenLayer as unknown as { get?: (id: string) => Token | null }).get?.(
			tokenId,
		);
		if (tokenFromLayer) return tokenFromLayer;

		const tokenFromPlaceables =
			tokenLayer.placeables.find((token) => token.document?.id === tokenId) ?? null;
		if (tokenFromPlaceables) return tokenFromPlaceables;

		return (combatant.token?.object as Token | null) ?? null;
	}

	async function panCanvasToCombatant(combatant: Combatant.Implementation): Promise<void> {
		if (!canvas?.ready) return;
		const token = getCombatantToken(combatant);
		if (!token?.center) return;
		await canvas.animatePan({
			x: token.center.x,
			y: token.center.y,
			scale: canvas.stage?.scale.x ?? 1,
			duration: 450,
		});
	}

	async function pingCombatantToken(combatant: Combatant.Implementation): Promise<void> {
		const combatTrackerApp = ui.combat as unknown as {
			_onPingCombatant?: (targetCombatant: Combatant.Implementation) => Promise<unknown> | unknown;
		};
		if (typeof combatTrackerApp?._onPingCombatant === 'function') {
			try {
				await combatTrackerApp._onPingCombatant(combatant);
				return;
			} catch (_error) {
				// Fall through to direct canvas ping when the combat tracker hook is unavailable.
			}
		}

		if (!canvas?.ready) return;
		const token = getCombatantToken(combatant);
		if (!token?.center) return;

		const controlsLayer = canvas.controls as unknown as {
			ping?: (
				position: { x: number; y: number },
				options?: Record<string, unknown>,
			) => void;
		};
		if (typeof controlsLayer?.ping === 'function') {
			controlsLayer.ping(token.center, {});
			return;
		}

		const canvasWithPing = canvas as unknown as {
			ping?: (
				position: { x: number; y: number },
				options?: Record<string, unknown>,
			) => void;
		};
		if (typeof canvasWithPing.ping === 'function') {
			canvasWithPing.ping(token.center, {});
		}
	}

	function handleCombatantCardClick(event: MouseEvent, combatant: Combatant.Implementation): void {
		event.preventDefault();
		event.stopPropagation();
		void panCanvasToCombatant(combatant);
	}

	function handleCombatantCardContextMenu(
		event: MouseEvent,
		combatant: Combatant.Implementation,
	): void {
		event.preventDefault();
		event.stopPropagation();
		void pingCombatantToken(combatant);
	}

	function handleMonsterStackClick(event: MouseEvent): void {
		event.preventDefault();
		event.stopPropagation();
		const activeMonsterCombatant =
			currentCombat?.combatant && isMonsterOrMinionCombatant(currentCombat.combatant)
				? currentCombat.combatant
				: null;
		const fallbackMonsterCombatant = sceneMonsterAliveCombatants[0] ?? sceneAllMonsterCombatants[0];
		const combatantToPan = activeMonsterCombatant ?? fallbackMonsterCombatant;
		if (!combatantToPan) return;
		void panCanvasToCombatant(combatantToPan);
	}

	function handleMonsterStackContextMenu(event: MouseEvent): void {
		event.preventDefault();
		event.stopPropagation();
		const activeMonsterCombatant =
			currentCombat?.combatant && isMonsterOrMinionCombatant(currentCombat.combatant)
				? currentCombat.combatant
				: null;
		const fallbackMonsterCombatant = sceneMonsterAliveCombatants[0] ?? sceneAllMonsterCombatants[0];
		const combatantToPing = activeMonsterCombatant ?? fallbackMonsterCombatant;
		if (!combatantToPing) return;
		void pingCombatantToken(combatantToPing);
	}

	function handleTrackWheel(event: WheelEvent): void {
		const trackedElement = trackElement;
		if (!trackedElement) return;
		if (trackedElement.scrollWidth <= trackedElement.clientWidth + 1) return;

		let delta =
			Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
		if (event.deltaMode === WheelEvent.DOM_DELTA_LINE) {
			delta *= 16;
		} else if (event.deltaMode === WheelEvent.DOM_DELTA_PAGE) {
			delta *= trackedElement.clientWidth;
		}
		if (Math.abs(delta) < 0.1) return;

		const previousScrollLeft = trackedElement.scrollLeft;
		trackedElement.scrollLeft += delta;
		if (trackedElement.scrollLeft !== previousScrollLeft) {
			updateTrackViewportMetrics();
			event.preventDefault();
			event.stopPropagation();
		}
	}

	function clearDropPreview(): void {
		dragPreview = null;
	}

	function clearDragState(): void {
		activeDragSourceId = null;
		dragHandleArmedCombatantId = null;
		clearDropPreview();
	}

	function handleCombatantCardPointerDown(
		event: PointerEvent,
		combatantId: string,
	): void {
		const target = event.target;
		if (!(target instanceof HTMLElement)) {
			dragHandleArmedCombatantId = null;
			return;
		}
		const handle = target.closest<HTMLElement>('[data-ncct-drag-handle="true"]');
		if (!handle) {
			dragHandleArmedCombatantId = null;
			return;
		}
		const handleCombatantId = handle.dataset.combatantId ?? '';
		dragHandleArmedCombatantId =
			handleCombatantId && handleCombatantId === combatantId ? handleCombatantId : null;
	}

	function getRootFontSizePx(): number {
		const rootFontSize =
			Number.parseFloat(globalThis.getComputedStyle(document.documentElement).fontSize) || 16;
		return Number.isFinite(rootFontSize) && rootFontSize > 0 ? rootFontSize : 16;
	}

	function getEstimatedNcctEntryWidthPx(): number {
		return getRootFontSizePx() * NCCT_ESTIMATED_ENTRY_WIDTH_REM * getNcctCardScale(ncctCardSizeLevel);
	}

	function buildVirtualizedAliveEntries(params: {
		entries: TrackEntry[];
		enabled: boolean;
		scrollLeft: number;
		viewportWidth: number;
	}): VirtualizedAliveEntries {
		const totalEntries = params.entries.length;
		if (!params.enabled || totalEntries < 1) {
			return {
				enabled: false,
				startIndex: 0,
				endIndex: totalEntries,
				leadingWidthPx: 0,
				trailingWidthPx: 0,
				entries: params.entries,
			};
		}

		const estimatedEntryWidthPx = Math.max(1, getEstimatedNcctEntryWidthPx());
		const visibleCount = Math.max(1, Math.ceil(Math.max(estimatedEntryWidthPx, params.viewportWidth) / estimatedEntryWidthPx));
		const firstVisibleIndex = Math.max(0, Math.floor(params.scrollLeft / estimatedEntryWidthPx));
		const startIndex = Math.max(0, firstVisibleIndex - NCCT_VIRTUALIZATION_OVERSCAN);
		const endIndex = Math.min(
			totalEntries,
			firstVisibleIndex + visibleCount + NCCT_VIRTUALIZATION_OVERSCAN,
		);
		return {
			enabled: true,
			startIndex,
			endIndex,
			leadingWidthPx: Math.round(startIndex * estimatedEntryWidthPx),
			trailingWidthPx: Math.round((totalEntries - endIndex) * estimatedEntryWidthPx),
			entries: params.entries.slice(startIndex, endIndex),
		};
	}

	function updateTrackViewportMetrics(): void {
		if (!trackElement) {
			trackScrollLeft = 0;
			trackClientWidth = 0;
			return;
		}
		trackScrollLeft = trackElement.scrollLeft;
		trackClientWidth = trackElement.clientWidth;
	}

	function handleTrackScroll(): void {
		updateTrackViewportMetrics();
	}

	function getDragTargetExpansionPx(): number {
		return getRootFontSizePx() * DRAG_TARGET_EXPANSION_REM;
	}

	function canDragCombatant(combatant: Combatant.Implementation): boolean {
		if (isCombatantDead(combatant)) return false;
		return canCurrentUserReorderCombatant(combatant);
	}

	function getDragPreviewCandidates(source: Combatant.Implementation): Combatant.Implementation[] {
		const sourceId = getCombatantId(source);
		const restrictToPlayers = !game.user?.isGM;
		return sceneAliveCombatants.filter((combatant) => {
			if (getCombatantId(combatant) === sourceId) return false;
			if (isCombatantDead(combatant)) return false;
			return !restrictToPlayers || isPlayerCombatant(combatant);
		});
	}

	function getCombatantTrackCardElement(combatantId: string): HTMLElement | null {
		if (!trackElement || !combatantId) return null;
		return trackElement.querySelector<HTMLElement>(
			`.nimble-ncct__portrait[data-combatant-id="${combatantId}"]`,
		);
	}

	function resolvePreviewBeforeState(relative: number, targetId: string): boolean {
		if (relative <= DRAG_SWITCH_UPPER_RATIO) return true;
		if (relative >= DRAG_SWITCH_LOWER_RATIO) return false;
		if (dragPreview?.targetId === targetId) return dragPreview.before;
		return relative < 0.5;
	}

	function getPreviewTargetFromPointer(
		clientX: number,
		source: Combatant.Implementation,
	): { target: Combatant.Implementation; before: boolean } | null {
		if (!trackElement) return null;

		const candidates = getDragPreviewCandidates(source);
		if (candidates.length < 1) return null;

		const expansionPx = getDragTargetExpansionPx();
		let bestMatch: { target: Combatant.Implementation; rect: DOMRect; targetId: string } | null = null;
		let bestDistance = Number.POSITIVE_INFINITY;

		for (const candidate of candidates) {
			const candidateId = getCombatantId(candidate);
			if (!candidateId) continue;

			const row = getCombatantTrackCardElement(candidateId);
			if (!row) continue;

			const rect = row.getBoundingClientRect();
			const expandedStart = rect.left - expansionPx;
			const expandedEnd = rect.right + expansionPx;

			const distance =
				clientX < expandedStart
					? expandedStart - clientX
					: clientX > expandedEnd
						? clientX - expandedEnd
						: 0;

			if (distance < bestDistance) {
				bestDistance = distance;
				bestMatch = { target: candidate, rect, targetId: candidateId };
			}
		}

		if (!bestMatch) return null;
		const relative = (clientX - bestMatch.rect.left) / Math.max(1, bestMatch.rect.width);
		const before = resolvePreviewBeforeState(relative, bestMatch.targetId);
		return { target: bestMatch.target, before };
	}

	function getDragPreview(event: DragEvent): CombatantDropPreview | null {
		if (!currentCombat) return null;
		if (!activeDragSourceId) return null;

		const source = currentCombat.combatants.get(activeDragSourceId);
		if (!source?.id) return null;
		if (source.parent?.id !== currentCombat.id) return null;
		if (!canDragCombatant(source)) return null;

		const pointerTarget = getPreviewTargetFromPointer(event.clientX, source);
		if (!pointerTarget?.target.id) return null;

		return {
			sourceId: source.id,
			targetId: pointerTarget.target.id,
			before: pointerTarget.before,
		};
	}

	function handleTrackDragOver(event: DragEvent): void {
		event.preventDefault();
		if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';

		const preview = getDragPreview(event);
		if (!preview) {
			clearDropPreview();
			return;
		}

		const isUnchanged =
			dragPreview?.sourceId === preview.sourceId &&
			dragPreview?.targetId === preview.targetId &&
			dragPreview?.before === preview.before;
		if (!isUnchanged) {
			dragPreview = preview;
		}
	}

	function handleCombatantCardDragStart(
		event: DragEvent,
		combatant: Combatant.Implementation,
	): void {
		if (!canDragCombatant(combatant)) {
			event.preventDefault();
			return;
		}

		const combat = (combatant.parent as Combat | null) ?? resolveActionCombat();
		const combatantId = combatant.id ?? '';
		if (!combat || !combatantId) {
			event.preventDefault();
			return;
		}
		if (dragHandleArmedCombatantId !== combatantId) {
			event.preventDefault();
			return;
		}

		const combatantDocument = combat.combatants.get(combatantId) ?? combatant;
		activeDragSourceId = combatantDocument.id ?? null;
		dragHandleArmedCombatantId = null;
		clearDropPreview();

		if (event.dataTransfer) {
			event.dataTransfer.effectAllowed = 'move';
			const dragData =
				typeof combatantDocument.toDragData === 'function'
					? combatantDocument.toDragData()
					: { uuid: combatantDocument.uuid };
			event.dataTransfer.setData('text/plain', JSON.stringify(dragData));
		}
	}

	function handleCombatantCardDragEnd(): void {
		clearDragState();
	}

	async function handleTrackDrop(event: DragEvent): Promise<void> {
		event.preventDefault();

		const combat = resolveActionCombat() as CombatWithDrop | null;
		if (!combat || typeof combat._onDrop !== 'function' || !trackElement) {
			clearDragState();
			return;
		}
		if (!activeDragSourceId || !dragPreview?.targetId) {
			clearDragState();
			return;
		}

		trackElement.dataset.dragSourceId = activeDragSourceId ?? '';
		trackElement.dataset.dropTargetId = dragPreview?.targetId ?? '';
		trackElement.dataset.dropBefore = dragPreview ? String(dragPreview.before) : '';

		try {
			const dropEvent = {
				preventDefault: () => event.preventDefault(),
				target: trackElement,
				currentTarget: trackElement,
				dataTransfer: event.dataTransfer,
				clientX: event.clientX,
				clientY: event.clientY,
				x: event.x,
				y: event.y,
			} as DragEvent & { target: EventTarget & HTMLElement };
			await combat._onDrop(dropEvent);
			updateCurrentCombat(true);
		} finally {
			delete trackElement.dataset.dragSourceId;
			delete trackElement.dataset.dropTargetId;
			delete trackElement.dataset.dropBefore;
			clearDragState();
		}
	}

	async function handleControlAction(event: MouseEvent, action: string): Promise<void> {
		event.preventDefault();
		event.stopPropagation();
		if (action === 'configure') {
			openNcctSettingsDialog();
			return;
		}
		if (!game.user?.isGM) return;

		const actionCombat = resolveActionCombat();
		if (!actionCombat) return;

		try {
			switch (action) {
				case 'roll-all':
					await rollEligibleInitiative(actionCombat);
					return;
				case 'previous-turn':
					logNcctControl('previous-turn requested', {
						combatId: actionCombat.id ?? actionCombat._id ?? null,
						turn: actionCombat.turn ?? null,
						activeCombatantId: getActiveCombatantId(actionCombat),
					});
					await actionCombat.previousTurn();
					logNcctControl('previous-turn completed', {
						combatId: actionCombat.id ?? actionCombat._id ?? null,
						turn: actionCombat.turn ?? null,
						activeCombatantId: getActiveCombatantId(actionCombat),
					});
					updateCurrentCombat(true);
					return;
				case 'previous-round':
					await actionCombat.previousRound();
					updateCurrentCombat(true);
					return;
				case 'start-combat': {
					const combatId = actionCombat.id ?? actionCombat._id ?? null;
					logNcctControl('start-combat requested', {
						combatId,
						sceneId: actionCombat.scene?.id ?? null,
						active: actionCombat.active,
						started: isCombatStarted(actionCombat),
						round: actionCombat.round ?? 0,
						combatants: actionCombat.combatants.size,
					});

					if (actionCombat.combatants.size < 1) {
						ui.notifications?.warn('Add at least one combatant before starting combat.');
						return;
					}

					if (!isCombatRoundStarted(actionCombat)) {
						await actionCombat.startCombat();
					}

					const refreshedCombat =
						combatId && game.combats.get(combatId) ? game.combats.get(combatId) : actionCombat;
					preferredCombatId = combatId;
					currentCombat = refreshedCombat ?? actionCombat;
					renderVersion += 1;
					logNcctControl('start-combat completed', {
						combatId,
						active: refreshedCombat?.active ?? false,
						started: isCombatStarted(refreshedCombat ?? null),
						round: refreshedCombat?.round ?? 0,
					});

					if (!isCombatStarted(refreshedCombat ?? null)) {
						ui.notifications?.warn('Combat did not enter Round 1. Check the browser console logs.');
					}

					ui.combat?.render(true);
					updateCurrentCombat(true);
					return;
				}
				case 'end-combat': {
					const combatId = actionCombat.id ?? actionCombat._id ?? null;
					logNcctControl('end-combat requested', {
						combatId,
						active: actionCombat.active,
						started: isCombatStarted(actionCombat),
						round: actionCombat.round ?? 0,
					});
					const confirmed = await confirmEndEncounter();
					if (!confirmed) return;
					await actionCombat.delete();
					if (preferredCombatId === combatId) preferredCombatId = null;
					ui.combat?.render(true);
					updateCurrentCombat(true);
					return;
				}
				case 'next-turn':
					logNcctControl('next-turn requested', {
						combatId: actionCombat.id ?? actionCombat._id ?? null,
						turn: actionCombat.turn ?? null,
						activeCombatantId: getActiveCombatantId(actionCombat),
					});
					await actionCombat.nextTurn();
					logNcctControl('next-turn completed', {
						combatId: actionCombat.id ?? actionCombat._id ?? null,
						turn: actionCombat.turn ?? null,
						activeCombatantId: getActiveCombatantId(actionCombat),
					});
					updateCurrentCombat(true);
					return;
				case 'next-round':
					await actionCombat.nextRound();
					updateCurrentCombat(true);
					return;
				default:
					return;
			}
		} catch (error) {
			console.error('[Nimble][NCCT] Combat control action failed', { action, error });
			const errorMessage = error instanceof Error ? error.message : String(error);
			ui.notifications?.error(`Unable to run combat control action: ${errorMessage}`);
		}
	}

	function getCombatantImageForDisplay(combatant: Combatant.Implementation): string {
		return (
			getCombatantImage(combatant, {
				includeActorImage: true,
				fallback: PORTRAIT_FALLBACK_IMAGE,
			}) ?? PORTRAIT_FALLBACK_IMAGE
		);
	}

	let currentCombat: Combat | null = $state(null);
	let sceneAliveCombatants: Combatant.Implementation[] = $state([]);
	let sceneDeadCombatants: Combatant.Implementation[] = $state([]);
	let playersCanExpandMonsterCards = $state(getCombatTrackerPlayersCanExpandMonsterCards());
	let centerActiveCardEnabled = $state(getCombatTrackerCenterActiveCardEnabled());
	let ncctEnabled = $state(getCombatTrackerNcctEnabled());
	let ncctWidthLevel = $state(getCombatTrackerNcctWidthLevel());
	let ncctCardSizeLevel = $state(getCombatTrackerNcctCardSizeLevel());
	let canCurrentUserViewNonPlayerHitpoints = $state(canCurrentUserDisplayNonPlayerHitpointsOnCards());
	let monsterCardsExpanded = $state(false);
	let topOffsetPx = $state(MIN_TOP_OFFSET_PX);
	let layoutVersion = $state(0);
	let viewportElement: HTMLDivElement | null = $state(null);
	let trackElement: HTMLOListElement | null = $state(null);
	let trackScrollLeft = $state(0);
	let trackClientWidth = $state(0);
	let activeDragSourceId: string | null = $state(null);
	let dragHandleArmedCombatantId: string | null = $state(null);
	let dragPreview: CombatantDropPreview | null = $state(null);
	let renderVersion = $state(0);
	let lastCombatSignature = $state('');

	let sceneMonsterAliveCombatants = $derived(
		sceneAliveCombatants.filter((combatant) => isMonsterOrMinionCombatant(combatant)),
	);
	let sceneMonsterDeadCombatants = $derived(
		sceneDeadCombatants.filter((combatant) => isMonsterOrMinionCombatant(combatant)),
	);
	let sceneAllMonsterCombatants = $derived([
		...sceneMonsterAliveCombatants,
		...sceneMonsterDeadCombatants,
	]);
	let hasMonsterCombatants = $derived(sceneAllMonsterCombatants.length > 0);
	let canCurrentUserExpandMonsterCards = $derived(
		Boolean(game.user?.isGM) || playersCanExpandMonsterCards,
	);
	let shouldCollapseMonsterCards = $derived(hasMonsterCombatants && !monsterCardsExpanded);
	let renderedDeadCombatants = $derived(
		shouldCollapseMonsterCards
			? sceneDeadCombatants.filter((combatant) => !isMonsterOrMinionCombatant(combatant))
			: sceneDeadCombatants,
	);
	let aliveEntries = $derived.by(() =>
		buildAliveEntries(sceneAliveCombatants, shouldCollapseMonsterCards, hasMonsterCombatants),
	);
	let activeCombatantId = $derived.by(() => {
		renderVersion;
		return getActiveCombatantId(currentCombat);
	});
	let activeCombatant = $derived.by(() => {
		renderVersion;
		return getActiveCombatant(currentCombat);
	});
	let canCurrentUserEndTurn = $derived.by(() => canCurrentUserEndCombatantTurn(activeCombatant));
	let activeEntryKey = $derived.by(() => {
		const activeOccurrence = getActiveCombatantOccurrence(currentCombat, activeCombatantId);
		return resolveActiveEntryKey({
			activeCombatantId,
			activeOccurrence,
			aliveEntries,
			collapseMonsters: shouldCollapseMonsterCards,
			monsterCombatants: sceneAllMonsterCombatants,
		});
	});
	let orderedAliveEntries = $derived.by(() =>
		orderEntriesForCenteredActive(aliveEntries, activeEntryKey, centerActiveCardEnabled),
	);
	let shouldVirtualizeAliveEntries = $derived(
		orderedAliveEntries.length >= NCCT_VIRTUALIZATION_ENTRY_THRESHOLD,
	);
	let virtualizedAliveEntries = $derived.by(() =>
		buildVirtualizedAliveEntries({
			entries: orderedAliveEntries,
			enabled: shouldVirtualizeAliveEntries,
			scrollLeft: trackScrollLeft,
			viewportWidth: trackClientWidth,
		}),
	);
	let roundBoundaryKey = $derived.by(() =>
		getRoundBoundaryKey(sceneAliveCombatants, shouldCollapseMonsterCards),
	);
	let roundSeparatorIndex = $derived.by(() =>
		getRoundSeparatorInsertionIndex(orderedAliveEntries, roundBoundaryKey),
	);
	let combatStarted = $derived.by(() => {
		renderVersion;
		return isCombatStarted(currentCombat);
	});
	let currentRoundLabel = $derived.by(() => {
		renderVersion;
		return Math.max(1, currentCombat?.round ?? 1);
	});
	let ncctTrackMaxWidth = $derived.by(() => {
		layoutVersion;
		return resolveNcctTrackMaxWidth(ncctWidthLevel);
	});
	let ncctCardScale = $derived.by(() => getNcctCardScale(ncctCardSizeLevel));

	let createCombatHook: number | undefined;
	let updateCombatHook: number | undefined;
	let deleteCombatHook: number | undefined;
	let createCombatantHook: number | undefined;
	let updateCombatantHook: number | undefined;
	let deleteCombatantHook: number | undefined;
	let canvasReadyHook: number | undefined;
	let updateSceneHook: number | undefined;
	let updateActorHook: number | undefined;
	let renderSceneNavigationHook: number | undefined;
	let combatStartHook: number | undefined;
	let combatTurnHook: number | undefined;
	let combatRoundHook: number | undefined;
	let updateSettingHook: number | undefined;
	let resizeListener: (() => void) | undefined;

	onMount(() => {
		updateTopOffset();
		updatePlayerMonsterExpansionPermission();
		updateNonPlayerHitpointPermission();
		updateCurrentCombat(true);
		queueMicrotask(() => {
			updateTrackViewportMetrics();
		});

		resizeListener = () => {
			updateTopOffset();
			updateTrackViewportMetrics();
			layoutVersion += 1;
		};
		window.addEventListener('resize', resizeListener);

		createCombatHook = Hooks.on('createCombat', () => updateCurrentCombat(true));
		updateCombatHook = Hooks.on('updateCombat', () => updateCurrentCombat(true));
		deleteCombatHook = Hooks.on('deleteCombat', () => updateCurrentCombat(true));
		createCombatantHook = Hooks.on('createCombatant', () => updateCurrentCombat(true));
		updateCombatantHook = Hooks.on('updateCombatant', () => updateCurrentCombat(true));
		deleteCombatantHook = Hooks.on('deleteCombatant', () => updateCurrentCombat(true));
		updateActorHook = Hooks.on('updateActor', () => updateCurrentCombat(true));
		canvasReadyHook = Hooks.on('canvasReady', () => updateCurrentCombat(true));
		updateSceneHook = Hooks.on('updateScene', () => updateCurrentCombat(true));
		renderSceneNavigationHook = Hooks.on('renderSceneNavigation', () => {
			updateTopOffset();
			layoutVersion += 1;
			updateCurrentCombat(true);
		});
		combatStartHook = Hooks.on('combatStart', () => updateCurrentCombat(true));
		combatTurnHook = Hooks.on('combatTurn', () => updateCurrentCombat(true));
		combatRoundHook = Hooks.on('combatRound', () => updateCurrentCombat(true));
		updateSettingHook = Hooks.on('updateSetting', (setting) => {
			const settingKey = foundry.utils.getProperty(setting, 'key');
			if (isCombatTrackerPlayerMonsterExpansionSettingKey(settingKey)) {
				updatePlayerMonsterExpansionPermission();
			}
			if (isCombatTrackerCenterActiveCardSettingKey(settingKey)) {
				centerActiveCardEnabled = getCombatTrackerCenterActiveCardEnabled();
			}
			if (isCombatTrackerEnabledSettingKey(settingKey)) {
				ncctEnabled = getCombatTrackerNcctEnabled();
			}
			if (isCombatTrackerWidthLevelSettingKey(settingKey)) {
				ncctWidthLevel = getCombatTrackerNcctWidthLevel();
				layoutVersion += 1;
			}
			if (isCombatTrackerCardSizeLevelSettingKey(settingKey)) {
				ncctCardSizeLevel = getCombatTrackerNcctCardSizeLevel();
				layoutVersion += 1;
				void centerActiveEntryInView(activeEntryKey);
			}
			if (isCombatTrackerNonPlayerHitpointPermissionSettingKey(settingKey)) {
				updateNonPlayerHitpointPermission();
			}
		});
	});

	onDestroy(() => {
		if (resizeListener) window.removeEventListener('resize', resizeListener);
		if (createCombatHook !== undefined) Hooks.off('createCombat', createCombatHook);
		if (updateCombatHook !== undefined) Hooks.off('updateCombat', updateCombatHook);
		if (deleteCombatHook !== undefined) Hooks.off('deleteCombat', deleteCombatHook);
		if (createCombatantHook !== undefined) Hooks.off('createCombatant', createCombatantHook);
		if (updateCombatantHook !== undefined) Hooks.off('updateCombatant', updateCombatantHook);
		if (deleteCombatantHook !== undefined) Hooks.off('deleteCombatant', deleteCombatantHook);
		if (updateActorHook !== undefined) Hooks.off('updateActor', updateActorHook);
		if (canvasReadyHook !== undefined) Hooks.off('canvasReady', canvasReadyHook);
		if (updateSceneHook !== undefined) Hooks.off('updateScene', updateSceneHook);
		if (renderSceneNavigationHook !== undefined)
			Hooks.off('renderSceneNavigation', renderSceneNavigationHook);
		if (combatStartHook !== undefined) Hooks.off('combatStart', combatStartHook);
		if (combatTurnHook !== undefined) Hooks.off('combatTurn', combatTurnHook);
		if (combatRoundHook !== undefined) Hooks.off('combatRound', combatRoundHook);
		if (updateSettingHook !== undefined) Hooks.off('updateSetting', updateSettingHook);
	});

	$effect(() => {
		centerActiveCardEnabled;
		void centerActiveEntryInView(activeEntryKey);
	});

	$effect(() => {
		orderedAliveEntries.length;
		layoutVersion;
		void tick().then(() => {
			updateTrackViewportMetrics();
		});
	});

	$effect(() => {
		if (canCurrentUserExpandMonsterCards) return;
		if (monsterCardsExpanded) monsterCardsExpanded = false;
	});

	$effect(() => {
		if (hasMonsterCombatants) return;
		if (monsterCardsExpanded) monsterCardsExpanded = false;
	});
</script>

{#if ncctEnabled && currentCombat}
	<section
		class="nimble-ncct-shell"
		style={`top: ${topOffsetPx}px; --nimble-ncct-track-max-width: ${ncctTrackMaxWidth}; --nimble-ncct-card-scale: ${ncctCardScale};`}
		in:fade={{ duration: 120 }}
	>
		<div class="nimble-ncct">
			{#if game.user?.isGM || (hasMonsterCombatants && canCurrentUserExpandMonsterCards)}
				<div class="nimble-ncct__controls" aria-label="Combat controls left">
					{#if hasMonsterCombatants && canCurrentUserExpandMonsterCards}
						<button
							class="nimble-ncct__icon-button"
							aria-label={monsterCardsExpanded ? 'Collapse Monsters' : 'Expand Monsters'}
							data-tooltip={monsterCardsExpanded ? 'Collapse Monsters' : 'Expand Monsters'}
							onclick={toggleMonsterCardExpansion}
						>
							<i class={`fa-solid ${monsterCardsExpanded ? 'fa-compress' : 'fa-expand'}`}></i>
						</button>
					{/if}
					{#if game.user?.isGM}
						<button
							class="nimble-ncct__icon-button"
							aria-label="Roll Initiative"
							data-tooltip="Roll Initiative"
							onclick={(event) => handleControlAction(event, 'roll-all')}
							><i class="fa-solid fa-users"></i></button
						>
						<button
							class="nimble-ncct__icon-button"
							aria-label="Previous Turn"
							data-tooltip="Previous Turn"
							onclick={(event) => handleControlAction(event, 'previous-turn')}
							><i class="fa-solid fa-chevron-left"></i></button
						>
						<button
							class="nimble-ncct__icon-button"
							aria-label="Previous Round"
							data-tooltip="Previous Round"
							onclick={(event) => handleControlAction(event, 'previous-round')}
							><i class="fa-solid fa-chevrons-left"></i></button
						>
					{/if}
				</div>
			{/if}

			<div class="nimble-ncct__viewport" bind:this={viewportElement}>
				<ol
					class="nimble-ncct__track"
					bind:this={trackElement}
					id="combatants"
					data-nimble-combat-drop-target="true"
					data-drag-source-id={activeDragSourceId ?? ''}
					data-drop-target-id={dragPreview?.targetId ?? ''}
					data-drop-before={dragPreview ? String(dragPreview.before) : ''}
					ondragover={handleTrackDragOver}
					ondrop={(event) => {
						void handleTrackDrop(event);
					}}
					onwheel={handleTrackWheel}
					onscroll={handleTrackScroll}
				>
					{#if virtualizedAliveEntries.leadingWidthPx > 0}
						<li
							class="nimble-ncct__virtual-spacer"
							aria-hidden="true"
							style={`width: ${virtualizedAliveEntries.leadingWidthPx}px;`}
						></li>
					{/if}
					{#each virtualizedAliveEntries.entries as entry, localIndex (entry.key)}
						{@const index = virtualizedAliveEntries.startIndex + localIndex}
						{#if combatStarted && roundSeparatorIndex === index}
							<li class="nimble-ncct__round-separator" data-tooltip="Current Round">
								<span class="nimble-ncct__round-separator-line"></span>
								<span class="nimble-ncct__round-separator-round"
									><i class="fa-solid fa-angle-right"></i>{currentRoundLabel}</span
								>
							</li>
						{/if}
						{#if entry.kind === 'combatant' && entry.combatant}
							{@const actionState = getActionState(entry.combatant)}
							{@const combatantId = getCombatantId(entry.combatant)}
							{@const canDragEntry = canDragCombatant(entry.combatant)}
							<li
								class="nimble-ncct__portrait"
								class:nimble-ncct__portrait--active={activeEntryKey === entry.key}
								class:nimble-ncct__portrait--dead={entry.combatant.defeated}
								class:nimble-ncct__portrait--draggable={canDragEntry}
								class:nimble-ncct__portrait--preview-gap-before={dragPreview?.targetId ===
									combatantId && dragPreview.before}
								class:nimble-ncct__portrait--preview-gap-after={dragPreview?.targetId ===
									combatantId && !dragPreview.before}
								data-track-key={entry.key}
								data-combatant-id={combatantId}
								data-tooltip={getCombatantDisplayName(entry.combatant)}
								onclick={(event) => handleCombatantCardClick(event, entry.combatant)}
								oncontextmenu={(event) => handleCombatantCardContextMenu(event, entry.combatant)}
								onpointerdown={(event) => handleCombatantCardPointerDown(event, combatantId)}
								draggable={canDragEntry}
								ondragstart={(event) => handleCombatantCardDragStart(event, entry.combatant)}
								ondragend={handleCombatantCardDragEnd}
							>
								<img
									class="nimble-ncct__image"
									src={getCombatantImageForDisplay(entry.combatant)}
									alt="Combatant portrait"
									draggable="false"
								/>
								{#if canDragEntry}
									<div
										class="nimble-ncct__drag-handle"
										data-ncct-drag-handle="true"
										data-combatant-id={combatantId}
									></div>
								{/if}
								{#if shouldRenderHpBadge(entry.combatant)}
									<span
										class={`nimble-ncct__badge nimble-ncct__badge--hp ${getCombatantHpBadgeClass(entry.combatant)}`}
									>{getCombatantHpText(entry.combatant)}</span>
								{/if}
								{#if shouldShowInitiativePromptForCombatant(entry.combatant)}
									<button
										class="nimble-ncct__initiative-roll"
										type="button"
										aria-label="Roll Initiative"
										data-tooltip="Roll Initiative"
										disabled={!canCurrentUserRollInitiativeForCombatant(entry.combatant)}
										onclick={(event) => {
											void handleCombatantInitiativeRoll(event, entry.combatant);
										}}
									>
										<i class="fa-solid fa-dice-d20"></i>
									</button>
								{/if}
								<div class="nimble-ncct__pips">
									{#each actionState.slots as slot}
										<button
											type="button"
											class="nimble-ncct__action-die-button"
											aria-label={`Set actions to ${slot + 1}`}
											data-tooltip={`Set actions to ${slot + 1}`}
											disabled={!canCurrentUserAdjustCombatantActions(entry.combatant)}
											onclick={(event) => {
												void handleActionDieClick(event, entry.combatant, slot);
											}}
										>
											<i
												class={`${getActionDiceIconClass(slot)} ${slot < actionState.current ? 'nimble-ncct__action-die--active' : 'nimble-ncct__action-die--spent'}`}
											></i>
										</button>
									{/each}
									{#if actionState.overflow > 0}<span>+{actionState.overflow}</span>{/if}
								</div>
								{#if combatStarted && activeEntryKey === entry.key && canCurrentUserEndTurn}
									<button
										class="nimble-ncct__end-turn-overlay"
										type="button"
										aria-label="End Turn"
										data-tooltip="End Turn"
										onclick={handleEndTurnFromCard}
									>
										End Turn
									</button>
								{/if}
							</li>
						{:else}
							<li
								class="nimble-ncct__portrait nimble-ncct__portrait--monster"
								class:nimble-ncct__portrait--active={activeEntryKey === entry.key}
								data-track-key={entry.key}
								data-tooltip="Monsters and Minions"
								onclick={handleMonsterStackClick}
								oncontextmenu={handleMonsterStackContextMenu}
							>
								<span class="nimble-ncct__monster-stack-icon" aria-hidden="true">
									<i class="fa-solid fa-dragon"></i>
								</span>
								<span class="nimble-ncct__badge">x{sceneAllMonsterCombatants.length}</span>
								{#if combatStarted && activeEntryKey === entry.key && canCurrentUserEndTurn}
									<button
										class="nimble-ncct__end-turn-overlay"
										type="button"
										aria-label="End Turn"
										data-tooltip="End Turn"
										onclick={handleEndTurnFromCard}
									>
										End Turn
									</button>
								{/if}
							</li>
						{/if}
					{/each}
					{#if combatStarted && orderedAliveEntries.length > 0 && roundSeparatorIndex < 0}
						<li class="nimble-ncct__round-separator" data-tooltip="Current Round">
							<span class="nimble-ncct__round-separator-line"></span>
							<span class="nimble-ncct__round-separator-round"
								><i class="fa-solid fa-angle-right"></i>{currentRoundLabel}</span
							>
						</li>
					{/if}
					{#if virtualizedAliveEntries.trailingWidthPx > 0}
						<li
							class="nimble-ncct__virtual-spacer"
							aria-hidden="true"
							style={`width: ${virtualizedAliveEntries.trailingWidthPx}px;`}
						></li>
					{/if}

					{#if renderedDeadCombatants.length > 0}
						<li class="nimble-ncct__dead">Dead</li>
						{#each renderedDeadCombatants as combatant (combatant._id)}
							{@const actionState = getActionState(combatant)}
							<li
								class="nimble-ncct__portrait nimble-ncct__portrait--dead"
								data-track-key={`dead-${getCombatantId(combatant)}`}
								data-tooltip={getCombatantDisplayName(combatant)}
								onclick={(event) => handleCombatantCardClick(event, combatant)}
								oncontextmenu={(event) => handleCombatantCardContextMenu(event, combatant)}
							>
								<img
									class="nimble-ncct__image"
									src={getCombatantImageForDisplay(combatant)}
									alt="Dead combatant portrait"
									draggable="false"
								/>
								{#if shouldRenderHpBadge(combatant)}
									<span
										class={`nimble-ncct__badge nimble-ncct__badge--hp ${getCombatantHpBadgeClass(combatant)}`}
									>{getCombatantHpText(combatant)}</span>
								{/if}
								<div class="nimble-ncct__pips">
									{#each actionState.slots as slot}
										<button
											type="button"
											class="nimble-ncct__action-die-button"
											aria-label={`Set actions to ${slot + 1}`}
											data-tooltip={`Set actions to ${slot + 1}`}
											disabled={!canCurrentUserAdjustCombatantActions(combatant)}
											onclick={(event) => {
												void handleActionDieClick(event, combatant, slot);
											}}
										>
											<i
												class={`${getActionDiceIconClass(slot)} ${slot < actionState.current ? 'nimble-ncct__action-die--active' : 'nimble-ncct__action-die--spent'}`}
											></i>
										</button>
									{/each}
									{#if actionState.overflow > 0}<span>+{actionState.overflow}</span>{/if}
								</div>
							</li>
						{/each}
					{/if}
				</ol>
			</div>

			{#if game.user}
				<div class="nimble-ncct__controls" aria-label="Combat controls right">
					{#if game.user?.isGM}
						<button
							class="nimble-ncct__icon-button"
							aria-label="Start Combat"
							data-tooltip="Start Combat"
							style={combatStarted ? 'display: none;' : ''}
							onclick={(event) => handleControlAction(event, 'start-combat')}
							><i class="fa-solid fa-play"></i></button
						>
						<button
							class="nimble-ncct__icon-button"
							aria-label="End Combat"
							data-tooltip="End Combat"
							style={!combatStarted ? 'display: none;' : ''}
							onclick={(event) => handleControlAction(event, 'end-combat')}
							><i class="fa-solid fa-ban"></i></button
						>
					{/if}
					<button
						class="nimble-ncct__icon-button"
						aria-label="Combat Settings"
						data-tooltip="Combat Settings"
						onclick={(event) => handleControlAction(event, 'configure')}
						><i class="fa-solid fa-gear"></i></button
					>
					{#if game.user?.isGM}
						<button
							class="nimble-ncct__icon-button"
							aria-label="Next Turn"
							data-tooltip="Next Turn"
							onclick={(event) => handleControlAction(event, 'next-turn')}
							><i class="fa-solid fa-chevron-right"></i></button
						>
						<button
							class="nimble-ncct__icon-button"
							aria-label="Next Round"
							data-tooltip="Next Round"
							onclick={(event) => handleControlAction(event, 'next-round')}
							><i class="fa-solid fa-chevrons-right"></i></button
						>
					{/if}
				</div>
			{/if}
		</div>
	</section>
{/if}

<style lang="scss">
	.nimble-ncct-shell {
		position: fixed;
		left: 0;
		right: 0;
		width: 100vw;
		display: flex;
		justify-content: center;
		z-index: 110;
		pointer-events: none;
	}
	.nimble-ncct {
		--nimble-ncct-hover-hitbox-inline: 0.45rem;
		pointer-events: auto;
		display: grid;
		grid-template-columns: auto auto auto;
		gap: 0.2rem;
		align-items: start;
		justify-content: center;
		width: fit-content;
		max-width: calc(var(--nimble-ncct-track-max-width) + 7rem);
		/* Extend hover/focus activation zone slightly past side control bars. */
		padding-inline: var(--nimble-ncct-hover-hitbox-inline);
		margin-inline: calc(var(--nimble-ncct-hover-hitbox-inline) * -1);
	}
	.nimble-ncct__controls {
		pointer-events: none;
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
		padding: 0.2rem;
		border: 1px solid color-mix(in srgb, hsl(41 18% 54%) 60%, transparent);
		border-radius: 0.2rem;
		background: color-mix(in srgb, hsl(226 27% 8%) 86%, transparent);
		opacity: 0;
		visibility: hidden;
		transition:
			opacity 120ms ease,
			visibility 0s linear 120ms;
	}
	.nimble-ncct:hover .nimble-ncct__controls,
	.nimble-ncct:focus-within .nimble-ncct__controls {
		pointer-events: all;
		opacity: 1;
		visibility: visible;
		transition: opacity 120ms ease;
	}
	.nimble-ncct__icon-button {
		width: 1.55rem;
		height: 1.55rem;
		margin: 0;
		padding: 0;
		font-size: 0.78rem;
		color: hsl(0 0% 93%);
		background: color-mix(in srgb, hsl(226 17% 16%) 92%, transparent);
		border: 1px solid color-mix(in srgb, hsl(38 24% 58%) 62%, transparent);
		border-radius: 0.2rem;
		cursor: pointer;
	}
	.nimble-ncct__icon-button:hover,
	.nimble-ncct__icon-button:focus-visible {
		color: hsl(36 92% 86%);
		border-color: color-mix(in srgb, hsl(36 90% 84%) 75%, white);
		background: color-mix(in srgb, hsl(225 16% 23%) 90%, transparent);
	}
	.nimble-ncct__icon-button:disabled {
		opacity: 0.45;
		cursor: not-allowed;
	}
	.nimble-ncct__viewport {
		position: relative;
		width: fit-content;
		max-width: var(--nimble-ncct-track-max-width);
		min-width: 0;
	}
	.nimble-ncct__track {
		pointer-events: all;
		display: flex;
		align-items: flex-start;
		justify-content: flex-start;
		gap: 0.28rem;
		margin: 0;
		padding: 0 0.45rem 0.2rem;
		list-style: none;
		width: fit-content;
		max-width: var(--nimble-ncct-track-max-width);
		min-width: 0;
		overflow-x: auto;
		overflow-y: hidden;
		scrollbar-width: none;
	}
	.nimble-ncct__track::-webkit-scrollbar {
		height: 0;
	}
	.nimble-ncct:hover .nimble-ncct__track,
	.nimble-ncct:focus-within .nimble-ncct__track {
		scrollbar-width: thin;
	}
	.nimble-ncct:hover .nimble-ncct__track::-webkit-scrollbar,
	.nimble-ncct:focus-within .nimble-ncct__track::-webkit-scrollbar {
		height: 0.44rem;
	}
	.nimble-ncct__track::-webkit-scrollbar-thumb {
		background: color-mix(in srgb, hsl(0 0% 93%) 38%, transparent);
		border-radius: 999px;
	}
	.nimble-ncct__track::-webkit-scrollbar-track {
		background: transparent;
	}
	.nimble-ncct__virtual-spacer {
		flex: 0 0 auto;
		height: 0.1rem;
		pointer-events: none;
	}
	.nimble-ncct__portrait {
		position: relative;
		flex: 0 0 auto;
		width: calc(6.25rem * var(--nimble-ncct-card-scale, 1));
		height: calc(9.4rem * var(--nimble-ncct-card-scale, 1));
		border: 1px solid color-mix(in srgb, hsl(0 0% 96%) 38%, transparent);
		border-top-width: 0;
		border-radius: 0 0 0.36rem 0.36rem;
		overflow: hidden;
		background: color-mix(in srgb, hsl(226 26% 8%) 90%, transparent);
		transition:
			width 140ms ease,
			height 140ms ease,
			margin 140ms ease,
			border-color 140ms ease,
			box-shadow 140ms ease,
			opacity 140ms ease;
	}
	.nimble-ncct__portrait--draggable {
		cursor: grab;
	}
	.nimble-ncct__portrait--draggable .nimble-ncct__drag-handle {
		cursor: grab;
	}
	.nimble-ncct__portrait--draggable:active {
		cursor: grabbing;
	}
	.nimble-ncct__portrait--draggable:active .nimble-ncct__drag-handle {
		cursor: grabbing;
	}
	.nimble-ncct__portrait--preview-gap-before {
		margin-inline-start: 0.95rem;
	}
	.nimble-ncct__portrait--preview-gap-after {
		margin-inline-end: 0.95rem;
	}
	.nimble-ncct__portrait--active {
		width: calc(7.5rem * var(--nimble-ncct-card-scale, 1));
		height: calc(11.2rem * var(--nimble-ncct-card-scale, 1));
		border-color: color-mix(in srgb, hsl(0 0% 96%) 68%, transparent);
		box-shadow: 0 0 0.7rem color-mix(in srgb, hsl(0 0% 98%) 33%, transparent);
	}
	.nimble-ncct__portrait--dead {
		opacity: 0.46;
	}
	.nimble-ncct__portrait--dead .nimble-ncct__image {
		filter: grayscale(1) contrast(1.1);
	}
	.nimble-ncct__image {
		display: block;
		width: 100%;
		height: 100%;
		object-fit: cover;
		user-select: none;
		pointer-events: none;
	}
	.nimble-ncct__drag-handle {
		position: absolute;
		inset: 0 0 2.5rem;
		z-index: 2;
	}
	.nimble-ncct__portrait--monster {
		display: flex;
		align-items: center;
		justify-content: center;
		background:
			radial-gradient(
				circle at 50% 34%,
				color-mix(in srgb, hsl(48 92% 66%) 30%, transparent) 0%,
				transparent 62%
			),
			linear-gradient(
				165deg,
				color-mix(in srgb, hsl(228 45% 10%) 92%, black 8%) 0%,
				color-mix(in srgb, hsl(222 36% 8%) 92%, black 8%) 100%
			);
	}
	.nimble-ncct__monster-stack-icon {
		position: relative;
		z-index: 1;
		width: 3.85rem;
		height: 3.85rem;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		color: hsl(44 96% 86%);
		background: color-mix(in srgb, hsl(224 44% 11%) 88%, black 12%);
		border: 1px solid color-mix(in srgb, hsl(44 82% 74%) 68%, white 12%);
		border-radius: 50%;
		box-shadow:
			0 0 0.9rem color-mix(in srgb, hsl(42 92% 66%) 34%, transparent),
			inset 0 0 0.7rem color-mix(in srgb, hsl(226 64% 6%) 78%, transparent);
		pointer-events: none;
	}
	.nimble-ncct__monster-stack-icon i {
		font-size: 2rem;
		line-height: 1;
	}
	.nimble-ncct__portrait--active .nimble-ncct__monster-stack-icon {
		width: 4.35rem;
		height: 4.35rem;
	}
	.nimble-ncct__portrait--active .nimble-ncct__monster-stack-icon i {
		font-size: 2.25rem;
	}
	.nimble-ncct__badge {
		position: absolute;
		top: 0.14rem;
		left: 0.16rem;
		min-width: 1.32rem;
		height: 0.92rem;
		padding-inline: 0.2rem;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		font-size: 0.7rem;
		font-weight: 700;
		color: hsl(0 0% 96%);
		text-shadow: 0 0 0.28rem color-mix(in srgb, black 80%, transparent);
		background: color-mix(in srgb, hsl(220 54% 16%) 75%, transparent);
		border-radius: 0.24rem;
	}
	.nimble-ncct__badge--hp {
		background: color-mix(in srgb, hsl(220 54% 16%) 90%, black 10%);
		border: 1px solid color-mix(in srgb, hsl(218 35% 63%) 62%, white 10%);
		box-shadow: 0 0 0.26rem color-mix(in srgb, hsl(217 36% 52%) 30%, transparent);
	}
	.nimble-ncct__badge--hp-green {
		background: linear-gradient(
			180deg,
			color-mix(in srgb, hsl(131 70% 46%) 90%, black 8%) 0%,
			color-mix(in srgb, hsl(126 55% 26%) 92%, black 12%) 100%
		);
		border: 1px solid color-mix(in srgb, hsl(124 60% 72%) 75%, white 12%);
		box-shadow: 0 0 0.32rem color-mix(in srgb, hsl(126 68% 52%) 40%, transparent);
	}
	.nimble-ncct__badge--hp-yellow {
		color: hsl(42 68% 14%);
		text-shadow: 0 0 0.2rem color-mix(in srgb, hsl(0 0% 100%) 22%, transparent);
		background: linear-gradient(
			180deg,
			color-mix(in srgb, hsl(49 98% 66%) 94%, white 6%) 0%,
			color-mix(in srgb, hsl(44 84% 52%) 90%, black 10%) 100%
		);
		border: 1px solid color-mix(in srgb, hsl(50 94% 76%) 70%, white 8%);
		box-shadow: 0 0 0.32rem color-mix(in srgb, hsl(48 90% 56%) 44%, transparent);
	}
	.nimble-ncct__badge--hp-red {
		background: linear-gradient(
			180deg,
			color-mix(in srgb, hsl(3 88% 58%) 92%, white 8%) 0%,
			color-mix(in srgb, hsl(0 74% 38%) 92%, black 8%) 100%
		);
		border: 1px solid color-mix(in srgb, hsl(2 95% 76%) 74%, white 8%);
		box-shadow: 0 0 0.32rem color-mix(in srgb, hsl(1 92% 56%) 44%, transparent);
	}
	.nimble-ncct__badge--hp-unknown {
		background: color-mix(in srgb, hsl(220 54% 16%) 90%, black 10%);
		border: 1px solid color-mix(in srgb, hsl(218 35% 63%) 62%, white 10%);
		box-shadow: 0 0 0.26rem color-mix(in srgb, hsl(217 36% 52%) 30%, transparent);
	}
	.nimble-ncct__initiative-roll {
		position: absolute;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		width: 1.9rem;
		height: 1.9rem;
		margin: 0;
		padding: 0;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		font-size: 1rem;
		color: hsl(36 94% 86%);
		background: color-mix(in srgb, hsl(230 24% 12%) 90%, black 10%);
		border: 1px solid color-mix(in srgb, hsl(42 78% 72%) 75%, white 10%);
		border-radius: 50%;
		box-shadow: 0 0 0.55rem color-mix(in srgb, hsl(41 84% 66%) 46%, transparent);
		cursor: pointer;
		z-index: 4;
	}
	.nimble-ncct__initiative-roll:hover,
	.nimble-ncct__initiative-roll:focus-visible {
		color: hsl(42 97% 91%);
		filter: brightness(1.08);
	}
	.nimble-ncct__initiative-roll:disabled {
		opacity: 0.45;
		cursor: not-allowed;
	}
	.nimble-ncct__pips {
		position: absolute;
		inset-inline: 0;
		bottom: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.16rem;
		min-height: 0.9rem;
		padding: 0.14rem 0.18rem 0.18rem;
		font-size: 0.58rem;
		color: hsl(36 87% 84%);
		background: linear-gradient(
			to top,
			color-mix(in srgb, hsl(226 26% 8%) 88%, transparent) 0%,
			transparent 100%
		);
		z-index: 3;
	}
	.nimble-ncct__action-die-button {
		all: unset;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
	}
	.nimble-ncct__action-die-button:disabled {
		cursor: default;
		opacity: 0.6;
	}
	.nimble-ncct__pips i {
		font-size: 1.74rem;
		line-height: 1;
		filter: drop-shadow(0 0 0.12rem color-mix(in srgb, black 70%, transparent));
	}
	.nimble-ncct__action-die--active {
		color: var(--nimble-ncct-action-die-color, hsl(124 72% 68%));
		opacity: 1;
	}
	.nimble-ncct__action-die--spent {
		color: color-mix(
			in srgb,
			var(--nimble-ncct-action-die-color, hsl(124 58% 56%)) 44%,
			hsl(138 18% 22%) 56%
		);
		opacity: 0.45;
	}
	.nimble-ncct__pips span {
		font-size: 0.46rem;
		font-weight: 700;
		color: hsl(39 90% 82%);
	}
	.nimble-ncct__end-turn-overlay {
		position: absolute;
		left: 50%;
		bottom: 2.2rem;
		min-width: 4.2rem;
		height: 1.3rem;
		padding: 0 0.45rem;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		font-size: 0.72rem;
		font-weight: 700;
		letter-spacing: 0.02em;
		text-transform: uppercase;
		white-space: nowrap;
		line-height: 1;
		color: hsl(0 0% 96%);
		background: color-mix(in srgb, hsl(138 48% 28%) 92%, black 14%);
		border: 1px solid color-mix(in srgb, hsl(124 56% 66%) 78%, white 12%);
		border-radius: 0.24rem;
		box-shadow: 0 0 0.4rem color-mix(in srgb, hsl(124 56% 52%) 40%, transparent);
		opacity: 0;
		transform: translate(-50%, 0.2rem);
		transition:
			opacity 120ms ease,
			transform 120ms ease,
			filter 120ms ease;
		pointer-events: none;
		cursor: pointer;
		z-index: 4;
	}
	.nimble-ncct__portrait--active:hover .nimble-ncct__end-turn-overlay,
	.nimble-ncct__portrait--active:focus-within .nimble-ncct__end-turn-overlay {
		opacity: 1;
		transform: translate(-50%, 0);
		pointer-events: all;
	}
	.nimble-ncct__end-turn-overlay:hover,
	.nimble-ncct__end-turn-overlay:focus-visible {
		filter: brightness(1.12);
	}
	.nimble-ncct__dead {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		height: calc(9rem * var(--nimble-ncct-card-scale, 1));
		padding-inline: 0.26rem;
		font-size: 0.56rem;
		font-weight: 700;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: hsl(0 0% 79%);
	}
	.nimble-ncct__round-separator {
		display: inline-flex;
		align-items: center;
		gap: 0.28rem;
		height: 100%;
		opacity: 0.8;
		margin-inline: 0.1rem;
	}
	.nimble-ncct__round-separator-line {
		width: 0;
		height: calc(8.4rem * var(--nimble-ncct-card-scale, 1));
		border-left: 1px solid color-mix(in srgb, hsl(0 0% 100%) 75%, transparent);
		border-bottom-right-radius: 999px;
		border-bottom-left-radius: 999px;
	}
	.nimble-ncct__round-separator-round {
		display: inline-flex;
		align-items: center;
		gap: 0.18rem;
		font-size: 0.88rem;
		font-weight: 700;
		color: hsl(0 0% 96%);
		text-shadow: 0 0 0.32rem color-mix(in srgb, black 75%, transparent);
	}
	@media (max-width: 900px) {
		.nimble-ncct__icon-button {
			width: 1.36rem;
			height: 1.36rem;
			font-size: 0.7rem;
		}
		.nimble-ncct__portrait {
			width: calc(4.5rem * var(--nimble-ncct-card-scale, 1));
			height: calc(6.7rem * var(--nimble-ncct-card-scale, 1));
		}
		.nimble-ncct__portrait--active {
			width: calc(5.35rem * var(--nimble-ncct-card-scale, 1));
			height: calc(8.05rem * var(--nimble-ncct-card-scale, 1));
		}
		.nimble-ncct__round-separator-line {
			height: calc(6.1rem * var(--nimble-ncct-card-scale, 1));
		}
		.nimble-ncct__round-separator-round {
			font-size: 0.72rem;
		}
	}
	@media (hover: none) {
		.nimble-ncct__controls {
			pointer-events: all;
			opacity: 1;
			visibility: visible;
			transition: none;
		}
		.nimble-ncct__track {
			scrollbar-width: thin;
		}
		.nimble-ncct__track::-webkit-scrollbar {
			height: 0.44rem;
		}
	}
</style>
