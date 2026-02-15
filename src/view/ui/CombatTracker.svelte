<script lang="ts">
	import { onDestroy, onMount, tick } from 'svelte';
	import { fade, slide } from 'svelte/transition';
	import { isCombatantDead } from '../../utils/isCombatantDead.js';
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

	const COMBAT_TRACKER_MIN_WIDTH_REM = 6.5;
	const COMBAT_TRACKER_MAX_WIDTH_REM = COMBAT_TRACKER_MIN_WIDTH_REM * 2;
	const COMBAT_TRACKER_WIDTH_STORAGE_KEY = 'nimble.combatTracker.widthRem';
	const DRAG_TARGET_EXPANSION_REM = 0.9;
	const DRAG_SWITCH_UPPER_RATIO = 0.4;
	const DRAG_SWITCH_LOWER_RATIO = 0.6;

	function clampCombatTrackerWidth(widthRem: number): number {
		return Math.min(COMBAT_TRACKER_MAX_WIDTH_REM, Math.max(COMBAT_TRACKER_MIN_WIDTH_REM, widthRem));
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

	function getCombatantTypePriority(combatant: Combatant.Implementation): number {
		return combatant.type === 'character' ? 0 : 1;
	}

	function canCurrentUserReorderCombatant(combatant: Combatant.Implementation): boolean {
		if (game.user?.isGM) return true;
		const hasTrustedRole = Number(game.user?.role ?? 0) >= Number(CONST.USER_ROLES?.TRUSTED ?? 2);
		return hasTrustedRole && combatant.type === 'character' && combatant.isOwner;
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
		const activeCombatants = turnCombatants.filter((combatant) => !isCombatantDead(combatant));
		const missingActiveCombatants = combatantsForScene.filter(
			(combatant) => !isCombatantDead(combatant) && !turnCombatantIds.has(combatant.id ?? ''),
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
	let dragPreview: CombatantDropPreview | null = $state(null);
	let activeDragSourceId: string | null = $state(null);
	let combatantsListElement: HTMLOListElement | null = $state(null);
	let combatTrackerWidthRem: number = $state(COMBAT_TRACKER_MIN_WIDTH_REM);
	let combatTrackerScale = $derived(combatTrackerWidthRem / COMBAT_TRACKER_MIN_WIDTH_REM);
	let resizeMoveHandler: ((event: PointerEvent) => void) | undefined;
	let resizeEndHandler: ((event: PointerEvent) => void) | undefined;
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

	onMount(() => {
		combatTrackerWidthRem = readStoredCombatTrackerWidth();
		updateCurrentCombat();
		window.addEventListener('dragend', handleCombatantDragEnd);
		window.addEventListener('nimble-combatant-dragstart', handleCombatantDragStart);
		window.addEventListener('nimble-combatant-dragend', handleCombatantDragEnd);

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
		stopResizeTracking();
		window.removeEventListener('dragend', handleCombatantDragEnd);
		window.removeEventListener('nimble-combatant-dragstart', handleCombatantDragStart);
		window.removeEventListener('nimble-combatant-dragend', handleCombatantDragEnd);

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
								{startCombatButtonLabel}
							</button>
							<button class="nimble-combat-tracker__end-combat-button" onclick={endCombat}>
								{endCombatButtonLabel}
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

		<ol
			bind:this={combatantsListElement}
			class="nimble-combatants"
			data-drag-source-id={activeDragSourceId ?? ''}
			data-drop-target-id={dragPreview?.targetId ?? ''}
			data-drop-before={dragPreview ? String(dragPreview.before) : ''}
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
						{#if isActiveCombatant}
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
