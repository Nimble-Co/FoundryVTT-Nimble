<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import { fade, slide } from 'svelte/transition';
	import {
		canCurrentUserReorderCombatant,
		getCombatantTypePriority,
	} from '../../utils/combatantOrdering.js';
	import { isCombatantDead } from '../../utils/isCombatantDead.js';
	import {
		getEffectiveMinionGroupLeader,
		getMinionGroupIdentityColorByLabel,
		getMinionGroupIdentityColorByLabelIndex,
		getMinionGroupId,
		getMinionGroupMemberNumber,
		getMinionGroupSummaries,
		isMinionCombatant,
		isMinionGrouped,
	} from '../../utils/minionGrouping.js';
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

	type CombatWithGrouping = CombatWithDrop & {
		createMinionGroup?: (combatantIds: string[]) => Promise<Combatant.Implementation[]>;
		addMinionsToGroup?: (
			groupId: string,
			combatantIds: string[],
		) => Promise<Combatant.Implementation[]>;
		removeMinionsFromGroups?: (combatantIds: string[]) => Promise<Combatant.Implementation[]>;
		dissolveMinionGroups?: (groupIds: string[]) => Promise<Combatant.Implementation[]>;
		updateCombatant?: (combatantID: string, updates: Record<string, unknown>) => Promise<unknown>;
	};

	interface MinionGroupDisplayData {
		groupId: string;
		leaderId: string;
		label: string | null;
		labelIndex: number | null;
		members: Combatant.Implementation[];
	}

	interface SceneCombatantLists {
		activeCombatants: Combatant.Implementation[];
		deadCombatants: Combatant.Implementation[];
		groupDisplayByLeaderId: Map<string, MinionGroupDisplayData>;
	}

	interface CombatantDropPreview {
		sourceId: string;
		targetId: string;
		before: boolean;
	}

	interface CombatantDragStartDetail {
		combatantId: string;
	}

	const COMBAT_TRACKER_MIN_WIDTH_REM = 6.5;
	const COMBAT_TRACKER_MAX_WIDTH_REM = COMBAT_TRACKER_MIN_WIDTH_REM * 2;
	const COMBAT_TRACKER_WIDTH_STORAGE_KEY = 'nimble.combatTracker.widthRem';
	const DRAG_TARGET_EXPANSION_REM = 0.9;
	const DRAG_SWITCH_UPPER_RATIO = 0.4;
	const DRAG_SWITCH_LOWER_RATIO = 0.6;
	const MINION_GROUP_DEBUG_DISABLED_KEY = 'NIMBLE_DISABLE_GROUP_LOGS';
	const GROUP_POPOVER_OFFSET_PX = 10;
	const GROUP_POPOVER_VIEWPORT_PADDING_PX = 8;
	const GROUP_POPOVER_HIDE_DELAY_MS = 120;

	function clampCombatTrackerWidth(widthRem: number): number {
		return Math.min(COMBAT_TRACKER_MAX_WIDTH_REM, Math.max(COMBAT_TRACKER_MIN_WIDTH_REM, widthRem));
	}

	function isGroupingDebugEnabled(): boolean {
		return (
			Boolean(game.user?.isGM) &&
			(globalThis as Record<string, unknown>)[MINION_GROUP_DEBUG_DISABLED_KEY] !== true
		);
	}

	function logGroupingDebug(message: string, details: Record<string, unknown> = {}) {
		if (!isGroupingDebugEnabled()) return;
		console.info(`[Nimble][MinionGrouping][UI] ${message}`, details);
	}

	function getRootFontSizePx(): number {
		const rootFontSize =
			Number.parseFloat(globalThis.getComputedStyle(document.documentElement).fontSize) || 16;
		return Number.isFinite(rootFontSize) && rootFontSize > 0 ? rootFontSize : 16;
	}

	function readStoredCombatTrackerWidth(): number {
		try {
			const storedWidth = globalThis.localStorage.getItem(COMBAT_TRACKER_WIDTH_STORAGE_KEY);
			if (!storedWidth) return COMBAT_TRACKER_MIN_WIDTH_REM;

			const parsed = Number.parseFloat(storedWidth);
			if (!Number.isFinite(parsed)) return COMBAT_TRACKER_MIN_WIDTH_REM;

			return clampCombatTrackerWidth(parsed);
		} catch (_error) {
			return COMBAT_TRACKER_MIN_WIDTH_REM;
		}
	}

	function saveCombatTrackerWidth(widthRem: number): void {
		try {
			globalThis.localStorage.setItem(COMBAT_TRACKER_WIDTH_STORAGE_KEY, String(widthRem));
		} catch (_error) {
			// No-op: local storage access may fail in some browser privacy modes.
		}
	}

	function getCombatantSceneId(combatant: Combatant.Implementation): string | undefined {
		// Try multiple ways to get the combatant's scene ID
		// 1. Direct sceneId property
		if (combatant.sceneId) return combatant.sceneId;
		// 2. Token's parent scene
		if (combatant.token?.parent?.id) return combatant.token.parent.id;
		// 3. Check if token document exists on current scene
		const sceneId = canvas.scene?.id;
		if (sceneId && combatant.tokenId) {
			const tokenDoc = canvas.scene?.tokens?.get(combatant.tokenId);
			if (tokenDoc) return sceneId;
		}
		return undefined;
	}

	function hasCombatantsForScene(combat: Combat, sceneId: string): boolean {
		return combat.combatants.contents.some((c) => getCombatantSceneId(c) === sceneId);
	}

	function getCombatantsForScene(
		combat: Combat | null,
		sceneId: string | undefined,
	): SceneCombatantLists {
		if (!sceneId || !combat) {
			return {
				activeCombatants: [],
				deadCombatants: [],
				groupDisplayByLeaderId: new Map(),
			};
		}

		const combatantsForScene = combat.combatants.contents.filter(
			(c) => getCombatantSceneId(c) === sceneId && c.visible && c._id != null,
		);
		const groupedSummaries = getMinionGroupSummaries(combatantsForScene);
		const groupDisplayByLeaderId = new Map<string, MinionGroupDisplayData>();
		const hiddenGroupMemberIds = new Set<string>();

		for (const summary of groupedSummaries.values()) {
			const leader =
				getEffectiveMinionGroupLeader(summary, { aliveOnly: true }) ??
				getEffectiveMinionGroupLeader(summary);
			if (!leader?.id) continue;

			groupDisplayByLeaderId.set(leader.id, {
				groupId: summary.id,
				leaderId: leader.id,
				label: summary.label,
				labelIndex: summary.labelIndex,
				members: summary.members,
			});

			for (const member of summary.members) {
				if (!member.id || member.id === leader.id) continue;
				hiddenGroupMemberIds.add(member.id);
			}
		}

		const turnCombatants = combat.turns.filter(
			(c) => getCombatantSceneId(c) === sceneId && c.visible && c._id != null,
		);

		const turnCombatantIds = new Set(turnCombatants.map((c) => c.id));
		const activeCombatants = turnCombatants.filter(
			(combatant) => !isCombatantDead(combatant) && !hiddenGroupMemberIds.has(combatant.id ?? ''),
		);
		const missingActiveCombatants = combatantsForScene.filter(
			(combatant) =>
				!isCombatantDead(combatant) &&
				!turnCombatantIds.has(combatant.id ?? '') &&
				!hiddenGroupMemberIds.has(combatant.id ?? ''),
		);

		const deadCombatants = combatantsForScene
			.filter(
				(combatant) => isCombatantDead(combatant) && !hiddenGroupMemberIds.has(combatant.id ?? ''),
			)
			.sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''));

		return {
			activeCombatants: [...activeCombatants, ...missingActiveCombatants],
			deadCombatants,
			groupDisplayByLeaderId,
		};
	}

	function getCombatForCurrentScene(): Combat | null {
		const sceneId = canvas.scene?.id;
		if (!sceneId) return null;

		// Prefer the active combat for this scene, even if it currently has no combatants.
		const activeCombat = game.combat;
		if (activeCombat?.active && activeCombat.scene?.id === sceneId) {
			return activeCombat;
		}

		// Next, use the viewed combat for this scene when present.
		const viewedCombat = game.combats.viewed ?? null;
		if (viewedCombat?.scene?.id === sceneId) {
			return viewedCombat;
		}

		// Otherwise return the first combat that has combatants for this scene.
		const combatsForScene = game.combats.contents.filter((combat) =>
			hasCombatantsForScene(combat, sceneId),
		);
		return combatsForScene[0] ?? null;
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

	function getGroupMemberCode(
		member: Combatant.Implementation,
		groupLabel: string | null | undefined,
		fallbackIndex: number,
	): string {
		const label = groupLabel?.trim().toUpperCase() ?? '?';
		const memberNumber = getMinionGroupMemberNumber(member) ?? fallbackIndex + 1;
		return `${label}${memberNumber}`;
	}

	function getGroupIdentityStyle(
		label: string | null | undefined,
		labelIndex: number | null | undefined,
	): string {
		const accentColor =
			typeof labelIndex === 'number'
				? getMinionGroupIdentityColorByLabelIndex(labelIndex)
				: getMinionGroupIdentityColorByLabel(label);
		return `--nimble-group-accent: ${accentColor};`;
	}

	function applyOptimisticMemberKillState(combatantId: string): void {
		if (!hoveredGroupDisplay || !combatantId) return;

		let didUpdateMember = false;
		const members = hoveredGroupDisplay.members.map((member) => {
			if (member.id !== combatantId) return member;

			didUpdateMember = true;
			const nextMember = {
				...member,
				defeated: true,
			} as Combatant.Implementation;

			if (member.actor) {
				const actorClone = foundry.utils.deepClone(member.actor) as Actor.Implementation;
				foundry.utils.setProperty(actorClone, 'system.attributes.hp.value', 0);
				(nextMember as unknown as { actor?: Actor.Implementation | null }).actor = actorClone;
			}

			return nextMember;
		});

		if (!didUpdateMember) return;
		hoveredGroupDisplay = {
			...hoveredGroupDisplay,
			members,
		};
	}

	function clearGroupPopoverHideTimer() {
		if (groupPopoverHideTimer !== undefined) {
			window.clearTimeout(groupPopoverHideTimer);
			groupPopoverHideTimer = undefined;
		}
	}

	function closeGroupPopover() {
		clearGroupPopoverHideTimer();
		hoveredGroupLeaderId = null;
		hoveredGroupDisplay = null;
	}

	function getCombatantItemSurfaceById(combatantId: string): HTMLElement | null {
		if (!combatantsListElement || !combatantId) return null;

		for (const item of combatantsListElement.querySelectorAll<HTMLElement>(
			'.nimble-combatants__item',
		)) {
			if (item.dataset.combatantId !== combatantId) continue;
			return item.querySelector<HTMLElement>('.nimble-combatants__item-surface');
		}

		return null;
	}

	function updateGroupPopoverPosition() {
		if (!hoveredGroupLeaderId || !hoveredGroupDisplay) return;

		const anchor = getCombatantItemSurfaceById(hoveredGroupLeaderId);
		if (!anchor) {
			closeGroupPopover();
			return;
		}

		const anchorRect = anchor.getBoundingClientRect();
		const popoverWidth = groupPopoverElement?.offsetWidth ?? 260;
		const popoverHeight = groupPopoverElement?.offsetHeight ?? 0;

		let left = anchorRect.right + GROUP_POPOVER_OFFSET_PX;
		if (left + popoverWidth > window.innerWidth - GROUP_POPOVER_VIEWPORT_PADDING_PX) {
			left = Math.max(
				GROUP_POPOVER_VIEWPORT_PADDING_PX,
				anchorRect.left - GROUP_POPOVER_OFFSET_PX - popoverWidth,
			);
		}

		let top = Math.max(GROUP_POPOVER_VIEWPORT_PADDING_PX, anchorRect.top);
		if (popoverHeight > 0) {
			const maxTop = window.innerHeight - GROUP_POPOVER_VIEWPORT_PADDING_PX - popoverHeight;
			top = Math.min(top, Math.max(GROUP_POPOVER_VIEWPORT_PADDING_PX, maxTop));
		}

		groupPopoverLeftPx = Math.round(left);
		groupPopoverTopPx = Math.round(top);
	}

	function scheduleCloseGroupPopover() {
		clearGroupPopoverHideTimer();
		groupPopoverHideTimer = window.setTimeout(() => {
			closeGroupPopover();
		}, GROUP_POPOVER_HIDE_DELAY_MS);
	}

	function openGroupPopover(
		leaderId: string | undefined,
		groupDisplay: MinionGroupDisplayData | undefined,
	) {
		if (!leaderId || !groupDisplay) return;

		clearGroupPopoverHideTimer();
		hoveredGroupLeaderId = leaderId;
		hoveredGroupDisplay = groupDisplay;
		updateGroupPopoverPosition();
		queueMicrotask(() => {
			updateGroupPopoverPosition();
		});
	}

	function handleGroupCardPointerEnter(
		_event: PointerEvent,
		leaderId: string | undefined,
		groupDisplay: MinionGroupDisplayData | undefined,
	) {
		openGroupPopover(leaderId, groupDisplay);
	}

	function handleGroupCardPointerLeave() {
		scheduleCloseGroupPopover();
	}

	function handleGroupCardFocusIn(
		_event: FocusEvent,
		leaderId: string | undefined,
		groupDisplay: MinionGroupDisplayData | undefined,
	) {
		openGroupPopover(leaderId, groupDisplay);
	}

	function handleGroupCardFocusOut() {
		scheduleCloseGroupPopover();
	}

	function handleGroupPopoverPointerEnter() {
		clearGroupPopoverHideTimer();
	}

	function handleGroupPopoverPointerLeave() {
		scheduleCloseGroupPopover();
	}

	function handleGroupPopoverFocusIn() {
		clearGroupPopoverHideTimer();
	}

	function handleGroupPopoverFocusOut(event: FocusEvent) {
		const popover = event.currentTarget instanceof HTMLElement ? event.currentTarget : null;
		const nextFocused = event.relatedTarget;
		if (popover && nextFocused instanceof Node && popover.contains(nextFocused)) return;

		// Keep the panel open during mouse interaction even if focus shifts while rows update.
		if (popover?.matches(':hover')) {
			clearGroupPopoverHideTimer();
			return;
		}

		scheduleCloseGroupPopover();
	}

	function handleCombatantsScroll() {
		if (!hoveredGroupDisplay) return;
		updateGroupPopoverPosition();
	}

	function handleWindowResize() {
		if (!hoveredGroupDisplay) return;
		updateGroupPopoverPosition();
	}

	function clearSelectedCombatants() {
		selectedCombatantIds = [];
	}

	function setSelectedCombatantIds(ids: string[]) {
		selectedCombatantIds = [...new Set(ids.filter((id) => id.length > 0))];
	}

	function pruneSelectedCombatants(combat: Combat | null) {
		if (!combat) {
			clearSelectedCombatants();
			return;
		}

		const validIds = new Set(
			combat.combatants.contents
				.map((combatant) => combatant.id)
				.filter((id): id is string => typeof id === 'string' && id.length > 0),
		);
		setSelectedCombatantIds(selectedCombatantIds.filter((id) => validIds.has(id)));
	}

	function updateCurrentCombat() {
		// Use queueMicrotask to ensure Foundry's data is fully updated
		// before we read it, and to batch Svelte's reactivity updates
		queueMicrotask(() => {
			const combat = getCombatForCurrentScene();
			const sceneId = canvas.scene?.id;
			const { activeCombatants, deadCombatants, groupDisplayByLeaderId } = getCombatantsForScene(
				combat,
				sceneId,
			);
			currentCombat = combat;
			sceneCombatants = activeCombatants;
			sceneDeadCombatants = deadCombatants;
			sceneMinionGroupDisplayByLeaderId = groupDisplayByLeaderId;
			if (hoveredGroupDisplay) {
				if (hoveredGroupLeaderId) {
					const matchingGroupByLeader = groupDisplayByLeaderId.get(hoveredGroupLeaderId);
					if (matchingGroupByLeader) {
						hoveredGroupDisplay = matchingGroupByLeader;
						queueMicrotask(() => updateGroupPopoverPosition());
					} else {
						const replacementGroup = [...groupDisplayByLeaderId.values()].find(
							(group) => group.groupId === hoveredGroupDisplay?.groupId,
						);
						if (replacementGroup) {
							hoveredGroupLeaderId = replacementGroup.leaderId;
							hoveredGroupDisplay = replacementGroup;
							queueMicrotask(() => updateGroupPopoverPosition());
						} else {
							closeGroupPopover();
						}
					}
				} else {
					closeGroupPopover();
				}
			}
			pruneSelectedCombatants(combat);
			logGroupingDebug('Combat tracker state updated', {
				combatId: combat?.id ?? null,
				round: combat?.round ?? null,
				activeCombatants: activeCombatants.length,
				deadCombatants: deadCombatants.length,
				groupCount: groupDisplayByLeaderId.size,
				selectedCombatants: selectedCombatantIds,
			});
			version++;
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

	function getPreviewTargetFromPointer(
		clientY: number,
		source: Combatant.Implementation,
	): { target: Combatant.Implementation; before: boolean } | null {
		if (!combatantsListElement) return null;

		const sourcePriority = getCombatantTypePriority(source);
		const candidates = sceneCombatants.filter(
			(combatant) =>
				combatant.id !== source.id &&
				!isCombatantDead(combatant) &&
				getCombatantTypePriority(combatant) === sourcePriority,
		);
		if (candidates.length === 0) return null;

		const expansionPx = getDragTargetExpansionPx();
		let bestTarget: Combatant.Implementation | null = null;
		let bestRect: DOMRect | null = null;
		let bestDistance = Number.POSITIVE_INFINITY;

		for (const candidate of candidates) {
			const row = combatantsListElement.querySelector<HTMLElement>(
				`.nimble-combatants__item[data-combatant-id="${candidate.id}"]`,
			);
			if (!row) continue;

			const rect = row.getBoundingClientRect();
			const expandedTop = rect.top - expansionPx;
			const expandedBottom = rect.bottom + expansionPx;

			const distance =
				clientY < expandedTop
					? expandedTop - clientY
					: clientY > expandedBottom
						? clientY - expandedBottom
						: 0;

			if (distance < bestDistance) {
				bestDistance = distance;
				bestTarget = candidate;
				bestRect = rect;
			}
		}

		if (!bestTarget || !bestRect) return null;

		const relativeY = (clientY - bestRect.top) / Math.max(1, bestRect.height);
		let before: boolean;

		if (relativeY <= DRAG_SWITCH_UPPER_RATIO) {
			before = true;
		} else if (relativeY >= DRAG_SWITCH_LOWER_RATIO) {
			before = false;
		} else if (dragPreview?.targetId === bestTarget.id) {
			before = dragPreview.before;
		} else {
			before = relativeY < 0.5;
		}

		return { target: bestTarget, before };
	}

	function getDragPreview(event: DragEvent): CombatantDropPreview | null {
		if (!currentCombat) return null;
		if (!activeDragSourceId) return null;

		const source = currentCombat.combatants.get(activeDragSourceId);
		if (!source?.id) return null;
		if (source.parent?.id !== currentCombat.id) return null;
		if (isCombatantDead(source)) return null;
		if (!canCurrentUserReorderCombatant(source)) return null;

		const pointerTarget = getPreviewTargetFromPointer(event.clientY, source);
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

	function isInteractiveTarget(target: EventTarget | null): boolean {
		if (!(target instanceof Element)) return false;

		if (target.closest('.nimble-combatants__group-popover')) return true;

		const interactiveElement = target.closest(
			'button, a, input, select, textarea, summary, details, [contenteditable="true"]',
		);

		return Boolean(interactiveElement);
	}

	function handleCombatantCardKeyDown(event: KeyboardEvent, combatant: Combatant.Implementation) {
		if (event.key !== 'Enter' && event.key !== ' ') return;
		if (!game.user?.isGM) return;
		if (!groupModeEnabled) return;
		if (!combatant.id || !isMinionCombatant(combatant)) return;

		event.preventDefault();
		event.stopPropagation();

		const nextSelection = new Set(selectedCombatantIds);
		if (nextSelection.has(combatant.id)) nextSelection.delete(combatant.id);
		else nextSelection.add(combatant.id);
		setSelectedCombatantIds([...nextSelection]);
	}

	function handleCombatantCardClick(event: MouseEvent, combatant: Combatant.Implementation) {
		if (!game.user?.isGM) {
			logGroupingDebug('Ignored card click because user is not GM', {
				combatantId: combatant.id ?? null,
				combatantName: getCombatantDisplayName(combatant),
			});
			return;
		}
		if (event.button !== 0) return;
		if (isInteractiveTarget(event.target)) {
			logGroupingDebug('Ignored card click because target is interactive control', {
				combatantId: combatant.id ?? null,
				combatantName: getCombatantDisplayName(combatant),
			});
			return;
		}

		const hasSelectionModifier = event.ctrlKey || event.metaKey;
		if (!groupModeEnabled && !hasSelectionModifier) {
			logGroupingDebug(
				'Ignored card click because Group Mode is off and no Ctrl/Cmd modifier was used',
				{
					combatantId: combatant.id ?? null,
					combatantName: getCombatantDisplayName(combatant),
				},
			);
			return;
		}
		if (!combatant.id || !isMinionCombatant(combatant)) {
			logGroupingDebug('Ignored card click because combatant is not a minion', {
				combatantId: combatant.id ?? null,
				combatantName: getCombatantDisplayName(combatant),
				actorType: combatant.actor?.type ?? null,
			});
			return;
		}

		event.preventDefault();
		event.stopPropagation();

		const nextSelection = new Set(selectedCombatantIds);
		if (nextSelection.has(combatant.id)) nextSelection.delete(combatant.id);
		else nextSelection.add(combatant.id);
		setSelectedCombatantIds([...nextSelection]);
		logGroupingDebug('Toggled minion selection via click', {
			combatantId: combatant.id,
			combatantName: getCombatantDisplayName(combatant),
			selectedCombatantIds: [...nextSelection],
			groupModeEnabled,
		});
	}

	function handleCombatantCardContextMenu(event: MouseEvent, combatant: Combatant.Implementation) {
		if (!game.user?.isGM || !groupModeEnabled) return;
		if (isInteractiveTarget(event.target)) return;
		if (!combatant.id || !isMinionCombatant(combatant)) {
			logGroupingDebug('Ignored context selection because combatant is not a minion', {
				combatantId: combatant.id ?? null,
				combatantName: getCombatantDisplayName(combatant),
				actorType: combatant.actor?.type ?? null,
			});
			return;
		}

		event.preventDefault();
		event.stopPropagation();

		const nextSelection = new Set(selectedCombatantIds);
		if (nextSelection.has(combatant.id)) nextSelection.delete(combatant.id);
		else nextSelection.add(combatant.id);
		setSelectedCombatantIds([...nextSelection]);
		logGroupingDebug('Toggled minion selection via context menu', {
			combatantId: combatant.id,
			combatantName: getCombatantDisplayName(combatant),
			selectedCombatantIds: [...nextSelection],
		});
	}

	function toggleGroupMode(event: MouseEvent) {
		event.preventDefault();
		groupModeEnabled = !groupModeEnabled;
		if (!groupModeEnabled) clearSelectedCombatants();
		logGroupingDebug('Group mode toggled', {
			groupModeEnabled,
			selectedCombatantIds,
		});
	}

	async function createGroupFromSelection(event: MouseEvent) {
		event.preventDefault();
		event.stopPropagation();
		if (!canCreateMinionGroup) {
			logGroupingDebug('Create Group blocked', {
				selectedMinions: selectedMinions.length,
				selectedUngroupedMinions: selectedUngroupedMinions.length,
				selectedGroupedMinions: selectedGroupedMinions.length,
				selectedCombatantIds,
			});
			return;
		}

		const combat = currentCombat as CombatWithGrouping | null;
		if (typeof combat?.createMinionGroup !== 'function') return;

		const targetIds = selectedUngroupedMinions
			.map((combatant) => combatant.id)
			.filter((id): id is string => !!id);

		logGroupingDebug('Create Group requested', { targetIds });
		await combat.createMinionGroup(targetIds);
		clearSelectedCombatants();
		updateCurrentCombat();
		logGroupingDebug('Create Group completed', { targetIds });
	}

	async function addSelectionToExistingGroup(event: MouseEvent) {
		event.preventDefault();
		event.stopPropagation();
		if (!canAddSelectedToGroup || !selectionGroupTargetId) {
			logGroupingDebug('Add to Group blocked', {
				selectionGroupTargetId,
				selectedUngroupedMinions: selectedUngroupedMinions.length,
				selectedGroupedMinions: selectedGroupedMinions.length,
				selectedCombatantIds,
			});
			return;
		}

		const combat = currentCombat as CombatWithGrouping | null;
		if (typeof combat?.addMinionsToGroup !== 'function') return;

		const targetIds = selectedUngroupedMinions
			.map((combatant) => combatant.id)
			.filter((id): id is string => !!id);

		logGroupingDebug('Add to Group requested', {
			groupId: selectionGroupTargetId,
			targetIds,
		});
		await combat.addMinionsToGroup(selectionGroupTargetId, targetIds);
		clearSelectedCombatants();
		updateCurrentCombat();
		logGroupingDebug('Add to Group completed', {
			groupId: selectionGroupTargetId,
			targetIds,
		});
	}

	async function dissolveAllGroups(event: MouseEvent) {
		event.preventDefault();
		event.stopPropagation();
		if (!canUngroupAll) {
			logGroupingDebug('Ungroup All blocked because no groups are present in this tracker', {
				groupCount: sceneMinionGroupDisplayByLeaderId.size,
			});
			return;
		}

		const combat = currentCombat as CombatWithGrouping | null;
		if (typeof combat?.dissolveMinionGroups !== 'function') return;

		const groupIds = [
			...new Set(
				[...sceneMinionGroupDisplayByLeaderId.values()]
					.map((groupDisplay) => groupDisplay.groupId)
					.filter((groupId): groupId is string => groupId.length > 0),
			),
		];
		if (groupIds.length === 0) return;

		logGroupingDebug('Ungroup All requested', { groupIds });
		await combat.dissolveMinionGroups(groupIds);
		clearSelectedCombatants();
		updateCurrentCombat();
		logGroupingDebug('Ungroup All completed', { groupIds });
	}

	async function dissolveSelectedGroups(event: MouseEvent) {
		event.preventDefault();
		event.stopPropagation();
		if (!canDissolveSelection) {
			logGroupingDebug('Dissolve blocked because no groups are selected', {
				selectedCombatantIds,
			});
			return;
		}

		const combat = currentCombat as CombatWithGrouping | null;
		if (typeof combat?.dissolveMinionGroups !== 'function') return;

		logGroupingDebug('Dissolve selected groups requested', { selectedGroupIds });
		await combat.dissolveMinionGroups(selectedGroupIds);
		clearSelectedCombatants();
		updateCurrentCombat();
		logGroupingDebug('Dissolve selected groups completed', { selectedGroupIds });
	}

	async function removeMemberFromGroup(event: MouseEvent, combatantId: string) {
		event.preventDefault();
		event.stopPropagation();
		if (!combatantId) return;

		const combat = currentCombat as CombatWithGrouping | null;
		if (typeof combat?.removeMinionsFromGroups !== 'function') return;

		logGroupingDebug('Remove member requested', { combatantId });
		await combat.removeMinionsFromGroups([combatantId]);
		setSelectedCombatantIds(selectedCombatantIds.filter((id) => id !== combatantId));
		updateCurrentCombat();
		logGroupingDebug('Remove member completed', { combatantId });
	}

	async function killMember(event: MouseEvent, combatant: Combatant.Implementation) {
		event.preventDefault();
		event.stopPropagation();
		if (!game.user?.isGM) return;
		if (!combatant.id) return;
		if (isCombatantDead(combatant)) return;

		const combat = currentCombat as CombatWithGrouping | null;
		const hpPath = 'system.attributes.hp.value';
		applyOptimisticMemberKillState(combatant.id);

		logGroupingDebug('Kill member requested', {
			combatantId: combatant.id,
			combatantName: getCombatantDisplayName(combatant),
		});

		if (combatant.actor) {
			await combatant.actor.update({ [hpPath]: 0 } as Record<string, unknown>);
		}

		if (typeof combat?.updateCombatant === 'function') {
			await combat.updateCombatant(combatant.id, {
				defeated: true,
				'system.actions.base.current': 0,
			});
		} else {
			await combatant.update({
				defeated: true,
				'system.actions.base.current': 0,
			} as Record<string, unknown>);
		}

		updateCurrentCombat();
		queueMicrotask(() => updateCurrentCombat());
		logGroupingDebug('Kill member completed', {
			combatantId: combatant.id,
			combatantName: getCombatantDisplayName(combatant),
		});
	}

	async function dissolveGroup(event: MouseEvent, groupId: string) {
		event.preventDefault();
		event.stopPropagation();
		if (!groupId) return;

		const combat = currentCombat as CombatWithGrouping | null;
		if (typeof combat?.dissolveMinionGroups !== 'function') return;

		logGroupingDebug('Dissolve group requested', { groupId });
		await combat.dissolveMinionGroups([groupId]);
		updateCurrentCombat();
		logGroupingDebug('Dissolve group completed', { groupId });
	}

	function rollInitiativeForAll(event: MouseEvent) {
		event.preventDefault();
		currentCombat?.rollAll();
	}

	function startCombat(event: MouseEvent): Promise<Combat> | undefined {
		event.preventDefault();
		return currentCombat?.startCombat();
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
	}

	function startResize(event: PointerEvent) {
		event.preventDefault();

		const handle = event.currentTarget as HTMLElement | null;
		const startX = event.clientX;
		const startWidthRem = combatTrackerWidthRem;
		const rootFontSizePx = getRootFontSizePx();

		stopResizeTracking();

		resizeMoveHandler = (moveEvent: PointerEvent) => {
			const deltaRem = (moveEvent.clientX - startX) / rootFontSizePx;
			combatTrackerWidthRem = clampCombatTrackerWidth(startWidthRem + deltaRem);
		};

		resizeEndHandler = () => {
			stopResizeTracking();
			saveCombatTrackerWidth(combatTrackerWidthRem);
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
	let sceneMinionGroupDisplayByLeaderId: Map<string, MinionGroupDisplayData> = $state(new Map());
	let groupModeEnabled: boolean = $state(false);
	let selectedCombatantIds: string[] = $state([]);
	let dragPreview: CombatantDropPreview | null = $state(null);
	let activeDragSourceId: string | null = $state(null);
	let combatantsListElement: HTMLOListElement | null = $state(null);
	let groupPopoverElement: HTMLDivElement | null = $state(null);
	let combatTrackerWidthRem: number = $state(COMBAT_TRACKER_MIN_WIDTH_REM);
	let combatTrackerScale = $derived(combatTrackerWidthRem / COMBAT_TRACKER_MIN_WIDTH_REM);
	let hoveredGroupLeaderId: string | null = $state(null);
	let hoveredGroupDisplay: MinionGroupDisplayData | null = $state(null);
	let groupPopoverLeftPx: number = $state(0);
	let groupPopoverTopPx: number = $state(0);
	let groupPopoverHideTimer: ReturnType<typeof window.setTimeout> | undefined;
	let resizeMoveHandler: ((event: PointerEvent) => void) | undefined;
	let resizeEndHandler: ((event: PointerEvent) => void) | undefined;
	// Version counter to force re-renders when combat data changes
	// (since the Combat object reference may stay the same)
	let version = $state(0);

	let selectedCombatants = $derived.by(() => {
		if (!currentCombat) return [] as Combatant.Implementation[];

		return selectedCombatantIds
			.map((id) => currentCombat.combatants.get(id))
			.filter((combatant): combatant is Combatant.Implementation => Boolean(combatant));
	});
	let selectedMinions = $derived(
		selectedCombatants.filter((combatant) => isMinionCombatant(combatant)),
	);
	let selectedGroupedMinions = $derived(
		selectedMinions.filter((combatant) => isMinionGrouped(combatant)),
	);
	let selectedUngroupedMinions = $derived(
		selectedMinions.filter((combatant) => !isMinionGrouped(combatant)),
	);
	let selectedGroupIds = $derived([
		...new Set(
			selectedGroupedMinions
				.map((combatant) => getMinionGroupId(combatant))
				.filter((groupId): groupId is string => typeof groupId === 'string'),
		),
	]);
	let selectionGroupTargetId = $derived(selectedGroupIds.length === 1 ? selectedGroupIds[0] : null);
	let canCreateMinionGroup = $derived(
		selectedUngroupedMinions.length >= 2 && selectedGroupedMinions.length === 0,
	);
	let canAddSelectedToGroup = $derived(
		Boolean(selectionGroupTargetId && selectedUngroupedMinions.length > 0),
	);
	let canUngroupAll = $derived(sceneMinionGroupDisplayByLeaderId.size > 0);
	let canDissolveSelection = $derived(selectedGroupIds.length > 0);
	let hasSelectedCombatants = $derived(selectedCombatantIds.length > 0);
	let hasGroupPanelActions = $derived(
		canCreateMinionGroup || canAddSelectedToGroup || canUngroupAll || canDissolveSelection,
	);

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

	onMount(() => {
		combatTrackerWidthRem = readStoredCombatTrackerWidth();
		updateCurrentCombat();
		window.addEventListener('dragend', handleCombatantDragEnd);
		window.addEventListener('nimble-combatant-dragstart', handleCombatantDragStart);
		window.addEventListener('nimble-combatant-dragend', handleCombatantDragEnd);
		window.addEventListener('resize', handleWindowResize);

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
			sceneMinionGroupDisplayByLeaderId = new Map();
			closeGroupPopover();
			clearSelectedCombatants();
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
		stopResizeTracking();
		window.removeEventListener('dragend', handleCombatantDragEnd);
		window.removeEventListener('nimble-combatant-dragstart', handleCombatantDragStart);
		window.removeEventListener('nimble-combatant-dragend', handleCombatantDragEnd);
		window.removeEventListener('resize', handleWindowResize);
		clearGroupPopoverHideTimer();

		if (createCombatHook !== undefined) Hooks.off('createCombat', createCombatHook);
		if (deleteCombatHook !== undefined) Hooks.off('deleteCombat', deleteCombatHook);
		if (updateCombatHook !== undefined) Hooks.off('updateCombat', updateCombatHook);
		if (createCombatantHook !== undefined) Hooks.off('createCombatant', createCombatantHook);
		if (deleteCombatantHook !== undefined) Hooks.off('deleteCombatant', deleteCombatantHook);
		if (updateCombatantHook !== undefined) Hooks.off('updateCombatant', updateCombatantHook);
		if (renderSceneNavigationHook !== undefined)
			Hooks.off('renderSceneNavigation', renderSceneNavigationHook);
		if (canvasReadyHook !== undefined) Hooks.off('canvasReady', canvasReadyHook);
		if (canvasTearDownHook !== undefined) Hooks.off('canvasTearDown', canvasTearDownHook);
		if (updateSceneHook !== undefined) Hooks.off('updateScene', updateSceneHook);
		if (updateSettingHook !== undefined) Hooks.off('updateSetting', updateSettingHook);
	});

	$effect(() => {
		updateCombatTrackerSceneReserveInsets();
	});

	$effect(() => {
		scheduleFloatingEndTurnPositionUpdate(
			`${version}:${combatTrackerLocation}:${combatTrackerWidthRem}:${combatTrackerHeightRem}:${showHorizontalFloatingEndTurn}:${currentTurnCombatant?.id ?? ''}:${floatingEndTurnButtonElement ? '1' : '0'}:${combatantsListElement ? '1' : '0'}:${combatTrackerElement ? '1' : '0'}`,
		);
	});

	$effect(() => {
		if (!hoveredGroupDisplay) return;
		if (!groupPopoverElement) return;

		updateGroupPopoverPosition();
	});
</script>

{#if currentCombat}
	<section
		class="nimble-combat-tracker"
		style={`--nimble-combat-sidebar-width: ${combatTrackerWidthRem}rem; --nimble-combat-sidebar-min-width: ${COMBAT_TRACKER_MIN_WIDTH_REM}rem; --nimble-combat-sidebar-max-width: ${COMBAT_TRACKER_MAX_WIDTH_REM}rem; --nimble-combat-card-scale: ${combatTrackerScale};`}
		transition:slide={{ axis: 'x' }}
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

		{#if game.user!.isGM}
			<div
				class="nimble-combat-tracker__group-controls"
				in:fade={{ delay: 100 }}
				out:fade={{ delay: 0 }}
			>
				<button
					class="nimble-combat-tracker__group-button"
					class:nimble-combat-tracker__group-button--mode={true}
					class:nimble-combat-tracker__group-button--active={groupModeEnabled}
					type="button"
					data-tooltip="Create or remove minion groups."
					onclick={toggleGroupMode}
				>
					Group Mode
				</button>

				{#if groupModeEnabled}
					<div
						class="nimble-combat-tracker__group-controls-panel"
						in:slide={{ axis: 'y', duration: 140 }}
						out:slide={{ axis: 'y', duration: 110 }}
					>
						<div class="nimble-combat-tracker__group-selection-row">
							<span class="nimble-combat-tracker__group-selection-label"
								>Selected:&nbsp;{selectedMinions.length}</span
							>
							<button
								class="nimble-combat-tracker__group-button nimble-combat-tracker__group-button--clear"
								type="button"
								disabled={!hasSelectedCombatants}
								onclick={(event) => {
									event.preventDefault();
									if (!hasSelectedCombatants) return;
									clearSelectedCombatants();
									logGroupingDebug('Selection cleared manually');
								}}
							>
								Clear
							</button>
						</div>

						{#if hasGroupPanelActions}
							<div class="nimble-combat-tracker__group-action-row">
								{#if canCreateMinionGroup}
									<button
										class="nimble-combat-tracker__group-button"
										type="button"
										onclick={createGroupFromSelection}
									>
										Create Group
									</button>
								{/if}
								{#if canAddSelectedToGroup}
									<button
										class="nimble-combat-tracker__group-button"
										type="button"
										onclick={addSelectionToExistingGroup}
									>
										Add to Group
									</button>
								{/if}
								{#if canUngroupAll}
									<button
										class="nimble-combat-tracker__group-button"
										type="button"
										onclick={dissolveAllGroups}
									>
										Ungroup All
									</button>
								{/if}
								{#if canDissolveSelection}
									<button
										class="nimble-combat-tracker__group-button"
										type="button"
										onclick={dissolveSelectedGroups}
									>
										Dissolve
									</button>
								{/if}
							</div>
						{/if}
					</div>
				{/if}
			</div>
		{/if}

		<ol
			bind:this={combatantsListElement}
			class="nimble-combatants"
			data-drag-source-id={activeDragSourceId ?? ''}
			data-drop-target-id={dragPreview?.targetId ?? ''}
			data-drop-before={dragPreview ? String(dragPreview.before) : ''}
			ondragover={handleDragOver}
			ondrop={(event) => _onDrop(event)}
			onscroll={handleCombatantsScroll}
			out:fade={{ delay: 0 }}
		>
			{#key version}
				{#each sceneCombatants as combatant (combatant._id)}
					{@const CombatantComponent = getCombatantComponent(combatant)}
					{@const isActiveCombatant = currentCombat?.combatant?.id === combatant.id}
					{@const isSelected = selectedCombatantIds.includes(combatant.id ?? '')}
					{@const groupDisplay = sceneMinionGroupDisplayByLeaderId.get(combatant.id ?? '')}
					{@const isGroupLeader = Boolean(groupDisplay)}

					<li
						class="nimble-combatants__item"
						class:nimble-combatants__item--active={isActiveCombatant}
						class:nimble-combatants__item--selected={isSelected}
						class:nimble-combatants__item--grouped={isGroupLeader}
						data-combatant-id={combatant.id}
						class:nimble-combatants__item--preview-gap-before={dragPreview?.targetId ===
							combatant.id && dragPreview.before}
						class:nimble-combatants__item--preview-gap-after={dragPreview?.targetId ===
							combatant.id && !dragPreview.before}
					>
						<div
							class="nimble-combatants__item-surface"
							role="button"
							tabindex="0"
							onclick={(event) => handleCombatantCardClick(event, combatant)}
							onkeydown={(event) => handleCombatantCardKeyDown(event, combatant)}
							oncontextmenu={(event) => handleCombatantCardContextMenu(event, combatant)}
							onpointerenter={(event) =>
								handleGroupCardPointerEnter(event, combatant.id, groupDisplay)}
							onpointerleave={handleGroupCardPointerLeave}
							onfocusin={(event) => handleGroupCardFocusIn(event, combatant.id, groupDisplay)}
							onfocusout={handleGroupCardFocusOut}
						>
							{#if isActiveCombatant}
								<span class="nimble-combatants__active-crawler" aria-hidden="true"></span>
							{/if}
							{#if isSelected}
								<div class="nimble-combatants__selection-badge" aria-hidden="true">
									<i class="fa-solid fa-check"></i>
								</div>
							{/if}
							<CombatantComponent active={isActiveCombatant} {combatant} />

							{#if groupDisplay}
								{#if groupDisplay.label}
									<div
										class="nimble-combatants__group-badge nimble-combatants__group-badge--label"
										style={getGroupIdentityStyle(groupDisplay.label, groupDisplay.labelIndex)}
										aria-label={`Minion Group ${groupDisplay.label}`}
									>
										{groupDisplay.label}
									</div>
								{/if}
								<div
									class="nimble-combatants__group-badge nimble-combatants__group-badge--count"
									style={getGroupIdentityStyle(groupDisplay.label, groupDisplay.labelIndex)}
									aria-label={`${groupDisplay.members.length} minions in this group`}
								>
									x{groupDisplay.members.length}
								</div>
							{/if}
						</div>
					</li>
				{/each}

				{#if sceneDeadCombatants.length > 0}
					<li class="nimble-combatants__dead-divider">
						<span class="nimble-combatants__dead-label">- Dead -</span>
					</li>

					{#each sceneDeadCombatants as combatant (combatant._id)}
						{@const CombatantComponent = getCombatantComponent(combatant)}
						{@const isSelected = selectedCombatantIds.includes(combatant.id ?? '')}
						{@const groupDisplay = sceneMinionGroupDisplayByLeaderId.get(combatant.id ?? '')}
						{@const isGroupLeader = Boolean(groupDisplay)}

						<li
							class="nimble-combatants__item"
							class:nimble-combatants__item--selected={isSelected}
							class:nimble-combatants__item--grouped={isGroupLeader}
							data-combatant-id={combatant.id}
						>
							<div
								class="nimble-combatants__item-surface"
								role="button"
								tabindex="0"
								onclick={(event) => handleCombatantCardClick(event, combatant)}
								onkeydown={(event) => handleCombatantCardKeyDown(event, combatant)}
								oncontextmenu={(event) => handleCombatantCardContextMenu(event, combatant)}
								onpointerenter={(event) =>
									handleGroupCardPointerEnter(event, combatant.id, groupDisplay)}
								onpointerleave={handleGroupCardPointerLeave}
								onfocusin={(event) => handleGroupCardFocusIn(event, combatant.id, groupDisplay)}
								onfocusout={handleGroupCardFocusOut}
							>
								{#if isSelected}
									<div class="nimble-combatants__selection-badge" aria-hidden="true">
										<i class="fa-solid fa-check"></i>
									</div>
								{/if}
								<CombatantComponent active={false} {combatant} />

								{#if groupDisplay}
									{#if groupDisplay.label}
										<div
											class="nimble-combatants__group-badge nimble-combatants__group-badge--label"
											style={getGroupIdentityStyle(groupDisplay.label, groupDisplay.labelIndex)}
											aria-label={`Minion Group ${groupDisplay.label}`}
										>
											{groupDisplay.label}
										</div>
									{/if}
									<div
										class="nimble-combatants__group-badge nimble-combatants__group-badge--count"
										style={getGroupIdentityStyle(groupDisplay.label, groupDisplay.labelIndex)}
										aria-label={`${groupDisplay.members.length} minions in this group`}
									>
										x{groupDisplay.members.length}
									</div>
								{/if}
							</div>
						</li>
					{/each}
				{/if}
			{/key}
		</ol>

		{#if hoveredGroupDisplay}
			<div
				bind:this={groupPopoverElement}
				class="nimble-combatants__group-popover nimble-combatants__group-popover--floating"
				style={`left: ${groupPopoverLeftPx}px; top: ${groupPopoverTopPx}px; ${getGroupIdentityStyle(
					hoveredGroupDisplay.label,
					hoveredGroupDisplay.labelIndex,
				)}`}
				onpointerenter={handleGroupPopoverPointerEnter}
				onpointerleave={handleGroupPopoverPointerLeave}
				onfocusin={handleGroupPopoverFocusIn}
				onfocusout={handleGroupPopoverFocusOut}
			>
				<h4 class="nimble-combatants__group-popover-heading">
					Minion Group {hoveredGroupDisplay.label ?? '?'}
				</h4>
				<table class="nimble-combatants__group-table">
					<tbody>
						{#each hoveredGroupDisplay.members as member, memberIndex (member._id)}
							<tr class:nimble-combatants__group-row--dead={isCombatantDead(member)}>
								<td class="nimble-combatants__group-code-column"
									>{getGroupMemberCode(member, hoveredGroupDisplay.label, memberIndex)}</td
								>
								<td>{getCombatantDisplayName(member)}</td>
								{#if game.user!.isGM}
									<td>
										<button
											class="nimble-combatants__group-member-action"
											type="button"
											disabled={!member.id}
											onclick={(event) => removeMemberFromGroup(event, member.id ?? '')}
										>
											Remove
										</button>
									</td>
									<td>
										<button
											class="nimble-combatants__group-member-action"
											type="button"
											disabled={!member.id || isCombatantDead(member)}
											onclick={(event) => killMember(event, member)}
										>
											Kill
										</button>
									</td>
								{/if}
							</tr>
						{/each}
					</tbody>
				</table>
				{#if game.user!.isGM}
					<div class="nimble-combatants__group-popover-actions">
						<button
							class="nimble-combatants__group-member-action"
							type="button"
							onclick={(event) => dissolveGroup(event, hoveredGroupDisplay.groupId)}
						>
							Dissolve Group
						</button>
					</div>
				{/if}
			</div>
		{/if}

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

		<button
			class="nimble-combat-tracker__resize-handle"
			type="button"
			aria-label="Resize combat tracker"
			onpointerdown={startResize}
		></button>
	</section>

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
