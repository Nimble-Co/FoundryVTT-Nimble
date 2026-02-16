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
		type CombatTrackerSideLocation,
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
	const COMBAT_TRACKER_WIDTH_STORAGE_KEY = 'nimble.combatTracker.widthRem';
	const DRAG_TARGET_EXPANSION_REM = 0.9;
	const DRAG_SWITCH_UPPER_RATIO = 0.4;
	const DRAG_SWITCH_LOWER_RATIO = 0.6;
	const PULSE_DURATION_MIN_SECONDS = 0.6;
	const PULSE_DURATION_MAX_SECONDS = 2.4;
	const GLOW_SCALE_MIN = 0.275;
	const GLOW_SCALE_MAX = 2.775;
	const EDGE_CRAWLER_SIZE_MIN = 0.6;
	const EDGE_CRAWLER_SIZE_MAX = 2.0;

	function clampCombatTrackerWidth(widthRem: number): number {
		return Math.min(COMBAT_TRACKER_MAX_WIDTH_REM, Math.max(COMBAT_TRACKER_MIN_WIDTH_REM, widthRem));
	}

	function sliderToRange(value: number, min: number, max: number): number {
		const normalizedValue = Math.min(100, Math.max(0, value)) / 100;
		return min + (max - min) * normalizedValue;
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

	function clearCombatTrackerSceneReserveInsets(): void {
		const rootStyle = document.documentElement.style;
		rootStyle.setProperty('--nimble-combat-scene-reserve-top', '0px');
		rootStyle.setProperty('--nimble-combat-scene-reserve-right', '0px');
		rootStyle.setProperty('--nimble-combat-scene-reserve-bottom', '0px');
		rootStyle.setProperty('--nimble-combat-scene-reserve-left', '0px');
	}

	function updateCombatTrackerSceneReserveInsets(): void {
		if (!currentCombat) {
			clearCombatTrackerSceneReserveInsets();
			return;
		}

		const sidebarWidthPx = combatTrackerWidthRem * getRootFontSizePx();
		const reserveInsets: CombatTrackerReserveInsets = {
			top: 0,
			right: combatTrackerLocation === 'right' ? sidebarWidthPx : 0,
			bottom: 0,
			left: combatTrackerLocation === 'left' ? sidebarWidthPx : 0,
		};

		const rootStyle = document.documentElement.style;
		rootStyle.setProperty(
			'--nimble-combat-scene-reserve-top',
			`${Math.round(reserveInsets.top)}px`,
		);
		rootStyle.setProperty(
			'--nimble-combat-scene-reserve-right',
			`${Math.round(reserveInsets.right)}px`,
		);
		rootStyle.setProperty(
			'--nimble-combat-scene-reserve-bottom',
			`${Math.round(reserveInsets.bottom)}px`,
		);
		rootStyle.setProperty(
			'--nimble-combat-scene-reserve-left',
			`${Math.round(reserveInsets.left)}px`,
		);
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
		if (!sceneId || !combat) return { activeCombatants: [], deadCombatants: [] };

		const combatantsForScene = combat.combatants.contents.filter(
			(c) => getCombatantSceneId(c) === sceneId && c.visible && c._id != null,
		);
		const turnCombatants = combat.turns.filter(
			(c) => getCombatantSceneId(c) === sceneId && c.visible && c._id != null,
		);

		const turnCombatantIds = new Set(turnCombatants.map((c) => c.id));
		const activeCombatants = turnCombatants.filter((combatant) => !isCombatantDead(combatant));
		const missingActiveCombatants = combatantsForScene.filter(
			(combatant) => !isCombatantDead(combatant) && !turnCombatantIds.has(combatant.id ?? ''),
		);

		const deadCombatants = combatantsForScene
			.filter((combatant) => isCombatantDead(combatant))
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
		fallback: CombatTrackerSideLocation,
	): CombatTrackerSideLocation {
		if (location === 'left' || location === 'right') return location;
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

	function openCombatTrackerSettings(event: MouseEvent): void {
		event.preventDefault();
		CombatTrackerSettings.open();
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
		const horizontalDirectionMultiplier = combatTrackerLocation === 'right' ? -1 : 1;

		stopResizeTracking();

		resizeMoveHandler = (moveEvent: PointerEvent) => {
			const deltaRem =
				((moveEvent.clientX - startX) / rootFontSizePx) * horizontalDirectionMultiplier;
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
	let currentTurnAnimationSettings: CurrentTurnAnimationSettings = $state(
		getCurrentTurnAnimationSettings(),
	);
	let combatTrackerLocation: CombatTrackerSideLocation = $state(getCombatTrackerLocation());
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

	onMount(() => {
		combatTrackerWidthRem = readStoredCombatTrackerWidth();
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
		};
		window.addEventListener('resize', resizeWindowHandler);

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
</script>

{#if currentCombat}
	<section
		class="nimble-combat-tracker"
		class:nimble-combat-tracker--location-left={combatTrackerLocation === 'left'}
		class:nimble-combat-tracker--location-right={combatTrackerLocation === 'right'}
		style={`--nimble-combat-sidebar-width: ${combatTrackerWidthRem}rem; --nimble-combat-sidebar-min-width: ${COMBAT_TRACKER_MIN_WIDTH_REM}rem; --nimble-combat-sidebar-max-width: ${COMBAT_TRACKER_MAX_WIDTH_REM}rem; --nimble-combat-card-scale: ${combatTrackerScale}; --nimble-combat-border-glow-color: ${currentTurnAnimationSettings.borderGlowColor}; --nimble-combat-edge-crawler-color: ${currentTurnAnimationSettings.edgeCrawlerColor}; --nimble-combat-pulse-duration: ${pulseAnimationDurationSeconds}s; --nimble-combat-border-glow-scale: ${borderGlowScale}; --nimble-combat-edge-crawler-size-scale: ${edgeCrawlerSizeScale};`}
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
				{#if currentCombat?.round === 0 && game.user!.isGM}
					<button class="nimble-combat-tracker__start-button" onclick={startCombat}>
						Start Combat
					</button>
				{:else if currentCombat?.round === 0}
					<h2 class="nimble-combat-tracker__heading">Combat Not Started</h2>
				{:else}
					<h2 class="nimble-combat-tracker__heading">
						Round {currentCombat?.round}
					</h2>
				{/if}

				<div class="nimble-combat-tracker__header-button-row">
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

					{#if currentCombat?.round !== 0 && game.user!.isGM}
						<CombatTrackerControls />
					{/if}
				</div>
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
{/if}
