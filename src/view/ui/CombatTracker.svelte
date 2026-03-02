<script lang="ts">
	import { onDestroy, onMount, tick } from 'svelte';
	import { fade, slide } from 'svelte/transition';
	import {
		canCurrentUserReorderCombatant,
		getCombatantTypePriority,
	} from '../../utils/combatantOrdering.js';
	import { isCombatantDead } from '../../utils/isCombatantDead.js';
	import {
		getEffectiveMinionGroupLeader,
		getMinionGroupId,
		getMinionGroupSummaries,
		isMinionGroupTemporary,
	} from '../../utils/minionGrouping.js';
	import { shouldShowTrackerGroupedStacksForCurrentUser } from '../../utils/minionGroupingModes.js';
	import {
		getCombatTrackerLocation,
		getCurrentTurnAnimationSettings,
		isCombatTrackerLocationSettingKey,
		isCurrentTurnAnimationSettingKey,
		type CombatTrackerLocation,
		type CurrentTurnAnimationSettings,
	} from '../../settings/combatTrackerSettings.js';
	import {
		getNcswSidebarViewMode,
		setNcswDockHostElement,
		setNcswSidebarViewMode,
		type NcswSidebarViewMode,
	} from '../../hooks/minionGroupTokenActions.js';
	import BaseCombatant from './components/BaseCombatant.svelte';
	import CombatTrackerControls from './components/CombatTrackerControls.svelte';
	import PlayerCharacterCombatant from './components/PlayerCharacterCombatant.svelte';
	import MonsterCombatant from '#view/ui/components/MonsterCombatant.svelte';
	import CombatTrackerSettings from '#view/ui/CombatTrackerSettings.svelte.js';

	type CombatWithDrop = Combat & {
		_onDrop?: (
			event: DragEvent & { target: EventTarget & HTMLElement },
		) => Promise<void | boolean | Combatant.Implementation[]>;
	};

	interface SceneCombatantLists {
		activeCombatants: Combatant.Implementation[];
		deadCombatants: Combatant.Implementation[];
		groupedStackMemberCountsByLeaderId: Map<string, number>;
		groupedStackMemberNamesByLeaderId: Map<string, string[]>;
	}

	interface TempGroupPopoverState {
		leaderId: string;
		memberNames: string[];
		left: number;
		top: number;
	}

	interface CombatantDropPreview {
		sourceId: string;
		targetId: string;
		before: boolean;
	}

	interface CombatantDragStartDetail {
		combatantId: string;
	}

	interface CurrentTurnAnimationSettingsPreviewDetail {
		settings: CurrentTurnAnimationSettings;
	}

	interface CombatTrackerLocationPreviewDetail {
		location: CombatTrackerLocation;
	}

	interface CombatTrackerReserveInsets {
		top: number;
		right: number;
		bottom: number;
		left: number;
	}

	const COMBAT_TRACKER_MIN_WIDTH_REM = 6.5;
	const COMBAT_TRACKER_MAX_WIDTH_REM = COMBAT_TRACKER_MIN_WIDTH_REM * 2;
	const NCS_SIDEBAR_MIN_WIDTH_REM = 24;
	const NCS_SIDEBAR_MAX_WIDTH_REM = 40;
	const COMBAT_TRACKER_MIN_HEIGHT_REM = 6.5;
	const COMBAT_TRACKER_MAX_HEIGHT_REM = 13.5;
	const COMBAT_TRACKER_HEIGHT_TO_CARD_WIDTH_RATIO = 0.66;
	const COMBAT_TRACKER_ACTIVE_HORIZONTAL_HEIGHT_BUFFER_MIN_REM = 0;
	const COMBAT_TRACKER_ACTIVE_HORIZONTAL_HEIGHT_BUFFER_RATIO = 0;
	const COMBAT_TRACKER_BOTTOM_PROTECTED_UI_GAP_PX = 10;
	const COMBAT_TRACKER_WIDTH_STORAGE_KEY = 'nimble.combatTracker.widthRem';
	const NCS_SIDEBAR_WIDTH_STORAGE_KEY = 'nimble.ncs.widthRem';
	const COMBAT_TRACKER_HEIGHT_STORAGE_KEY = 'nimble.combatTracker.heightRem';
	const COMBAT_SIDEBAR_VIEW_MODE_STORAGE_KEY = 'nimble.combatSidebar.viewMode';
	const DRAG_TARGET_EXPANSION_REM = 0.9;
	const DRAG_SWITCH_UPPER_RATIO = 0.4;
	const DRAG_SWITCH_LOWER_RATIO = 0.6;
	const PULSE_DURATION_MIN_SECONDS = 0.6;
	const PULSE_DURATION_MAX_SECONDS = 2.4;
	const GLOW_SCALE_MIN = 0.275;
	const GLOW_SCALE_MAX = 2.775;
	const EDGE_CRAWLER_SIZE_MIN = 0.6;
	const EDGE_CRAWLER_SIZE_MAX = 2.0;
	const WHEEL_DELTA_LINE_PX = 16;

	function isHorizontalCombatTrackerLocation(location: CombatTrackerLocation): boolean {
		return location === 'top' || location === 'bottom';
	}

	function normalizeSidebarViewMode(
		viewMode: NcswSidebarViewMode | string | null | undefined,
	): NcswSidebarViewMode {
		return viewMode === 'ncs' ? 'ncs' : 'combatTracker';
	}

	function getSidebarWidthBoundsForViewMode(viewMode: NcswSidebarViewMode): {
		min: number;
		max: number;
	} {
		if (viewMode === 'ncs') {
			return {
				min: NCS_SIDEBAR_MIN_WIDTH_REM,
				max: NCS_SIDEBAR_MAX_WIDTH_REM,
			};
		}
		return {
			min: COMBAT_TRACKER_MIN_WIDTH_REM,
			max: COMBAT_TRACKER_MAX_WIDTH_REM,
		};
	}

	function getCombatTrackerSizeBounds(location: CombatTrackerLocation): {
		min: number;
		max: number;
	} {
		return isHorizontalCombatTrackerLocation(location)
			? {
					min: COMBAT_TRACKER_MIN_HEIGHT_REM,
					max: COMBAT_TRACKER_MAX_HEIGHT_REM,
				}
			: getSidebarWidthBoundsForViewMode(combatSidebarViewMode);
	}

	function clampCombatTrackerSize(sizeRem: number, location: CombatTrackerLocation): number {
		const { min, max } = getCombatTrackerSizeBounds(location);
		return Math.min(max, Math.max(min, sizeRem));
	}

	function sliderToRange(value: number, min: number, max: number): number {
		const normalizedValue = Math.min(100, Math.max(0, value)) / 100;
		return min + (max - min) * normalizedValue;
	}

	function clampNumber(value: number, min: number, max: number): number {
		return Math.min(max, Math.max(min, value));
	}

	function firstNonEmptyString(values: Array<string | null | undefined>): string | null {
		for (const value of values) {
			if (typeof value !== 'string') continue;
			if (value.length > 0) return value;
		}
		return null;
	}

	function getWheelDeltaPx(event: WheelEvent): number {
		const dominantDelta =
			Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;

		if (event.deltaMode === WheelEvent.DOM_DELTA_LINE) {
			return dominantDelta * WHEEL_DELTA_LINE_PX;
		}

		if (event.deltaMode === WheelEvent.DOM_DELTA_PAGE) {
			return dominantDelta * window.innerWidth * 0.9;
		}

		return dominantDelta;
	}

	function getRootFontSizePx(): number {
		const rootFontSize =
			Number.parseFloat(globalThis.getComputedStyle(document.documentElement).fontSize) || 16;
		return Number.isFinite(rootFontSize) && rootFontSize > 0 ? rootFontSize : 16;
	}

	function readStoredCombatTrackerSize(storageKey: string, min: number, max: number): number {
		try {
			const storedSize = globalThis.localStorage.getItem(storageKey);
			if (!storedSize) return min;

			const parsed = Number.parseFloat(storedSize);
			if (!Number.isFinite(parsed)) return min;

			return Math.min(max, Math.max(min, parsed));
		} catch (_error) {
			return min;
		}
	}

	function saveCombatTrackerSize(storageKey: string, sizeRem: number): void {
		try {
			globalThis.localStorage.setItem(storageKey, String(sizeRem));
		} catch (_error) {
			// No-op: local storage access may fail in some browser privacy modes.
		}
	}

	function readStoredSidebarViewMode(): NcswSidebarViewMode {
		try {
			const storedMode = globalThis.localStorage.getItem(COMBAT_SIDEBAR_VIEW_MODE_STORAGE_KEY);
			return normalizeSidebarViewMode(storedMode);
		} catch (_error) {
			return 'combatTracker';
		}
	}

	function saveSidebarViewMode(viewMode: NcswSidebarViewMode): void {
		try {
			globalThis.localStorage.setItem(COMBAT_SIDEBAR_VIEW_MODE_STORAGE_KEY, viewMode);
		} catch (_error) {
			// No-op: local storage access may fail in some browser privacy modes.
		}
	}

	function getSidebarWidthStorageKey(viewMode: NcswSidebarViewMode): string {
		return viewMode === 'ncs' ? NCS_SIDEBAR_WIDTH_STORAGE_KEY : COMBAT_TRACKER_WIDTH_STORAGE_KEY;
	}

	function clearCombatTrackerSceneReserveInsets(): void {
		const rootStyle = document.documentElement.style;
		rootStyle.setProperty('--nimble-combat-scene-reserve-top', '0px');
		rootStyle.setProperty('--nimble-combat-scene-reserve-right', '0px');
		rootStyle.setProperty('--nimble-combat-scene-reserve-bottom', '0px');
		rootStyle.setProperty('--nimble-combat-scene-reserve-left', '0px');
		rootStyle.setProperty('--nimble-combat-hotbar-reserve-bottom', '0px');
		rootStyle.setProperty('--nimble-combat-hotbar-reserve-margin-bottom', '0px');
		rootStyle.setProperty('--nimble-combat-players-reserve-bottom', '0px');
		rootStyle.setProperty('--nimble-combat-chat-controls-reserve-bottom', '0px');
		rootStyle.setProperty('--nimble-combat-chat-form-reserve-bottom', '0px');
	}

	function buildCombatTrackerReserveInsets(
		sidebarWidthPx: number,
		trackerHeightPx: number,
	): CombatTrackerReserveInsets {
		return {
			top: combatTrackerLocation === 'top' ? trackerHeightPx : 0,
			right: combatTrackerLocation === 'right' ? sidebarWidthPx : 0,
			bottom:
				combatTrackerLocation === 'bottom'
					? trackerHeightPx + COMBAT_TRACKER_BOTTOM_PROTECTED_UI_GAP_PX
					: 0,
			left: combatTrackerLocation === 'left' ? sidebarWidthPx : 0,
		};
	}

	function setReserveInsetVariables(
		rootStyle: CSSStyleDeclaration,
		reserveInsets: CombatTrackerReserveInsets,
	): void {
		rootStyle.setProperty('--nimble-combat-scene-reserve-top', `${Math.round(reserveInsets.top)}px`);
		rootStyle.setProperty(
			'--nimble-combat-scene-reserve-right',
			`${Math.round(reserveInsets.right)}px`,
		);
		rootStyle.setProperty(
			'--nimble-combat-scene-reserve-bottom',
			`${Math.round(reserveInsets.bottom)}px`,
		);
		rootStyle.setProperty('--nimble-combat-scene-reserve-left', `${Math.round(reserveInsets.left)}px`);
	}

	function hasBottomOffsetStyle(element: HTMLElement | null): boolean {
		if (!element) return false;
		const position = globalThis.getComputedStyle(element).position;
		return position === 'absolute' || position === 'fixed' || position === 'relative' || position === 'sticky';
	}

	function isElementContainedBy(
		containerSelector: string,
		childSelector: string,
	): boolean {
		const containerElement = document.querySelector<HTMLElement>(containerSelector);
		const childElement = document.querySelector<HTMLElement>(childSelector);
		if (!containerElement || !childElement) return false;
		return containerElement.contains(childElement);
	}

	function resolveBottomReserveVariables(reserveBottomPx: number): {
		hotbarReserveBottomPx: number;
		hotbarReserveMarginBottomPx: number;
		playersReserveBottomPx: number;
		chatControlsReserveBottomPx: number;
		chatFormReserveBottomPx: number;
	} {
		let hotbarReserveBottomPx = reserveBottomPx;
		let hotbarReserveMarginBottomPx = 0;
		let playersReserveBottomPx = reserveBottomPx;
		let chatControlsReserveBottomPx = reserveBottomPx;
		let chatFormReserveBottomPx = reserveBottomPx;
		if (reserveBottomPx < 1) {
			return {
				hotbarReserveBottomPx,
				hotbarReserveMarginBottomPx,
				playersReserveBottomPx,
				chatControlsReserveBottomPx,
				chatFormReserveBottomPx,
			};
		}

		const hotbarElement = document.querySelector<HTMLElement>('#interface #hotbar, #hotbar');
		if (!hasBottomOffsetStyle(hotbarElement)) {
			hotbarReserveBottomPx = 0;
			hotbarReserveMarginBottomPx = reserveBottomPx;
		}

		if (isElementContainedBy('#interface #ui-left, #ui-left', '#interface #players, #players')) {
			playersReserveBottomPx = 0;
		}
		if (
			isElementContainedBy(
				'#interface #ui-right, #ui-right',
				'#interface #chat-controls, #chat-controls',
			)
		) {
			chatControlsReserveBottomPx = 0;
		}
		if (
			isElementContainedBy('#interface #ui-right, #ui-right', '#interface #chat-form, #chat-form')
		) {
			chatFormReserveBottomPx = 0;
		}

		return {
			hotbarReserveBottomPx,
			hotbarReserveMarginBottomPx,
			playersReserveBottomPx,
			chatControlsReserveBottomPx,
			chatFormReserveBottomPx,
		};
	}

	function setBottomReserveVariables(
		rootStyle: CSSStyleDeclaration,
		bottomReserves: {
			hotbarReserveBottomPx: number;
			hotbarReserveMarginBottomPx: number;
			playersReserveBottomPx: number;
			chatControlsReserveBottomPx: number;
			chatFormReserveBottomPx: number;
		},
	): void {
		rootStyle.setProperty(
			'--nimble-combat-hotbar-reserve-bottom',
			`${Math.round(bottomReserves.hotbarReserveBottomPx)}px`,
		);
		rootStyle.setProperty(
			'--nimble-combat-hotbar-reserve-margin-bottom',
			`${Math.round(bottomReserves.hotbarReserveMarginBottomPx)}px`,
		);
		rootStyle.setProperty(
			'--nimble-combat-players-reserve-bottom',
			`${Math.round(bottomReserves.playersReserveBottomPx)}px`,
		);
		rootStyle.setProperty(
			'--nimble-combat-chat-controls-reserve-bottom',
			`${Math.round(bottomReserves.chatControlsReserveBottomPx)}px`,
		);
		rootStyle.setProperty(
			'--nimble-combat-chat-form-reserve-bottom',
			`${Math.round(bottomReserves.chatFormReserveBottomPx)}px`,
		);
	}

	function updateCombatTrackerSceneReserveInsets(): void {
		if (!currentCombat) {
			clearCombatTrackerSceneReserveInsets();
			return;
		}

		const rootFontSizePx = getRootFontSizePx();
		const sidebarWidthPx = combatTrackerWidthRem * rootFontSizePx;
		const trackerHeightPx = combatTrackerDisplayedHeightRem * rootFontSizePx;
		const reserveInsets = buildCombatTrackerReserveInsets(sidebarWidthPx, trackerHeightPx);

		const rootStyle = document.documentElement.style;
		setReserveInsetVariables(rootStyle, reserveInsets);
		const bottomReserves = resolveBottomReserveVariables(reserveInsets.bottom);
		setBottomReserveVariables(rootStyle, bottomReserves);
	}

	function resolveDirectCombatantSceneId(combatant: Combatant.Implementation): string | undefined {
		const directSceneId = combatant.sceneId;
		if (directSceneId) return directSceneId;
		const parentSceneId = combatant.token?.parent?.id;
		if (parentSceneId) return parentSceneId;
		return undefined;
	}

	function resolveCurrentSceneCombatantSceneId(
		combatant: Combatant.Implementation,
	): string | undefined {
		const sceneId = canvas.scene?.id;
		if (!sceneId) return undefined;
		const tokenId = combatant.tokenId?.trim() ?? '';
		if (!tokenId) return undefined;
		const tokenDoc = canvas.scene?.tokens?.get(tokenId);
		if (tokenDoc) return sceneId;
		return undefined;
	}

	function getCombatantSceneId(combatant: Combatant.Implementation): string | undefined {
		return (
			resolveDirectCombatantSceneId(combatant) ??
			resolveCurrentSceneCombatantSceneId(combatant)
		);
	}

	function hasCombatantsForScene(combat: Combat, sceneId: string): boolean {
		return combat.combatants.contents.some((c) => getCombatantSceneId(c) === sceneId);
	}

	function getGroupedStackDataByLeaderIdForScene(combatantsForScene: Combatant.Implementation[]): {
		countsByLeaderId: Map<string, number>;
		memberNamesByLeaderId: Map<string, string[]>;
	} {
		const groupedStackMemberCountsByLeaderId = new Map<string, number>();
		const groupedStackMemberNamesByLeaderId = new Map<string, string[]>();
		const groupSummaries = getMinionGroupSummaries(combatantsForScene);

		for (const summary of groupSummaries.values()) {
			const isTemporaryGroup = summary.members.some((member) => isMinionGroupTemporary(member));
			if (!isTemporaryGroup) continue;

			const aliveMemberCount = summary.aliveMembers.length;
			if (aliveMemberCount < 2) continue;

			const leader =
				getEffectiveMinionGroupLeader(summary, { aliveOnly: true }) ??
				getEffectiveMinionGroupLeader(summary);
			if (!leader?.id) continue;

			groupedStackMemberCountsByLeaderId.set(leader.id, aliveMemberCount);
			groupedStackMemberNamesByLeaderId.set(
				leader.id,
				summary.aliveMembers
					.map((member) => resolveGroupedStackMemberName(member))
					.sort((left, right) => left.localeCompare(right)),
			);
		}

		return {
			countsByLeaderId: groupedStackMemberCountsByLeaderId,
			memberNamesByLeaderId: groupedStackMemberNamesByLeaderId,
		};
	}

	function resolveGroupedStackMemberName(combatant: Combatant.Implementation): string {
		return (
			firstNonEmptyString([
				combatant.token?.reactive?.name,
				combatant.token?.name,
				combatant.token?.actor?.reactive?.name,
				combatant.reactive?.name,
				combatant.name,
			]) ?? 'Unknown'
		);
	}

	function getCombatantsForScene(
		combat: Combat | null,
		sceneId: string | undefined,
	): SceneCombatantLists {
		if (!sceneId || !combat) {
			return {
				activeCombatants: [],
				deadCombatants: [],
				groupedStackMemberCountsByLeaderId: new Map(),
				groupedStackMemberNamesByLeaderId: new Map(),
			};
		}

		const shouldShowGroupedStacks = shouldShowTrackerGroupedStacksForCurrentUser();

		const combatantsForScene = combat.combatants.contents.filter(
			(c) => getCombatantSceneId(c) === sceneId && c.visible && c._id != null,
		);
		const groupedStackDataByLeaderId = shouldShowGroupedStacks
			? getGroupedStackDataByLeaderIdForScene(combatantsForScene)
			: {
					countsByLeaderId: new Map<string, number>(),
					memberNamesByLeaderId: new Map<string, string[]>(),
				};
		const groupedStackMemberCountsByLeaderId = groupedStackDataByLeaderId.countsByLeaderId;
		const groupedStackMemberNamesByLeaderId = groupedStackDataByLeaderId.memberNamesByLeaderId;
		const groupSummariesById = getMinionGroupSummaries(combatantsForScene);
		const isTemporaryGroupMemberHiddenInStack = (combatant: Combatant.Implementation): boolean => {
			if (!shouldShowGroupedStacks) return false;

			const groupId = getMinionGroupId(combatant);
			if (!groupId) return false;

			const summary = groupSummariesById.get(groupId);
			if (!summary) return false;
			if (!summary.members.some((member) => isMinionGroupTemporary(member))) return false;

			const leader =
				getEffectiveMinionGroupLeader(summary, { aliveOnly: true }) ??
				getEffectiveMinionGroupLeader(summary);
			if (!leader?.id) return false;
			return leader.id !== combatant.id;
		};

		const turnCombatants = combat.turns.filter(
			(c) => getCombatantSceneId(c) === sceneId && c.visible && c._id != null,
		);

		const turnCombatantIds = new Set(turnCombatants.map((c) => c.id));
		const activeCombatants = turnCombatants.filter(
			(combatant) => !isCombatantDead(combatant) && !isTemporaryGroupMemberHiddenInStack(combatant),
		);
		const missingActiveCombatants = combatantsForScene.filter((combatant) => {
			if (isCombatantDead(combatant)) return false;
			if (turnCombatantIds.has(combatant.id ?? '')) return false;
			if (isTemporaryGroupMemberHiddenInStack(combatant)) return false;
			return true;
		});

		const deadCombatants = combatantsForScene
			.filter((combatant) => isCombatantDead(combatant))
			.sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''));

		return {
			activeCombatants: [...activeCombatants, ...missingActiveCombatants],
			deadCombatants,
			groupedStackMemberCountsByLeaderId,
			groupedStackMemberNamesByLeaderId,
		};
	}

	function getActiveCombatForCurrentScene(sceneId: string): Combat | null {
		const activeCombat = game.combat;
		if (!activeCombat) return null;
		const isActiveCombat = activeCombat.active === true;
		const matchesScene = activeCombat.scene?.id === sceneId;
		return isActiveCombat && matchesScene ? activeCombat : null;
	}

	function getViewedCombatForCurrentScene(sceneId: string): Combat | null {
		const viewedCombat = game.combats.viewed ?? null;
		if (viewedCombat && viewedCombat.scene?.id === sceneId) return viewedCombat;
		return null;
	}

	function getCombatForCurrentScene(): Combat | null {
		const sceneId = canvas.scene?.id;
		if (!sceneId) return null;
		return (
			getActiveCombatForCurrentScene(sceneId) ??
			getViewedCombatForCurrentScene(sceneId) ??
			game.combats.contents.find((combat) => hasCombatantsForScene(combat, sceneId)) ??
			null
		);
	}

	function getCombatantComponent(combatant: Combatant.Implementation) {
		switch (combatant.type) {
			case 'character':
				return PlayerCharacterCombatant;
			case 'soloMonster':
			case 'npc': // TODO: For now NPCs are monsters in regards to the combat tracker
				return MonsterCombatant;
			default:
				return BaseCombatant;
		}
	}

	function updateCurrentCombat() {
		// Use queueMicrotask to ensure Foundry's data is fully updated
		// before we read it, and to batch Svelte's reactivity updates
		queueMicrotask(async () => {
			const previousScrollTop = combatantsListElement?.scrollTop ?? null;
			const combat = getCombatForCurrentScene();
			const sceneId = canvas.scene?.id;
			const {
				activeCombatants,
				deadCombatants,
				groupedStackMemberCountsByLeaderId,
				groupedStackMemberNamesByLeaderId,
			} = getCombatantsForScene(combat, sceneId);
			currentCombat = combat;
			sceneCombatants = activeCombatants;
			sceneDeadCombatants = deadCombatants;
			sceneGroupedStackMemberCountsByLeaderId = groupedStackMemberCountsByLeaderId;
			sceneGroupedStackMemberNamesByLeaderId = groupedStackMemberNamesByLeaderId;
			version++;

			if (previousScrollTop !== null) {
				await tick();
				if (combatantsListElement) {
					combatantsListElement.scrollTop = previousScrollTop;
				}
			}
		});
	}

	async function promptToEndCombatIfEmpty(combatId: string): Promise<void> {
		if (!game.user?.isGM) return;

		const combat = game.combats.get(combatId);
		if (!combat) return;
		if (combat.combatants.size > 0) return;

		const confirmed = await foundry.applications.api.DialogV2.confirm({
			window: {
				title: 'End Combat?',
			},
			content: '<p>The are no combatants in this encounter.<br>Would you like to end combat?</p>',
			yes: {
				label: 'End Combat',
			},
			no: {
				label: 'Continue Combat',
			},
			rejectClose: false,
			modal: true,
		});

		if (confirmed !== true) return;

		const currentCombat = game.combats.get(combatId);
		if (!currentCombat || currentCombat.combatants.size > 0) return;

		await currentCombat.delete();
	}

	function scheduleEmptyCombatPrompt(combatId: string): void {
		if (pendingEmptyCombatPromptIds.has(combatId)) return;
		pendingEmptyCombatPromptIds.add(combatId);

		queueMicrotask(() => {
			pendingEmptyCombatPromptIds.delete(combatId);
			void promptToEndCombatIfEmpty(combatId);
		});
	}

	function updateCurrentTurnAnimationSettings() {
		currentTurnAnimationSettings = getCurrentTurnAnimationSettings();
	}

	function normalizePreviewLocation(
		location: CombatTrackerLocation,
		fallback: CombatTrackerLocation,
	): CombatTrackerLocation {
		if (
			location === 'left' ||
			location === 'right' ||
			location === 'top' ||
			location === 'bottom'
		) {
			return location;
		}

		return fallback;
	}

	function updateCombatTrackerLocation() {
		combatTrackerLocation = getCombatTrackerLocation();
	}

	function setCombatSidebarMode(nextMode: NcswSidebarViewMode): void {
		const normalizedMode = normalizeSidebarViewMode(nextMode);
		if (combatSidebarViewMode === normalizedMode) return;

		const previousBounds = getSidebarWidthBoundsForViewMode(combatSidebarViewMode);
		const clampedCurrentWidth = clampNumber(
			combatTrackerWidthRem,
			previousBounds.min,
			previousBounds.max,
		);
		saveCombatTrackerSize(getSidebarWidthStorageKey(combatSidebarViewMode), clampedCurrentWidth);

		combatSidebarViewMode = normalizedMode;

		const nextBounds = getSidebarWidthBoundsForViewMode(normalizedMode);
		combatTrackerWidthRem = readStoredCombatTrackerSize(
			getSidebarWidthStorageKey(normalizedMode),
			nextBounds.min,
			nextBounds.max,
		);

		saveSidebarViewMode(normalizedMode);
		setNcswSidebarViewMode(normalizedMode);
	}

	function handleCurrentTurnAnimationSettingsPreview(event: Event): void {
		const previewEvent = event as CustomEvent<CurrentTurnAnimationSettingsPreviewDetail>;
		const previewSettings = previewEvent.detail?.settings;
		if (!previewSettings) return;

		currentTurnAnimationSettings = previewSettings;
	}

	function handleCombatTrackerLocationPreview(event: Event): void {
		const previewEvent = event as CustomEvent<CombatTrackerLocationPreviewDetail>;
		const previewLocation = previewEvent.detail?.location;
		if (!previewLocation) return;

		combatTrackerLocation = normalizePreviewLocation(previewLocation, combatTrackerLocation);
	}

	async function _onDrop(event: DragEvent) {
		event.preventDefault();
		if (!(event.target instanceof HTMLElement)) {
			clearDragState();
			return;
		}

		const combat = currentCombat as CombatWithDrop | null;
		if (typeof combat?._onDrop !== 'function') {
			clearDragState();
			return;
		}

		try {
			await combat._onDrop(event as DragEvent & { target: EventTarget & HTMLElement });
		} finally {
			clearDragState();
		}
	}

	function clearDropPreview() {
		dragPreview = null;
	}

	function clearDragState() {
		activeDragSourceId = null;
		clearDropPreview();
	}

	function handleCombatantDragStart(event: Event) {
		const customEvent = event as CustomEvent<CombatantDragStartDetail>;
		const combatantId = customEvent.detail?.combatantId;
		if (!combatantId) return;

		activeDragSourceId = combatantId;
		clearDropPreview();
	}

	function handleCombatantDragEnd() {
		clearDragState();
	}

	function getDragTargetExpansionPx(): number {
		return getRootFontSizePx() * DRAG_TARGET_EXPANSION_REM * combatTrackerScale;
	}

	function getDragPointerValue(clientX: number, clientY: number, isHorizontal: boolean): number {
		return isHorizontal ? clientX : clientY;
	}

	function getDragTargetCandidates(source: Combatant.Implementation): Combatant.Implementation[] {
		const sourcePriority = getCombatantTypePriority(source);
		return sceneCombatants.filter((combatant) => {
			if (combatant.id === source.id) return false;
			if (isCombatantDead(combatant)) return false;
			return getCombatantTypePriority(combatant) === sourcePriority;
		});
	}

	function getExpandedDistanceToRect(params: {
		rect: DOMRect;
		pointerValue: number;
		isHorizontal: boolean;
		expansionPx: number;
	}): number {
		const rectStart = params.isHorizontal ? params.rect.left : params.rect.top;
		const rectEnd = params.isHorizontal ? params.rect.right : params.rect.bottom;
		const expandedStart = rectStart - params.expansionPx;
		const expandedEnd = rectEnd + params.expansionPx;
		if (params.pointerValue < expandedStart) return expandedStart - params.pointerValue;
		if (params.pointerValue > expandedEnd) return params.pointerValue - expandedEnd;
		return 0;
	}

	function findClosestPreviewTarget(params: {
		candidates: Combatant.Implementation[];
		pointerValue: number;
		isHorizontal: boolean;
		expansionPx: number;
	}): { target: Combatant.Implementation; rect: DOMRect } | null {
		if (!combatantsListElement) return null;
		let bestTarget: Combatant.Implementation | null = null;
		let bestRect: DOMRect | null = null;
		let bestDistance = Number.POSITIVE_INFINITY;

		for (const candidate of params.candidates) {
			const row = combatantsListElement.querySelector<HTMLElement>(
				`.nimble-combatants__item[data-combatant-id="${candidate.id}"]`,
			);
			if (!row) continue;

			const rect = row.getBoundingClientRect();
			const distance = getExpandedDistanceToRect({
				rect,
				pointerValue: params.pointerValue,
				isHorizontal: params.isHorizontal,
				expansionPx: params.expansionPx,
			});
			if (distance >= bestDistance) continue;
			bestDistance = distance;
			bestTarget = candidate;
			bestRect = rect;
		}

		if (!bestTarget || !bestRect) return null;
		return { target: bestTarget, rect: bestRect };
	}

	function resolveDropBeforePosition(relative: number, targetId: string): boolean {
		if (relative <= DRAG_SWITCH_UPPER_RATIO) return true;
		if (relative >= DRAG_SWITCH_LOWER_RATIO) return false;
		if (dragPreview?.targetId === targetId) return dragPreview.before;
		return relative < 0.5;
	}

	function getPreviewTargetFromPointer(
		clientX: number,
		clientY: number,
		source: Combatant.Implementation,
	): { target: Combatant.Implementation; before: boolean } | null {
		if (!combatantsListElement) return null;

		const isHorizontalLayout = isHorizontalCombatTrackerLocation(combatTrackerLocation);
		const candidates = getDragTargetCandidates(source);
		if (candidates.length === 0) return null;

		const pointerValue = getDragPointerValue(clientX, clientY, isHorizontalLayout);
		const closestTarget = findClosestPreviewTarget({
			candidates,
			pointerValue,
			isHorizontal: isHorizontalLayout,
			expansionPx: getDragTargetExpansionPx(),
		});
		if (!closestTarget) return null;

		const rectStart = isHorizontalLayout ? closestTarget.rect.left : closestTarget.rect.top;
		const rectSize = isHorizontalLayout ? closestTarget.rect.width : closestTarget.rect.height;
		const relative = (pointerValue - rectStart) / Math.max(1, rectSize);
		const targetId = closestTarget.target.id ?? '';
		const before = resolveDropBeforePosition(relative, targetId);
		return { target: closestTarget.target, before };
	}

	function resolveDragPreviewSourceCombatant(
		combat: Combat,
		sourceId: string | null,
	): Combatant.Implementation | null {
		if (!sourceId) return null;
		const source = combat.combatants.get(sourceId);
		if (!source?.id) return null;
		if (source.parent?.id !== combat.id) return null;
		if (isCombatantDead(source)) return null;
		if (!canCurrentUserReorderCombatant(source)) return null;
		return source;
	}

	function getDragPreview(event: DragEvent): CombatantDropPreview | null {
		if (!currentCombat) return null;
		const source = resolveDragPreviewSourceCombatant(currentCombat, activeDragSourceId);
		if (!source) return null;

		const pointerTarget = getPreviewTargetFromPointer(event.clientX, event.clientY, source);
		if (!pointerTarget) return null;

		return {
			sourceId: source.id,
			targetId: pointerTarget.target.id ?? '',
			before: pointerTarget.before,
		};
	}

	function handleDragOver(event: DragEvent) {
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

	function rollInitiativeForAll(event: MouseEvent) {
		event.preventDefault();
		currentCombat?.rollAll();
	}

	function startCombat(event: MouseEvent): Promise<Combat> | undefined {
		event.preventDefault();
		return currentCombat?.startCombat();
	}

	async function endCombat(event: MouseEvent): Promise<void> {
		event.preventDefault();
		if (!game.user?.isGM) return;

		try {
			await currentCombat?.delete();
		} catch (_error) {
			ui.notifications?.error('Unable to end combat.');
		}
	}

	function openCombatTrackerSettings(event: MouseEvent): void {
		event.preventDefault();
		CombatTrackerSettings.open();
	}

	async function endCurrentTurn(event: MouseEvent): Promise<void> {
		event.preventDefault();

		if (!showHorizontalFloatingEndTurn) return;
		if (!canCurrentUserEndCurrentTurn) {
			ui.notifications?.warn('You do not have permission to end turns.');
			return;
		}

		try {
			await currentCombat?.nextTurn();
		} catch (_error) {
			ui.notifications?.warn('You do not have permission to end turns.');
		}
	}

	function getActiveCombatantCardElement(): HTMLElement | null {
		if (!combatantsListElement) return null;
		return (
			combatantsListElement.querySelector<HTMLElement>('.nimble-combatants__item--active') ??
			combatantsListElement.querySelector<HTMLElement>('.nimble-combatants__item')
		);
	}

	function resolveFloatingEndTurnTop(params: {
		trackerRect: DOMRect;
		buttonHeight: number;
		viewportPaddingPx: number;
		edgeGapPx: number;
	}): number {
		const trackerDockedTop = combatTrackerElement?.classList.contains(
			'nimble-combat-tracker--location-top',
		);
		const trackerDockedBottom = combatTrackerElement?.classList.contains(
			'nimble-combat-tracker--location-bottom',
		);
		const preferredTop =
			trackerDockedTop && !trackerDockedBottom
				? params.trackerRect.bottom + params.edgeGapPx
				: params.trackerRect.top - params.buttonHeight - params.edgeGapPx;
		const maxTop = window.innerHeight - params.buttonHeight - params.viewportPaddingPx;
		return clampNumber(preferredTop, params.viewportPaddingPx, maxTop);
	}

	function updateFloatingEndTurnButtonPosition(): void {
		if (!showHorizontalFloatingEndTurn || !combatTrackerElement) {
			return;
		}

		const activeCardElement = getActiveCombatantCardElement();
		const activeRect = activeCardElement?.getBoundingClientRect();
		const buttonWidth = floatingEndTurnButtonElement?.offsetWidth ?? 96;
		const buttonHeight = floatingEndTurnButtonElement?.offsetHeight ?? 28;
		const viewportPaddingPx = 4;
		const edgeGapPx = 1;
		const trackerRect = combatTrackerElement.getBoundingClientRect();
		const preferredCenterX = activeRect
			? activeRect.left + activeRect.width / 2
			: trackerRect.left + trackerRect.width / 2;
		const minCenterX = buttonWidth / 2 + viewportPaddingPx;
		const maxCenterX = window.innerWidth - buttonWidth / 2 - viewportPaddingPx;
		const centerX = clampNumber(preferredCenterX, minCenterX, maxCenterX);
		const top = resolveFloatingEndTurnTop({
			trackerRect,
			buttonHeight,
			viewportPaddingPx,
			edgeGapPx,
		});

		floatingEndTurnButtonStyle = `left: ${Math.round(centerX)}px; top: ${Math.round(top)}px;`;
	}

	function scheduleFloatingEndTurnPositionUpdate(_dependencyToken = ''): void {
		if (floatingEndTurnPositionFrameHandle !== undefined) {
			cancelAnimationFrame(floatingEndTurnPositionFrameHandle);
		}

		floatingEndTurnPositionFrameHandle = requestAnimationFrame(() => {
			floatingEndTurnPositionFrameHandle = undefined;
			updateFloatingEndTurnButtonPosition();
		});
	}

	function handleHorizontalWheelScroll(event: WheelEvent): void {
		if (!isHorizontalLayout || !combatantsListElement) return;

		const deltaPx = getWheelDeltaPx(event);
		if (Math.abs(deltaPx) < 0.1) return;

		event.preventDefault();
		combatantsListElement.scrollLeft += deltaPx;
		scheduleFloatingEndTurnPositionUpdate();
	}

	function hideTempGroupPopover(): void {
		tempGroupPopoverState = null;
		tempGroupPopoverAnchorElement = null;
	}

	function resolveTempGroupPopoverAnchorPosition(params: {
		anchorRect: DOMRect;
		popoverWidth: number;
		popoverHeight: number;
		viewportMarginPx: number;
		edgeGapPx: number;
	}): { left: number; top: number } {
		if (combatTrackerLocation === 'top') {
			return {
				left: params.anchorRect.left + (params.anchorRect.width - params.popoverWidth) / 2,
				top: params.anchorRect.bottom + params.edgeGapPx,
			};
		}
		if (combatTrackerLocation === 'bottom') {
			return {
				left: params.anchorRect.left + (params.anchorRect.width - params.popoverWidth) / 2,
				top: params.anchorRect.top - params.popoverHeight - params.edgeGapPx,
			};
		}

		let left = params.anchorRect.right + params.edgeGapPx;
		const top = params.anchorRect.top + (params.anchorRect.height - params.popoverHeight) / 2;
		if (left + params.popoverWidth > window.innerWidth - params.viewportMarginPx) {
			left = params.anchorRect.left - params.popoverWidth - params.edgeGapPx;
		}
		return { left, top };
	}

	function updateTempGroupPopoverPosition(): void {
		if (!tempGroupPopoverState || !tempGroupPopoverAnchorElement) return;

		const anchorRect = tempGroupPopoverAnchorElement.getBoundingClientRect();
		const popoverWidth = tempGroupPopoverElement?.offsetWidth ?? 180;
		const popoverHeight = tempGroupPopoverElement?.offsetHeight ?? 120;
		const viewportMarginPx = 8;
		const edgeGapPx = 8;

		const anchorPosition = resolveTempGroupPopoverAnchorPosition({
			anchorRect,
			popoverWidth,
			popoverHeight,
			viewportMarginPx,
			edgeGapPx,
		});

		const maxLeft = Math.max(viewportMarginPx, window.innerWidth - popoverWidth - viewportMarginPx);
		const maxTop = Math.max(
			viewportMarginPx,
			window.innerHeight - popoverHeight - viewportMarginPx,
		);

		const nextLeft = Math.round(
			Math.max(viewportMarginPx, Math.min(maxLeft, anchorPosition.left)),
		);
		const nextTop = Math.round(Math.max(viewportMarginPx, Math.min(maxTop, anchorPosition.top)));
		if (tempGroupPopoverState.left === nextLeft && tempGroupPopoverState.top === nextTop) return;

		tempGroupPopoverState = {
			...tempGroupPopoverState,
			left: nextLeft,
			top: nextTop,
		};
	}

	async function showTempGroupPopover(event: MouseEvent, combatantId: string): Promise<void> {
		if (!game.user?.isGM) return;
		if (!combatantId) {
			hideTempGroupPopover();
			return;
		}

		const memberNames = sceneGroupedStackMemberNamesByLeaderId.get(combatantId);
		if (!memberNames || memberNames.length === 0) {
			hideTempGroupPopover();
			return;
		}

		tempGroupPopoverAnchorElement = event.currentTarget as HTMLElement;
		tempGroupPopoverState = {
			leaderId: combatantId,
			memberNames,
			left: 0,
			top: 0,
		};
		await tick();
		updateTempGroupPopoverPosition();
	}

	function moveTempGroupPopover(event: MouseEvent, combatantId: string): void {
		if (!tempGroupPopoverState) return;
		if (tempGroupPopoverState.leaderId !== combatantId) return;
		tempGroupPopoverAnchorElement = event.currentTarget as HTMLElement;
		updateTempGroupPopoverPosition();
	}

	function stopResizeTracking() {
		if (resizeMoveHandler) {
			window.removeEventListener('pointermove', resizeMoveHandler);
			resizeMoveHandler = undefined;
		}

		if (resizeEndHandler) {
			window.removeEventListener('pointerup', resizeEndHandler);
			window.removeEventListener('pointercancel', resizeEndHandler);
			resizeEndHandler = undefined;
		}

		isResizing = false;
	}

	function startResize(event: PointerEvent) {
		event.preventDefault();

		const handle = event.currentTarget as HTMLElement | null;
		const startX = event.clientX;
		const startY = event.clientY;
		const isHorizontalLayout = isHorizontalCombatTrackerLocation(combatTrackerLocation);
		const isBottomLayout = combatTrackerLocation === 'bottom';
		const startSizeRem = isHorizontalLayout ? combatTrackerHeightRem : combatTrackerWidthRem;
		const rootFontSizePx = getRootFontSizePx();
		const horizontalDirectionMultiplier = combatTrackerLocation === 'right' ? -1 : 1;
		const verticalDirectionMultiplier = isBottomLayout ? -1 : 1;

		stopResizeTracking();
		isResizing = true;

		resizeMoveHandler = (moveEvent: PointerEvent) => {
			const pointerDeltaPx = isHorizontalLayout
				? moveEvent.clientY - startY
				: moveEvent.clientX - startX;
			const directionMultiplier = isHorizontalLayout
				? verticalDirectionMultiplier
				: horizontalDirectionMultiplier;
			const deltaRem = (pointerDeltaPx / rootFontSizePx) * directionMultiplier;
			const nextSizeRem = clampCombatTrackerSize(startSizeRem + deltaRem, combatTrackerLocation);

			if (isHorizontalLayout) {
				combatTrackerHeightRem = nextSizeRem;
			} else {
				combatTrackerWidthRem = nextSizeRem;
			}
		};

		resizeEndHandler = () => {
			stopResizeTracking();
			if (isHorizontalLayout) {
				saveCombatTrackerSize(COMBAT_TRACKER_HEIGHT_STORAGE_KEY, combatTrackerHeightRem);
			} else {
				saveCombatTrackerSize(
					getSidebarWidthStorageKey(combatSidebarViewMode),
					combatTrackerWidthRem,
				);
			}
			if (handle?.hasPointerCapture?.(event.pointerId)) {
				handle.releasePointerCapture(event.pointerId);
			}
		};

		window.addEventListener('pointermove', resizeMoveHandler);
		window.addEventListener('pointerup', resizeEndHandler, { once: true });
		window.addEventListener('pointercancel', resizeEndHandler, { once: true });
		handle?.setPointerCapture?.(event.pointerId);
	}

	let currentCombat: Combat | null = $state(null);
	// Combatants filtered to only those belonging to the current scene
	let sceneCombatants: Combatant.Implementation[] = $state([]);
	let sceneDeadCombatants: Combatant.Implementation[] = $state([]);
	let sceneGroupedStackMemberCountsByLeaderId: Map<string, number> = $state(new Map());
	let sceneGroupedStackMemberNamesByLeaderId: Map<string, string[]> = $state(new Map());
	let dragPreview: CombatantDropPreview | null = $state(null);
	let activeDragSourceId: string | null = $state(null);
	let combatantsListElement: HTMLOListElement | null = $state(null);
	let combatTrackerElement: HTMLElement | null = $state(null);
	let tempGroupPopoverElement: HTMLDivElement | null = $state(null);
	let tempGroupPopoverAnchorElement: HTMLElement | null = $state(null);
	let tempGroupPopoverState: TempGroupPopoverState | null = $state(null);
	let ncsDockHostElement: HTMLDivElement | null = $state(null);
	let combatSidebarViewMode: NcswSidebarViewMode = $state(getNcswSidebarViewMode());
	let combatSidebarWidthBounds = $derived(getSidebarWidthBoundsForViewMode(combatSidebarViewMode));
	let combatTrackerWidthRem: number = $state(COMBAT_TRACKER_MIN_WIDTH_REM);
	let combatTrackerHeightRem: number = $state(COMBAT_TRACKER_MIN_HEIGHT_REM);
	let combatTrackerLocation: CombatTrackerLocation = $state(getCombatTrackerLocation());
	let isHorizontalLayout = $derived(isHorizontalCombatTrackerLocation(combatTrackerLocation));
	let combatHasStarted = $derived.by(() => {
		const versionSnapshot = version;
		return versionSnapshot >= 0 && (currentCombat?.round ?? 0) > 0;
	});
	let currentTurnCombatant = $derived.by(() => {
		const versionSnapshot = version;
		return versionSnapshot >= 0 ? (currentCombat?.combatant ?? null) : null;
	});
	let canCurrentUserEndCurrentTurn = $derived.by(() => {
		if (!combatHasStarted) return false;
		if (!currentTurnCombatant) return false;
		if (game.user?.isGM) return true;
		if (currentTurnCombatant.type !== 'character') return false;

		return currentTurnCombatant.actor?.testUserPermission(game.user!, 'OWNER') ?? false;
	});
	let showHorizontalFloatingEndTurn = $derived(
		combatSidebarViewMode === 'combatTracker' && isHorizontalLayout && combatHasStarted,
	);
	let combatTrackerActiveHorizontalHeightBufferRem = $derived(
		combatHasStarted && isHorizontalLayout
			? Math.max(
					COMBAT_TRACKER_ACTIVE_HORIZONTAL_HEIGHT_BUFFER_MIN_REM,
					combatTrackerHeightRem * COMBAT_TRACKER_ACTIVE_HORIZONTAL_HEIGHT_BUFFER_RATIO,
				)
			: 0,
	);
	let combatTrackerDisplayedHeightRem = $derived(
		combatTrackerHeightRem + combatTrackerActiveHorizontalHeightBufferRem,
	);
	let combatTrackerDisplayedMaxHeightRem = $derived(
		combatHasStarted && isHorizontalLayout
			? COMBAT_TRACKER_MAX_HEIGHT_REM +
					Math.max(
						COMBAT_TRACKER_ACTIVE_HORIZONTAL_HEIGHT_BUFFER_MIN_REM,
						COMBAT_TRACKER_MAX_HEIGHT_REM * COMBAT_TRACKER_ACTIVE_HORIZONTAL_HEIGHT_BUFFER_RATIO,
					)
			: COMBAT_TRACKER_MAX_HEIGHT_REM,
	);
	let combatTrackerHorizontalCardWidthRem = $derived(
		combatTrackerHeightRem * COMBAT_TRACKER_HEIGHT_TO_CARD_WIDTH_RATIO,
	);
	let combatTrackerScaleSizeRem = $derived(
		isHorizontalLayout ? combatTrackerHorizontalCardWidthRem : combatTrackerWidthRem,
	);
	let combatTrackerScale = $derived(combatTrackerScaleSizeRem / COMBAT_TRACKER_MIN_WIDTH_REM);
	let trackerTransitionAxis: 'x' | 'y' = $derived(isHorizontalLayout ? 'y' : 'x');
	let currentTurnAnimationSettings: CurrentTurnAnimationSettings = $state(
		getCurrentTurnAnimationSettings(),
	);
	let pulseAnimationDurationSeconds = $derived(
		sliderToRange(
			currentTurnAnimationSettings.pulseSpeed,
			PULSE_DURATION_MAX_SECONDS,
			PULSE_DURATION_MIN_SECONDS,
		),
	);
	let borderGlowScale = $derived(
		sliderToRange(currentTurnAnimationSettings.borderGlowSize, GLOW_SCALE_MIN, GLOW_SCALE_MAX),
	);
	let edgeCrawlerSizeScale = $derived(
		sliderToRange(
			currentTurnAnimationSettings.edgeCrawlerSize,
			EDGE_CRAWLER_SIZE_MIN,
			EDGE_CRAWLER_SIZE_MAX,
		),
	);
	let floatingEndTurnButtonElement: HTMLButtonElement | null = $state(null);
	let floatingEndTurnButtonStyle = $state('left: 50vw; top: 50vh;');
	let isResizing = $state(false);
	let resizeMoveHandler: ((event: PointerEvent) => void) | undefined;
	let resizeEndHandler: ((event: PointerEvent) => void) | undefined;
	let floatingEndTurnPositionFrameHandle: number | undefined;
	// Version counter to force re-renders when combat data changes
	// (since the Combat object reference may stay the same)
	let version = $state(0);

	let createCombatHook: number | undefined;
	let deleteCombatHook: number | undefined;
	let updateCombatHook: number | undefined;
	let createCombatantHook: number | undefined;
	let deleteCombatantHook: number | undefined;
	let updateCombatantHook: number | undefined;
	let renderSceneNavigationHook: number | undefined;
	let canvasReadyHook: number | undefined;
	let canvasTearDownHook: number | undefined;
	let updateSceneHook: number | undefined;
	let pendingEmptyCombatPromptIds = new Set<string>();
	let updateSettingHook: number | undefined;
	let resizeWindowHandler: (() => void) | undefined;
	let windowScrollHandler: (() => void) | undefined;

	function unregisterHookIfDefined(eventName: Hooks.HookName, hookId: number | undefined): void {
		if (hookId === undefined) return;
		Hooks.off(eventName, hookId);
	}

	function clearFloatingEndTurnPositionFrame(): void {
		if (floatingEndTurnPositionFrameHandle === undefined) return;
		cancelAnimationFrame(floatingEndTurnPositionFrameHandle);
		floatingEndTurnPositionFrameHandle = undefined;
	}

	function removeCombatTrackerWindowListeners(): void {
		window.removeEventListener('dragend', handleCombatantDragEnd);
		window.removeEventListener('nimble-combatant-dragstart', handleCombatantDragStart);
		window.removeEventListener('nimble-combatant-dragend', handleCombatantDragEnd);
		window.removeEventListener(
			'nimble-combat-tracker-animation-settings-preview',
			handleCurrentTurnAnimationSettingsPreview,
		);
		window.removeEventListener(
			'nimble-combat-tracker-location-preview',
			handleCombatTrackerLocationPreview,
		);
		if (resizeWindowHandler) window.removeEventListener('resize', resizeWindowHandler);
		if (windowScrollHandler) window.removeEventListener('scroll', windowScrollHandler, true);
	}

	function removeCombatTrackerHooks(): void {
		unregisterHookIfDefined('createCombat', createCombatHook);
		unregisterHookIfDefined('deleteCombat', deleteCombatHook);
		unregisterHookIfDefined('updateCombat', updateCombatHook);
		unregisterHookIfDefined('createCombatant', createCombatantHook);
		unregisterHookIfDefined('deleteCombatant', deleteCombatantHook);
		unregisterHookIfDefined('updateCombatant', updateCombatantHook);
		unregisterHookIfDefined('renderSceneNavigation', renderSceneNavigationHook);
		unregisterHookIfDefined('canvasReady', canvasReadyHook);
		unregisterHookIfDefined('canvasTearDown', canvasTearDownHook);
		unregisterHookIfDefined('updateScene', updateSceneHook);
		unregisterHookIfDefined('updateSetting', updateSettingHook);
	}

	onMount(() => {
		combatSidebarViewMode = readStoredSidebarViewMode();
		setNcswSidebarViewMode(combatSidebarViewMode);
		const startingWidthBounds = getSidebarWidthBoundsForViewMode(combatSidebarViewMode);
		combatTrackerWidthRem = readStoredCombatTrackerSize(
			getSidebarWidthStorageKey(combatSidebarViewMode),
			startingWidthBounds.min,
			startingWidthBounds.max,
		);
		combatTrackerHeightRem = readStoredCombatTrackerSize(
			COMBAT_TRACKER_HEIGHT_STORAGE_KEY,
			COMBAT_TRACKER_MIN_HEIGHT_REM,
			COMBAT_TRACKER_MAX_HEIGHT_REM,
		);
		updateCurrentCombat();
		updateCurrentTurnAnimationSettings();
		updateCombatTrackerLocation();
		window.addEventListener('dragend', handleCombatantDragEnd);
		window.addEventListener('nimble-combatant-dragstart', handleCombatantDragStart);
		window.addEventListener('nimble-combatant-dragend', handleCombatantDragEnd);
		window.addEventListener(
			'nimble-combat-tracker-animation-settings-preview',
			handleCurrentTurnAnimationSettingsPreview,
		);
		window.addEventListener(
			'nimble-combat-tracker-location-preview',
			handleCombatTrackerLocationPreview,
		);
		resizeWindowHandler = () => {
			updateCombatTrackerSceneReserveInsets();
			scheduleFloatingEndTurnPositionUpdate();
			updateTempGroupPopoverPosition();
		};
		window.addEventListener('resize', resizeWindowHandler);
		windowScrollHandler = () => {
			scheduleFloatingEndTurnPositionUpdate();
			updateTempGroupPopoverPosition();
		};
		window.addEventListener('scroll', windowScrollHandler, true);

		createCombatHook = Hooks.on('createCombat', (_combat) => {
			updateCurrentCombat();
		});

		deleteCombatHook = Hooks.on('deleteCombat', (_combat) => {
			updateCurrentCombat();
		});

		updateCombatHook = Hooks.on('updateCombat', (_combat) => {
			updateCurrentCombat();
		});

		// Some cores fire a dedicated hook when combat begins; ensure we update for that too.
		const combatStartHook = Hooks.on('combatStart', () => {
			updateCurrentCombat();
		});

		createCombatantHook = Hooks.on('createCombatant', () => {
			updateCurrentCombat();
		});

		deleteCombatantHook = Hooks.on('deleteCombatant', (combatant: Combatant.Implementation) => {
			updateCurrentCombat();

			const parentCombatId = combatant.parent?.id;
			if (!parentCombatId) return;
			if (parentCombatId !== currentCombat?.id) return;

			scheduleEmptyCombatPrompt(parentCombatId);
		});

		updateCombatantHook = Hooks.on('updateCombatant', () => {
			updateCurrentCombat();
		});

		renderSceneNavigationHook = Hooks.on('renderSceneNavigation', () => {
			updateCurrentCombat();
		});

		canvasReadyHook = Hooks.on('canvasReady', () => {
			updateCurrentCombat();
		});

		// Clear combat tracker when leaving a scene
		canvasTearDownHook = Hooks.on('canvasTearDown', () => {
			currentCombat = null;
			sceneCombatants = [];
			sceneDeadCombatants = [];
			sceneGroupedStackMemberCountsByLeaderId = new Map();
			sceneGroupedStackMemberNamesByLeaderId = new Map();
			hideTempGroupPopover();
			version++;
		});

		// Update when a scene is activated or viewed
		updateSceneHook = Hooks.on('updateScene', () => {
			updateCurrentCombat();
		});

		updateSettingHook = Hooks.on('updateSetting', (setting) => {
			const settingKey = foundry.utils.getProperty(setting, 'key');
			if (isCurrentTurnAnimationSettingKey(settingKey)) {
				updateCurrentTurnAnimationSettings();
			}
			if (isCombatTrackerLocationSettingKey(settingKey)) {
				updateCombatTrackerLocation();
			}
		});

		return () => Hooks.off('combatStart', combatStartHook);
	});

	onDestroy(() => {
		setNcswDockHostElement(null);
		setNcswSidebarViewMode('combatTracker');
		stopResizeTracking();
		clearCombatTrackerSceneReserveInsets();
		hideTempGroupPopover();
		clearFloatingEndTurnPositionFrame();
		removeCombatTrackerWindowListeners();
		removeCombatTrackerHooks();
	});

	$effect(() => {
		if (isHorizontalLayout) return;
		combatTrackerWidthRem = clampNumber(
			combatTrackerWidthRem,
			combatSidebarWidthBounds.min,
			combatSidebarWidthBounds.max,
		);
	});

	$effect(() => {
		setNcswSidebarViewMode(combatSidebarViewMode);
		if (combatSidebarViewMode === 'ncs' && ncsDockHostElement) {
			setNcswDockHostElement(ncsDockHostElement);
			return;
		}
		setNcswDockHostElement(null);
	});

	$effect(() => {
		updateCombatTrackerSceneReserveInsets();
	});

	$effect(() => {
		scheduleFloatingEndTurnPositionUpdate(
			`${version}:${combatTrackerLocation}:${combatTrackerWidthRem}:${combatTrackerHeightRem}:${showHorizontalFloatingEndTurn}:${currentTurnCombatant?.id ?? ''}:${floatingEndTurnButtonElement ? '1' : '0'}:${combatantsListElement ? '1' : '0'}:${combatTrackerElement ? '1' : '0'}`,
		);
		updateTempGroupPopoverPosition();
	});

	$effect(() => {
		if (!tempGroupPopoverState) return;
		if (!sceneGroupedStackMemberNamesByLeaderId.has(tempGroupPopoverState.leaderId)) {
			hideTempGroupPopover();
			return;
		}
		queueMicrotask(() => {
			updateTempGroupPopoverPosition();
		});
	});
</script>

{#if currentCombat}
	<section
		bind:this={combatTrackerElement}
		class="nimble-combat-tracker"
		class:nimble-combat-tracker--location-left={combatTrackerLocation === 'left'}
		class:nimble-combat-tracker--location-right={combatTrackerLocation === 'right'}
		class:nimble-combat-tracker--location-top={combatTrackerLocation === 'top'}
		class:nimble-combat-tracker--location-bottom={combatTrackerLocation === 'bottom'}
		class:nimble-combat-tracker--combat-started={combatHasStarted}
		class:nimble-combat-tracker--resizing={isResizing}
		class:nimble-combat-tracker--mode-combat-tracker={combatSidebarViewMode === 'combatTracker'}
		class:nimble-combat-tracker--mode-ncs={combatSidebarViewMode === 'ncs'}
		style={`--nimble-combat-sidebar-width: ${combatTrackerWidthRem}rem; --nimble-combat-tracker-height: ${combatTrackerDisplayedHeightRem}rem; --nimble-combat-horizontal-card-width: ${combatTrackerHorizontalCardWidthRem}rem; --nimble-combat-sidebar-min-width: ${combatSidebarWidthBounds.min}rem; --nimble-combat-sidebar-max-width: ${combatSidebarWidthBounds.max}rem; --nimble-combat-tracker-min-height: ${COMBAT_TRACKER_MIN_HEIGHT_REM}rem; --nimble-combat-tracker-max-height: ${combatTrackerDisplayedMaxHeightRem}rem; --nimble-combat-card-scale: ${combatTrackerScale}; --nimble-combat-border-glow-color: ${currentTurnAnimationSettings.borderGlowColor}; --nimble-combat-edge-crawler-color: ${currentTurnAnimationSettings.edgeCrawlerColor}; --nimble-combat-pulse-duration: ${pulseAnimationDurationSeconds}s; --nimble-combat-border-glow-scale: ${borderGlowScale}; --nimble-combat-edge-crawler-size-scale: ${edgeCrawlerSizeScale};`}
		transition:slide={{ axis: trackerTransitionAxis }}
	>
		<header
			class="nimble-combat-tracker__header"
			class:nimble-combat-tracker__header--no-controls={currentCombat?.round === 0 ||
				!game.user!.isGM}
			class:nimble-combat-tracker__header--not-started={currentCombat?.round === 0}
			in:slide={{ axis: 'y', delay: 200 }}
			out:fade={{ delay: 0 }}
		>
			{#key version}
				<div class="nimble-combat-tracker__header-top-row">
					<button
						class="nimble-combat-tracker__settings-button"
						type="button"
						aria-label="Open Combat Tracker Settings"
						data-tooltip="Combat Tracker Settings"
						data-tooltip-direction="RIGHT"
						onclick={openCombatTrackerSettings}
					>
						<i class="nimble-combat-tracker__settings-button-icon fa-solid fa-gear"></i>
					</button>

					<div class="nimble-combat-tracker__mode-toggle" role="group" aria-label="Sidebar View">
						<button
							type="button"
							class="nimble-combat-tracker__mode-toggle-button"
							class:nimble-combat-tracker__mode-toggle-button--active={combatSidebarViewMode ===
								'combatTracker'}
							aria-label="Show Combat Tracker"
							data-tooltip="Combat Tracker"
							onclick={() => setCombatSidebarMode('combatTracker')}
						>
							CT
						</button>
						<button
							type="button"
							class="nimble-combat-tracker__mode-toggle-button"
							class:nimble-combat-tracker__mode-toggle-button--active={combatSidebarViewMode === 'ncs'}
							aria-label="Show Nimble Combat System"
							data-tooltip="Nimble Combat System"
							onclick={() => setCombatSidebarMode('ncs')}
						>
							NCS
						</button>
					</div>

					{#if currentCombat?.round === 0 && game.user!.isGM}
						<div class="nimble-combat-tracker__start-actions">
							<button class="nimble-combat-tracker__start-button" onclick={startCombat}>
								Start Combat
							</button>
							<button class="nimble-combat-tracker__end-combat-button" onclick={endCombat}>
								End Combat
							</button>
						</div>
					{:else if currentCombat?.round === 0}
						<h2 class="nimble-combat-tracker__heading">Combat Not Started</h2>
					{:else}
						<h2 class="nimble-combat-tracker__heading">
							Round {currentCombat?.round}
						</h2>
					{/if}
				</div>

				{#if currentCombat?.round !== 0 && game.user!.isGM}
					<div class="nimble-combat-tracker__header-controls-row">
						<CombatTrackerControls />
					</div>
				{/if}
			{/key}
		</header>

		{#if combatSidebarViewMode === 'combatTracker'}
			<ol
				bind:this={combatantsListElement}
				class="nimble-combatants"
				class:nimble-combatants--pulse={currentTurnAnimationSettings.pulseAnimation}
				class:nimble-combatants--border-glow={currentTurnAnimationSettings.borderGlow}
				data-drag-source-id={activeDragSourceId ?? ''}
				data-drop-target-id={dragPreview?.targetId ?? ''}
				data-drop-before={dragPreview ? String(dragPreview.before) : ''}
				onscroll={() => {
					scheduleFloatingEndTurnPositionUpdate();
					updateTempGroupPopoverPosition();
				}}
				onwheel={handleHorizontalWheelScroll}
				ondragover={handleDragOver}
				ondrop={(event) => _onDrop(event)}
				out:fade={{ delay: 0 }}
			>
				{#key version}
					{#each sceneCombatants as combatant (combatant._id)}
						{@const CombatantComponent = getCombatantComponent(combatant)}
						{@const isActiveCombatant = currentCombat?.combatant?.id === combatant.id}
						{@const groupedStackMemberCount =
							sceneGroupedStackMemberCountsByLeaderId.get(combatant.id ?? '') ?? 0}

						<li
							class="nimble-combatants__item"
							class:nimble-combatants__item--active={isActiveCombatant}
							data-combatant-id={combatant.id}
							class:nimble-combatants__item--preview-gap-before={dragPreview?.targetId ===
								combatant.id && dragPreview.before}
							class:nimble-combatants__item--preview-gap-after={dragPreview?.targetId ===
								combatant.id && !dragPreview.before}
							onmouseenter={(event) => {
								if (groupedStackMemberCount > 1) {
									void showTempGroupPopover(event, combatant.id ?? '');
								}
							}}
							onmousemove={(event) => {
								if (groupedStackMemberCount > 1) {
									moveTempGroupPopover(event, combatant.id ?? '');
								}
							}}
							onmouseleave={() => {
								if (groupedStackMemberCount > 1) hideTempGroupPopover();
							}}
						>
							{#if isActiveCombatant && currentTurnAnimationSettings.edgeCrawler}
								<span class="nimble-combatants__active-crawler" aria-hidden="true"></span>
							{/if}
							{#if groupedStackMemberCount > 1}
								<span
									class="nimble-combatants__group-stack-badge"
									aria-label={`Grouped minions: ${groupedStackMemberCount}`}
								>
									x{groupedStackMemberCount}
								</span>
							{/if}
							<CombatantComponent active={isActiveCombatant} {combatant} />
						</li>
					{/each}

					{#if sceneDeadCombatants.length > 0}
						<li class="nimble-combatants__dead-divider">
							<span class="nimble-combatants__dead-label">- Dead -</span>
						</li>

						{#each sceneDeadCombatants as combatant (combatant._id)}
							{@const CombatantComponent = getCombatantComponent(combatant)}

							<li class="nimble-combatants__item">
								<CombatantComponent active={false} {combatant} />
							</li>
						{/each}
					{/if}
				{/key}
			</ol>

			{#if game.user!.isGM && sceneCombatants.some((combatant) => combatant.initiative === null)}
				<footer class="nimble-combat-tracker__footer">
					<div class="nimble-combat-tracker__footer-roll-container">
						<button
							class="nimble-combat-tracker__footer-button"
							type="button"
							aria-label="Roll All"
							data-tooltip="Roll All"
							data-tooltip-direction="UP"
							onclick={(event) => rollInitiativeForAll(event)}
						>
							<i class="fa-solid fa-users"></i>
						</button>
					</div>
				</footer>
			{/if}
		{:else}
			<section bind:this={ncsDockHostElement} class="nimble-combat-tracker__ncs-host"></section>
		{/if}

		<button
			class="nimble-combat-tracker__resize-handle"
			type="button"
			aria-label="Resize combat tracker"
			onpointerdown={startResize}
		></button>
	</section>

	{#if game.user!.isGM && tempGroupPopoverState}
		<div
			bind:this={tempGroupPopoverElement}
			class="nimble-combatants__temp-group-popover"
			style={`left: ${tempGroupPopoverState.left}px; top: ${tempGroupPopoverState.top}px;`}
		>
			<ul class="nimble-combatants__temp-group-popover-list">
				{#each tempGroupPopoverState.memberNames as memberName}
					<li class="nimble-combatants__temp-group-popover-item">{memberName}</li>
				{/each}
			</ul>
		</div>
	{/if}

	{#if showHorizontalFloatingEndTurn}
		<button
			bind:this={floatingEndTurnButtonElement}
			class="nimble-combat-tracker__floating-end-turn"
			type="button"
			aria-label="End Turn"
			style={floatingEndTurnButtonStyle}
			onclick={endCurrentTurn}
		>
			End Turn
		</button>
	{/if}
{/if}
