<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import { fade, slide } from 'svelte/transition';
	import {
		canCurrentUserReorderCombatant,
		getCombatantTypePriority,
	} from '../../utils/combatantOrdering.js';
	import { isCombatantDead } from '../../utils/isCombatantDead.js';
	import {
		getCombatTrackerLocation,
		getCurrentTurnAnimationSettings,
		isCombatTrackerLocationSettingKey,
		isCurrentTurnAnimationSettingKey,
		type CombatTrackerLocation,
		type CurrentTurnAnimationSettings,
	} from '../../settings/combatTrackerSettings.js';
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

	function isDeadCombatant(combatant: Combatant.Implementation): boolean {
		const hpValue = (
			combatant.actor?.system as {
				attributes?: { hp?: { value?: number } };
			}
		)?.attributes?.hp?.value;

		if (combatant.type === 'character') return combatant.defeated;
		return combatant.defeated || (typeof hpValue === 'number' && hpValue <= 0);
	}

	function getCombatantsForScene(
		combat: Combat | null,
		sceneId: string | undefined,
	): SceneCombatantLists {
		if (!sceneId || !combat) return { activeCombatants: [], deadCombatants: [] };

		const combatantsForScene = combat.combatants.contents.filter(
			(c) => getCombatantSceneId(c) === sceneId && c.visible && c._id != null,
		);
		const turnCombatants = combat.turns.filter(
			(c) => getCombatantSceneId(c) === sceneId && c.visible && c._id != null,
		);

		const turnCombatantIds = new Set(turnCombatants.map((c) => c.id));
		const activeCombatants = turnCombatants.filter((combatant) => !isDeadCombatant(combatant));
		const missingActiveCombatants = combatantsForScene.filter(
			(combatant) => !isDeadCombatant(combatant) && !turnCombatantIds.has(combatant.id ?? ''),
		);

		const deadCombatants = combatantsForScene
			.filter((combatant) => isDeadCombatant(combatant))
			.sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''));

		return {
			activeCombatants: [...activeCombatants, ...missingActiveCombatants],
			deadCombatants,
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
		queueMicrotask(() => {
			const combat = getCombatForCurrentScene();
			const sceneId = canvas.scene?.id;
			const { activeCombatants, deadCombatants } = getCombatantsForScene(combat, sceneId);
			currentCombat = combat;
			sceneCombatants = activeCombatants;
			sceneDeadCombatants = deadCombatants;
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
		clientX: number,
		clientY: number,
		source: Combatant.Implementation,
	): { target: Combatant.Implementation; before: boolean } | null {
		if (!combatantsListElement) return null;

		const isHorizontalLayout = isHorizontalCombatTrackerLocation(combatTrackerLocation);
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
			const rectStart = isHorizontalLayout ? rect.left : rect.top;
			const rectEnd = isHorizontalLayout ? rect.right : rect.bottom;
			const expandedStart = rectStart - expansionPx;
			const expandedEnd = rectEnd + expansionPx;
			const pointerValue = isHorizontalLayout ? clientX : clientY;

			const distance =
				pointerValue < expandedStart
					? expandedStart - pointerValue
					: pointerValue > expandedEnd
						? pointerValue - expandedEnd
						: 0;

			if (distance < bestDistance) {
				bestDistance = distance;
				bestTarget = candidate;
				bestRect = rect;
			}
		}

		if (!bestTarget || !bestRect) return null;

		const pointerValue = isHorizontalLayout ? clientX : clientY;
		const rectStart = isHorizontalLayout ? bestRect.left : bestRect.top;
		const rectSize = isHorizontalLayout ? bestRect.width : bestRect.height;
		const relative = (pointerValue - rectStart) / Math.max(1, rectSize);
		let before: boolean;

		if (relative <= DRAG_SWITCH_UPPER_RATIO) {
			before = true;
		} else if (relative >= DRAG_SWITCH_LOWER_RATIO) {
			before = false;
		} else if (dragPreview?.targetId === bestTarget.id) {
			before = dragPreview.before;
		} else {
			before = relative < 0.5;
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

	function updateFloatingEndTurnButtonPosition(): void {
		if (!showHorizontalFloatingEndTurn || !combatTrackerElement) {
			return;
		}

		const activeCardElement = combatantsListElement
			? (combatantsListElement.querySelector<HTMLElement>('.nimble-combatants__item--active') ??
				combatantsListElement.querySelector<HTMLElement>('.nimble-combatants__item'))
			: null;
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
		const trackerDockedTop = combatTrackerElement.classList.contains(
			'nimble-combat-tracker--location-top',
		);
		const trackerDockedBottom = combatTrackerElement.classList.contains(
			'nimble-combat-tracker--location-bottom',
		);
		const preferredTop =
			trackerDockedTop && !trackerDockedBottom
				? trackerRect.bottom + edgeGapPx
				: trackerRect.top - buttonHeight - edgeGapPx;
		const minTop = viewportPaddingPx;
		const maxTop = window.innerHeight - buttonHeight - viewportPaddingPx;
		const top = clampNumber(preferredTop, minTop, maxTop);

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
				saveCombatTrackerSize(COMBAT_TRACKER_WIDTH_STORAGE_KEY, combatTrackerWidthRem);
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
		combatTrackerWidthRem = readStoredCombatTrackerSize(
			COMBAT_TRACKER_WIDTH_STORAGE_KEY,
			COMBAT_TRACKER_MIN_WIDTH_REM,
			COMBAT_TRACKER_MAX_WIDTH_REM,
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
		};
		window.addEventListener('resize', resizeWindowHandler);
		windowScrollHandler = () => {
			scheduleFloatingEndTurnPositionUpdate();
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
		clearCombatTrackerSceneReserveInsets();
		if (floatingEndTurnPositionFrameHandle !== undefined) {
			cancelAnimationFrame(floatingEndTurnPositionFrameHandle);
		}
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
		if (resizeWindowHandler) {
			window.removeEventListener('resize', resizeWindowHandler);
		}
		if (windowScrollHandler) {
			window.removeEventListener('scroll', windowScrollHandler, true);
		}

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
		style={`--nimble-combat-sidebar-width: ${combatTrackerWidthRem}rem; --nimble-combat-tracker-height: ${combatTrackerDisplayedHeightRem}rem; --nimble-combat-horizontal-card-width: ${combatTrackerHorizontalCardWidthRem}rem; --nimble-combat-sidebar-min-width: ${COMBAT_TRACKER_MIN_WIDTH_REM}rem; --nimble-combat-sidebar-max-width: ${COMBAT_TRACKER_MAX_WIDTH_REM}rem; --nimble-combat-tracker-min-height: ${COMBAT_TRACKER_MIN_HEIGHT_REM}rem; --nimble-combat-tracker-max-height: ${combatTrackerDisplayedMaxHeightRem}rem; --nimble-combat-card-scale: ${combatTrackerScale}; --nimble-combat-border-glow-color: ${currentTurnAnimationSettings.borderGlowColor}; --nimble-combat-edge-crawler-color: ${currentTurnAnimationSettings.edgeCrawlerColor}; --nimble-combat-pulse-duration: ${pulseAnimationDurationSeconds}s; --nimble-combat-border-glow-scale: ${borderGlowScale}; --nimble-combat-edge-crawler-size-scale: ${edgeCrawlerSizeScale};`}
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

		<ol
			bind:this={combatantsListElement}
			class="nimble-combatants"
			class:nimble-combatants--pulse={currentTurnAnimationSettings.pulseAnimation}
			class:nimble-combatants--border-glow={currentTurnAnimationSettings.borderGlow}
			data-drag-source-id={activeDragSourceId ?? ''}
			data-drop-target-id={dragPreview?.targetId ?? ''}
			data-drop-before={dragPreview ? String(dragPreview.before) : ''}
			onscroll={() => scheduleFloatingEndTurnPositionUpdate()}
			onwheel={handleHorizontalWheelScroll}
			ondragover={handleDragOver}
			ondrop={(event) => _onDrop(event)}
			out:fade={{ delay: 0 }}
		>
			{#key version}
				{#each sceneCombatants as combatant (combatant._id)}
					{@const CombatantComponent = getCombatantComponent(combatant)}
					{@const isActiveCombatant = currentCombat?.combatant?.id === combatant.id}

					<li
						class="nimble-combatants__item"
						class:nimble-combatants__item--active={isActiveCombatant}
						data-combatant-id={combatant.id}
						class:nimble-combatants__item--preview-gap-before={dragPreview?.targetId ===
							combatant.id && dragPreview.before}
						class:nimble-combatants__item--preview-gap-after={dragPreview?.targetId ===
							combatant.id && !dragPreview.before}
					>
						{#if isActiveCombatant && currentTurnAnimationSettings.edgeCrawler}
							<span class="nimble-combatants__active-crawler" aria-hidden="true"></span>
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
