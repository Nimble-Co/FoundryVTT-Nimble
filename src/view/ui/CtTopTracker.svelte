<script lang="ts">
	import { onDestroy, onMount, tick } from 'svelte';
	import { fade } from 'svelte/transition';
	import GenericDialog from '../../documents/dialogs/GenericDialog.svelte.js';
	import {
		canCurrentUserDisplayCombatTrackerField,
		getCombatTrackerCtBadgeSizeLevel,
		getCombatTrackerCenterActiveCardEnabled,
		getCombatTrackerCtCardSizeLevel,
		getCombatTrackerCtEnabled,
		getCombatTrackerVisibilityPermissionConfig,
		getCombatTrackerUseActionDice,
		getCombatTrackerCtWidthLevel,
		getCombatTrackerPlayersCanExpandMonsterCards,
	} from '../../settings/combatTrackerSettings.js';
	import CtSettingsDialogComponent from '../dialogs/CtSettingsDialog.svelte';
	import { canCurrentUserReorderCombatant } from '../../utils/combatantOrdering.js';
	import { canOwnerUseHeroicReaction, type HeroicReactionKey } from '../../utils/heroicActions.js';
	import {
		COMBATANT_ACTIONS_CURRENT_PATH,
		canCurrentUserEndTurn as canCurrentUserEndCombatantTurn,
		getCombatantCurrentActions,
		getCombatantMaxActions,
		resolveCombatantCurrentActionsAfterDelta,
	} from '../../utils/combatTurnActions.js';
	import { isCombatantDead } from '../../utils/isCombatantDead.js';
	import {
		CT_SETTINGS_DIALOG_UNIQUE_ID,
		CT_VIRTUALIZATION_ENTRY_THRESHOLD,
		CT_WIDTH_PREVIEW_EVENT_NAME,
	} from './ctTopTracker/constants.js';
	import {
		buildAliveEntries,
		buildCombatSyncSignature,
		buildVirtualizedAliveEntries,
		canCurrentUserAdjustCombatantActions,
		canCurrentUserRollInitiativeForCombatant,
		getActiveCombatant,
		getActiveCombatantId,
		getActiveCombatantOccurrence,
		getCombatantId,
		getCombatantDisplayName,
		getCombatantHpBadgeClass,
		getCombatantHpBadgeText,
		getCombatantHpBadgeTooltip,
		getCombatantImageForDisplay,
		getCombatantCardResourceChips,
		getPlayerCombatantDrawerData,
		getCombatantSceneId,
		getCombatantsForScene,
		getCombatForCurrentScene,
		getCombatantOutlineClass,
		getDragTargetExpansionPx,
		getEstimatedCtEntryWidthPx,
		getRoundBoundaryKey,
		getRoundSeparatorInsertionIndex,
		isCombatRoundStarted,
		isCombatStarted,
		isEligibleForInitiativeRoll,
		isMonsterOrMinionCombatant,
		isPlayerCombatant,
		localizeWithFallback,
		normalizeCtWidthLevel,
		orderEntriesForCenteredActive,
		resolveActiveEntryKey,
		resolveCtTrackMaxWidth,
		resolveNextCombatantActionsForSlot,
		resolvePreviewBeforeState,
		shouldRenderCombatantActions,
		shouldRenderHpBadge,
		shouldShowInitiativePromptForCombatant,
		syncCombatTurnsForCt,
		trackDependency,
		getActionDiceIconClass,
		getActionState,
		getCtBadgeScale,
		getCtCardScale,
	} from './ctTopTracker/helpers.js';
	import { registerCtTopTrackerHooks } from './ctTopTracker/hooks.js';
	import {
		resolveActionCombatState,
		resolveCtTopTrackerSettingPatch,
		resolveMonsterCardsExpandedState,
	} from './ctTopTracker/state.js';
	import type {
		CanvasTokenLike,
		CombatantDropPreview,
		CombatWithDrop,
		CombatWithHeroicReactionToggle,
		CtWidthPreviewEventDetail,
	} from './ctTopTracker/types.js';

	let preferredCombatId: string | null = null;

	function resolveActionCombat(): Combat | null {
		const resolvedState = resolveActionCombatState({
			currentCombat,
			preferredCombatId,
		});
		preferredCombatId = resolvedState.preferredCombatId;
		return resolvedState.combat;
	}

	function logCtControl(action: string, details: Record<string, unknown> = {}): void {
		console.info(`[Nimble][CT] ${action}`, details);
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
			console.error('[Nimble][CT] Initiative roll failed', { combatantId, error });
			const errorMessage = error instanceof Error ? error.message : String(error);
			ui.notifications?.error(`Unable to roll initiative: ${errorMessage}`);
		}
	}

	function openCtSettingsDialog(): void {
		const dialogWidth = 363;
		const clampInsetPx = 12;

		try {
			const dialog = GenericDialog.getOrCreate(
				'Combat Tracker Settings',
				CtSettingsDialogComponent,
				{},
				{
					icon: 'fa-solid fa-gear',
					width: dialogWidth,
					uniqueId: CT_SETTINGS_DIALOG_UNIQUE_ID,
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
			ui.notifications?.warn('Combat Tracker settings are unavailable in this context.');
		}
	}

	function updatePlayerMonsterExpansionPermission(): void {
		playersCanExpandMonsterCards = getCombatTrackerPlayersCanExpandMonsterCards();
	}

	function updateVisibilityPermissions(): void {
		ctVisibilityPermissions = getCombatTrackerVisibilityPermissionConfig();
	}

	async function centerActiveEntryInView(
		activeKey: string | null,
		behavior: ScrollBehavior = 'smooth',
	): Promise<void> {
		if (!trackElement) return;
		await tick();
		if (!trackElement) return;
		if (!centerActiveCardEnabled) return;
		if (!activeKey) {
			const centeredScrollLeft = Math.max(
				0,
				(trackElement.scrollWidth - trackElement.clientWidth) / 2,
			);
			trackElement.scrollTo({ left: centeredScrollLeft, behavior });
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
				? activeIndex * getEstimatedCtEntryWidthPx(ctCardSizeLevel) -
					trackElement.clientWidth / 2 +
					getEstimatedCtEntryWidthPx(ctCardSizeLevel) / 2
				: null;
		if (scrollLeft == null) return;
		trackElement.scrollTo({ left: Math.max(0, scrollLeft), behavior });
		updateTrackViewportMetrics();
	}

	function updateCurrentCombat(force = false): void {
		queueMicrotask(() => {
			const combat = getCombatForCurrentScene(preferredCombatId);
			syncCombatTurnsForCt(combat);
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
			console.error('[Nimble][CT] Failed to update combatant actions', {
				combatantId,
				nextActions,
				error,
			});
		}
	}

	async function handleActionDeltaClick(
		event: MouseEvent,
		combatant: Combatant.Implementation,
		delta: number,
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
		const nextActions = resolveCombatantCurrentActionsAfterDelta({
			currentActions,
			maxActions,
			delta,
			allowOverflow: Boolean(game.user?.isGM),
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
			console.error('[Nimble][CT] Failed to update combatant actions via delta', {
				combatantId,
				delta,
				nextActions,
				error,
			});
		}
	}

	function canToggleHeroicReactionFromDrawer(
		combatant: Combatant.Implementation,
		reactionKey: HeroicReactionKey,
		reactionActive: boolean | undefined,
	): boolean {
		if (game.user?.isGM) return true;
		if (reactionActive === false) return false;
		if (!isCombatStarted(currentCombat)) return false;
		if ((currentCombat?.combatant?.id ?? null) === getCombatantId(combatant)) return false;
		if (getCombatantCurrentActions(combatant) < 1) return false;
		return canOwnerUseHeroicReaction(reactionKey) && Boolean(combatant.actor?.isOwner);
	}

	async function handleHeroicReactionToggle(
		event: MouseEvent,
		combatant: Combatant.Implementation,
		reactionKey: HeroicReactionKey,
	): Promise<void> {
		event.preventDefault();
		event.stopPropagation();
		const currentTarget = event.currentTarget;
		if (event.detail > 0 && currentTarget instanceof HTMLElement) {
			currentTarget.blur();
		}
		const combat = resolveActionCombat() as CombatWithHeroicReactionToggle | null;
		const combatantId = getCombatantId(combatant);
		if (!combat || !combatantId) return;
		if (typeof combat.toggleHeroicReactionAvailability !== 'function') return;

		try {
			const changed = await combat.toggleHeroicReactionAvailability(combatantId, reactionKey);
			if (changed) updateCurrentCombat(true);
		} catch (error) {
			console.error('[Nimble][CT] Failed to toggle heroic reaction', {
				combatantId,
				reactionKey,
				error,
			});
		}
	}

	function getCombatantToken(combatant: Combatant.Implementation): CanvasTokenLike | null {
		const tokenId = combatant.tokenId ?? combatant.token?.id ?? combatant.token?._id;
		if (!tokenId) return null;

		const tokenLayer = canvas.tokens;
		if (!tokenLayer) return null;

		const tokenFromLayer = (
			tokenLayer as unknown as { get?: (id: string) => CanvasTokenLike | null }
		).get?.(tokenId);
		if (tokenFromLayer) return tokenFromLayer;

		const tokenFromPlaceables =
			tokenLayer.placeables.find((token) => token.document?.id === tokenId) ?? null;
		if (tokenFromPlaceables) return tokenFromPlaceables;

		return (combatant.token?.object as CanvasTokenLike | null) ?? null;
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
			ping?: (position: { x: number; y: number }, options?: Record<string, unknown>) => void;
		};
		if (typeof controlsLayer?.ping === 'function') {
			controlsLayer.ping(token.center, {});
			return;
		}

		const canvasWithPing = canvas as unknown as {
			ping?: (position: { x: number; y: number }, options?: Record<string, unknown>) => void;
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

		let delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
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

	function handleCombatantCardPointerDown(event: PointerEvent, combatantId: string): void {
		const target = event.target;
		if (!(target instanceof HTMLElement)) {
			dragHandleArmedCombatantId = null;
			return;
		}
		const handle = target.closest<HTMLElement>('[data-ct-drag-handle="true"]');
		if (!handle) {
			dragHandleArmedCombatantId = null;
			return;
		}
		const handleCombatantId = handle.dataset.combatantId ?? '';
		dragHandleArmedCombatantId =
			handleCombatantId && handleCombatantId === combatantId ? handleCombatantId : null;
	}

	function updateTrackViewportMetrics(): void {
		if (!trackElement) {
			trackScrollLeft = 0;
			trackClientWidth = 0;
			trackScrollWidth = 0;
			trackScrollbarWidth = 0;
			return;
		}
		trackScrollLeft = trackElement.scrollLeft;
		trackClientWidth = trackElement.clientWidth;
		trackScrollWidth = trackElement.scrollWidth;
		trackScrollbarWidth = trackScrollbarElement?.clientWidth ?? trackElement.clientWidth;
	}

	function handleTrackScroll(): void {
		updateTrackViewportMetrics();
	}

	function getTrackScrollbarMetrics(): {
		scrollbarWidthPx: number;
		thumbWidthPx: number;
		thumbLeftPx: number;
		maxThumbOffsetPx: number;
		maxScrollLeftPx: number;
	} | null {
		const scrollbarWidthPx = Math.max(0, Math.floor(trackScrollbarWidth));
		const maxScrollLeftPx = Math.max(0, trackScrollWidth - trackClientWidth);
		if (scrollbarWidthPx <= 0 || maxScrollLeftPx <= 0 || trackClientWidth <= 0) return null;

		const thumbWidthPx = Math.max(
			48,
			Math.min(
				scrollbarWidthPx,
				Math.round((trackClientWidth / Math.max(trackScrollWidth, 1)) * scrollbarWidthPx),
			),
		);
		const maxThumbOffsetPx = Math.max(0, scrollbarWidthPx - thumbWidthPx);
		const thumbLeftPx =
			maxScrollLeftPx > 0 && maxThumbOffsetPx > 0
				? Math.round((trackScrollLeft / maxScrollLeftPx) * maxThumbOffsetPx)
				: 0;
		return {
			scrollbarWidthPx,
			thumbWidthPx,
			thumbLeftPx,
			maxThumbOffsetPx,
			maxScrollLeftPx,
		};
	}

	function scrollTrackToRatio(ratio: number): void {
		if (!trackElement) return;
		const maxScrollLeftPx = Math.max(0, trackElement.scrollWidth - trackElement.clientWidth);
		const normalizedRatio = Math.min(1, Math.max(0, ratio));
		trackElement.scrollLeft = Math.round(maxScrollLeftPx * normalizedRatio);
		updateTrackViewportMetrics();
	}

	function handleTrackScrollbarPointerDown(event: PointerEvent): void {
		const currentTarget = event.currentTarget;
		if (!(currentTarget instanceof HTMLElement)) return;

		const metrics = getTrackScrollbarMetrics();
		if (!metrics) return;

		event.preventDefault();
		event.stopPropagation();

		const rect = currentTarget.getBoundingClientRect();
		const pointerX = event.clientX - rect.left;
		const target = event.target;
		const clickedThumb =
			target instanceof HTMLElement && Boolean(target.closest('.nimble-ct__scrollbar-thumb'));
		const nextThumbLeft = clickedThumb
			? metrics.thumbLeftPx
			: Math.min(metrics.maxThumbOffsetPx, Math.max(0, pointerX - metrics.thumbWidthPx / 2));

		if (!clickedThumb) {
			const ratio = metrics.maxThumbOffsetPx > 0 ? nextThumbLeft / metrics.maxThumbOffsetPx : 0;
			scrollTrackToRatio(ratio);
		}

		scrollbarDragPointerId = event.pointerId;
		scrollbarDragOffsetPx = Math.min(metrics.thumbWidthPx, Math.max(0, pointerX - nextThumbLeft));
		currentTarget.setPointerCapture(event.pointerId);
	}

	function handleTrackScrollbarPointerMove(event: PointerEvent): void {
		if (scrollbarDragPointerId !== event.pointerId) return;

		const currentTarget = event.currentTarget;
		if (!(currentTarget instanceof HTMLElement)) return;

		const metrics = getTrackScrollbarMetrics();
		if (!metrics) return;

		const rect = currentTarget.getBoundingClientRect();
		const pointerX = event.clientX - rect.left;
		const nextThumbLeft = Math.min(
			metrics.maxThumbOffsetPx,
			Math.max(0, pointerX - scrollbarDragOffsetPx),
		);
		const ratio = metrics.maxThumbOffsetPx > 0 ? nextThumbLeft / metrics.maxThumbOffsetPx : 0;
		scrollTrackToRatio(ratio);
	}

	function handleTrackScrollbarPointerRelease(event: PointerEvent): void {
		if (scrollbarDragPointerId !== event.pointerId) return;

		const currentTarget = event.currentTarget;
		if (
			currentTarget instanceof HTMLElement &&
			currentTarget.hasPointerCapture(scrollbarDragPointerId)
		) {
			currentTarget.releasePointerCapture(scrollbarDragPointerId);
		}

		scrollbarDragPointerId = null;
		scrollbarDragOffsetPx = 0;
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
			`.nimble-ct__portrait[data-combatant-id="${combatantId}"]`,
		);
	}

	function getPreviewTargetFromPointer(
		clientX: number,
		source: Combatant.Implementation,
	): { target: Combatant.Implementation; before: boolean } | null {
		if (!trackElement) return null;

		const candidates = getDragPreviewCandidates(source);
		if (candidates.length < 1) return null;

		const expansionPx = getDragTargetExpansionPx();
		let bestMatch: { target: Combatant.Implementation; rect: DOMRect; targetId: string } | null =
			null;
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
		const before = resolvePreviewBeforeState(relative, bestMatch.targetId, dragPreview);
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
			openCtSettingsDialog();
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
					logCtControl('previous-turn requested', {
						combatId: actionCombat.id ?? actionCombat._id ?? null,
						turn: actionCombat.turn ?? null,
						activeCombatantId: getActiveCombatantId(actionCombat),
					});
					await actionCombat.previousTurn();
					logCtControl('previous-turn completed', {
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
					logCtControl('start-combat requested', {
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
					logCtControl('start-combat completed', {
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
					logCtControl('end-combat requested', {
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
					logCtControl('next-turn requested', {
						combatId: actionCombat.id ?? actionCombat._id ?? null,
						turn: actionCombat.turn ?? null,
						activeCombatantId: getActiveCombatantId(actionCombat),
					});
					await actionCombat.nextTurn();
					logCtControl('next-turn completed', {
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
			console.error('[Nimble][CT] Combat control action failed', { action, error });
			const errorMessage = error instanceof Error ? error.message : String(error);
			ui.notifications?.error(`Unable to run combat control action: ${errorMessage}`);
		}
	}

	let currentCombat: Combat | null = $state(null);
	let sceneAliveCombatants: Combatant.Implementation[] = $state([]);
	let sceneDeadCombatants: Combatant.Implementation[] = $state([]);
	let playersCanExpandMonsterCards = $state(getCombatTrackerPlayersCanExpandMonsterCards());
	let centerActiveCardEnabled = $state(getCombatTrackerCenterActiveCardEnabled());
	let ctEnabled = $state(getCombatTrackerCtEnabled());
	let useActionDice = $state(getCombatTrackerUseActionDice());
	let ctWidthLevel = $state(getCombatTrackerCtWidthLevel());
	let ctCardSizeLevel = $state(getCombatTrackerCtCardSizeLevel());
	let ctBadgeSizeLevel = $state(getCombatTrackerCtBadgeSizeLevel());
	let ctVisibilityPermissions = $state(getCombatTrackerVisibilityPermissionConfig());
	let monsterCardsExpanded = $state(false);
	let layoutVersion = $state(0);
	let trackElement: HTMLOListElement | null = $state(null);
	let trackScrollLeft = $state(0);
	let trackClientWidth = $state(0);
	let trackScrollWidth = $state(0);
	let trackScrollbarElement: HTMLDivElement | null = $state(null);
	let trackScrollbarWidth = $state(0);
	let scrollbarDragPointerId: number | null = $state(null);
	let scrollbarDragOffsetPx = $state(0);
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
		trackDependency(renderVersion);
		return getActiveCombatantId(currentCombat);
	});
	let activeCombatant = $derived.by(() => {
		trackDependency(renderVersion);
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
		orderedAliveEntries.length >= CT_VIRTUALIZATION_ENTRY_THRESHOLD,
	);
	let virtualizedAliveEntries = $derived.by(() =>
		buildVirtualizedAliveEntries(
			{
				entries: orderedAliveEntries,
				enabled: shouldVirtualizeAliveEntries,
				scrollLeft: trackScrollLeft,
				viewportWidth: trackClientWidth,
			},
			ctCardSizeLevel,
		),
	);
	let roundBoundaryKey = $derived.by(() =>
		getRoundBoundaryKey(sceneAliveCombatants, shouldCollapseMonsterCards),
	);
	let roundSeparatorIndex = $derived.by(() =>
		getRoundSeparatorInsertionIndex(orderedAliveEntries, roundBoundaryKey),
	);
	let combatStarted = $derived.by(() => {
		trackDependency(renderVersion);
		return isCombatStarted(currentCombat);
	});
	let currentRoundLabel = $derived.by(() => {
		trackDependency(renderVersion);
		return Math.max(1, currentCombat?.round ?? 1);
	});
	let ctTrackMaxWidth = $derived.by(() => {
		trackDependency(layoutVersion);
		return resolveCtTrackMaxWidth(ctWidthLevel);
	});
	let ctWidthPreviewLevel = $state<number | null>(null);
	let ctWidthPreviewVisible = $derived(ctWidthPreviewLevel !== null);
	let ctWidthPreviewMaxWidth = $derived.by(() =>
		resolveCtTrackMaxWidth(ctWidthPreviewLevel ?? ctWidthLevel),
	);
	let ctCardScale = $derived.by(() => getCtCardScale(ctCardSizeLevel));
	let ctBadgeScale = $derived.by(() => getCtBadgeScale(ctBadgeSizeLevel));
	let showMonsterStackOutline = $derived.by(() =>
		canCurrentUserDisplayCombatTrackerField('outline', ctVisibilityPermissions),
	);
	let trackScrollbarMetrics = $derived.by(() => getTrackScrollbarMetrics());
	let showTrackScrollbar = $derived(Boolean(trackScrollbarMetrics));

	let unregisterCtHooks: (() => void) | undefined;
	let resizeListener: (() => void) | undefined;
	let ctWidthPreviewListener: ((event: Event) => void) | undefined;

	onMount(() => {
		updatePlayerMonsterExpansionPermission();
		updateVisibilityPermissions();
		updateCurrentCombat(true);
		queueMicrotask(() => {
			updateTrackViewportMetrics();
		});

		resizeListener = () => {
			updateTrackViewportMetrics();
			layoutVersion += 1;
		};
		window.addEventListener('resize', resizeListener);
		ctWidthPreviewListener = (event: Event) => {
			if (!(event instanceof CustomEvent)) return;
			const detail = (event.detail ?? {}) as CtWidthPreviewEventDetail;
			if (detail.active === false) {
				ctWidthPreviewLevel = null;
				return;
			}
			if (detail.active !== true) return;
			ctWidthPreviewLevel = normalizeCtWidthLevel(detail.widthLevel);
		};
		window.addEventListener(CT_WIDTH_PREVIEW_EVENT_NAME, ctWidthPreviewListener);

		unregisterCtHooks = registerCtTopTrackerHooks({
			updateCurrentCombat: (force = true) => updateCurrentCombat(force),
			onLayoutInvalidated: () => {
				layoutVersion += 1;
			},
			onSettingKeyUpdated: (settingKey: unknown) => {
				const patch = resolveCtTopTrackerSettingPatch(settingKey);
				if (!patch) return;

				if (patch.playersCanExpandMonsterCards !== undefined) {
					playersCanExpandMonsterCards = patch.playersCanExpandMonsterCards;
				}
				if (patch.centerActiveCardEnabled !== undefined) {
					centerActiveCardEnabled = patch.centerActiveCardEnabled;
				}
				if (patch.ctEnabled !== undefined) {
					ctEnabled = patch.ctEnabled;
				}
				if (patch.ctWidthLevel !== undefined) {
					ctWidthLevel = patch.ctWidthLevel;
				}
				if (patch.ctCardSizeLevel !== undefined) {
					ctCardSizeLevel = patch.ctCardSizeLevel;
				}
				if (patch.ctBadgeSizeLevel !== undefined) {
					ctBadgeSizeLevel = patch.ctBadgeSizeLevel;
				}
				if (patch.useActionDice !== undefined) {
					useActionDice = patch.useActionDice;
				}
				if (patch.layoutVersionDelta) {
					layoutVersion += patch.layoutVersionDelta;
				}
				if (patch.visibilityPermissions !== undefined) {
					ctVisibilityPermissions = patch.visibilityPermissions;
				}
				if (patch.shouldCenterActiveEntry) {
					void centerActiveEntryInView(activeEntryKey, 'auto');
				}
			},
		});
	});

	onDestroy(() => {
		if (resizeListener) window.removeEventListener('resize', resizeListener);
		if (ctWidthPreviewListener) {
			window.removeEventListener(CT_WIDTH_PREVIEW_EVENT_NAME, ctWidthPreviewListener);
		}
		if (unregisterCtHooks) unregisterCtHooks();
	});

	$effect(() => {
		trackDependency(centerActiveCardEnabled);
		void centerActiveEntryInView(activeEntryKey);
	});

	$effect(() => {
		trackDependency(orderedAliveEntries.length);
		trackDependency(layoutVersion);
		void tick().then(() => {
			updateTrackViewportMetrics();
		});
	});

	$effect(() => {
		const normalizedMonsterCardsExpanded = resolveMonsterCardsExpandedState({
			hasMonsterCombatants,
			canCurrentUserExpandMonsterCards,
			monsterCardsExpanded,
		});
		if (monsterCardsExpanded !== normalizedMonsterCardsExpanded) {
			monsterCardsExpanded = normalizedMonsterCardsExpanded;
		}
	});
</script>

{#if ctEnabled && currentCombat}
	<section
		class="nimble-ct-shell"
		style={`--nimble-ct-track-max-width: ${ctTrackMaxWidth}; --nimble-ct-card-scale: ${ctCardScale}; --nimble-ct-badge-scale: ${ctBadgeScale};`}
		in:fade={{ duration: 120 }}
	>
		{#if ctWidthPreviewVisible}
			<div
				class="nimble-ct__width-preview"
				style={`--nimble-ct-width-preview-max: ${ctWidthPreviewMaxWidth};`}
				aria-hidden="true"
			>
				<div class="nimble-ct__width-preview-track">
					<span class="nimble-ct__width-preview-line nimble-ct__width-preview-line--left">
						<svg
							class="nimble-ct__width-preview-svg"
							viewBox="0 0 4 100"
							preserveAspectRatio="none"
							aria-hidden="true"
						>
							<line class="nimble-ct__width-preview-stroke" x1="2" y1="0" x2="2" y2="100"></line>
						</svg>
					</span>
					<span class="nimble-ct__width-preview-line nimble-ct__width-preview-line--right">
						<svg
							class="nimble-ct__width-preview-svg"
							viewBox="0 0 4 100"
							preserveAspectRatio="none"
							aria-hidden="true"
						>
							<line class="nimble-ct__width-preview-stroke" x1="2" y1="0" x2="2" y2="100"></line>
						</svg>
					</span>
				</div>
			</div>
		{/if}
		<div class="nimble-ct">
			{#if game.user?.isGM || (hasMonsterCombatants && canCurrentUserExpandMonsterCards)}
				<div class="nimble-ct__controls" aria-label="Combat controls left">
					{#if hasMonsterCombatants && canCurrentUserExpandMonsterCards}
						<button
							class="nimble-ct__icon-button"
							aria-label={monsterCardsExpanded ? 'Collapse Monsters' : 'Expand Monsters'}
							data-tooltip={monsterCardsExpanded ? 'Collapse Monsters' : 'Expand Monsters'}
							data-tooltip-direction="LEFT"
							onclick={toggleMonsterCardExpansion}
						>
							<i class={`fa-solid ${monsterCardsExpanded ? 'fa-compress' : 'fa-expand'}`}></i>
						</button>
					{/if}
					{#if game.user?.isGM}
						<button
							class="nimble-ct__icon-button"
							aria-label="Roll Initiative"
							data-tooltip="Roll Initiative"
							data-tooltip-direction="LEFT"
							onclick={(event) => handleControlAction(event, 'roll-all')}
							><i class="fa-solid fa-users"></i></button
						>
						<button
							class="nimble-ct__icon-button"
							aria-label="Previous Turn"
							data-tooltip="Previous Turn"
							data-tooltip-direction="LEFT"
							onclick={(event) => handleControlAction(event, 'previous-turn')}
							><i class="fa-solid fa-chevron-left"></i></button
						>
						<button
							class="nimble-ct__icon-button"
							aria-label="Previous Round"
							data-tooltip="Previous Round"
							data-tooltip-direction="LEFT"
							onclick={(event) => handleControlAction(event, 'previous-round')}
							><i class="fa-solid fa-chevrons-left"></i></button
						>
					{/if}
				</div>
			{/if}

			<div class="nimble-ct__viewport">
				<ol
					class="nimble-ct__track"
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
							class="nimble-ct__virtual-spacer"
							aria-hidden="true"
							style={`width: ${virtualizedAliveEntries.leadingWidthPx}px;`}
						></li>
					{/if}
					{#each virtualizedAliveEntries.entries as entry, localIndex (entry.key)}
						{@const index = virtualizedAliveEntries.startIndex + localIndex}
						{#if combatStarted && roundSeparatorIndex === index}
							<li class="nimble-ct__round-separator" data-tooltip="Current Round">
								<span class="nimble-ct__round-separator-line"></span>
								<span class="nimble-ct__round-separator-round"
									><i class="fa-solid fa-angle-right"></i>{currentRoundLabel}</span
								>
							</li>
						{/if}
						{#if entry.kind === 'combatant' && entry.combatant}
							{@const actionState = getActionState(entry.combatant)}
							{@const combatantId = getCombatantId(entry.combatant)}
							{@const isPlayerEntry = isPlayerCombatant(entry.combatant)}
							{@const cardOutlineClass = getCombatantOutlineClass(
								entry.combatant,
								ctVisibilityPermissions,
							)}
							{@const canDragEntry = canDragCombatant(entry.combatant)}
							{@const hpBadgeText = getCombatantHpBadgeText(
								entry.combatant,
								ctVisibilityPermissions,
							)}
							{@const hpBadgeTooltip = getCombatantHpBadgeTooltip(
								entry.combatant,
								ctVisibilityPermissions,
							)}
							{@const resourceChips = isPlayerEntry
								? []
								: getCombatantCardResourceChips(entry.combatant, ctVisibilityPermissions)}
							{@const resourceDrawerData = isPlayerEntry
								? getPlayerCombatantDrawerData(entry.combatant, ctVisibilityPermissions)
								: null}
							{@const cardName = getCombatantDisplayName(entry.combatant)}
							{@const canShowActions = shouldRenderCombatantActions(
								entry.combatant,
								ctVisibilityPermissions,
							)}
							{@const showEndTurnOverlay =
								combatStarted && activeEntryKey === entry.key && canCurrentUserEndTurn}
							<!-- svelte-ignore a11y_click_events_have_key_events -->
							<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
							<li
								class={`nimble-ct__portrait ${cardOutlineClass} ${isPlayerEntry ? 'nimble-ct__portrait--resource-drawer' : 'nimble-ct__portrait--name-drawer'}`}
								class:nimble-ct__portrait--active={activeEntryKey === entry.key}
								class:nimble-ct__portrait--dead={entry.combatant.defeated}
								class:nimble-ct__portrait--draggable={canDragEntry}
								class:nimble-ct__portrait--preview-gap-before={dragPreview?.targetId ===
									combatantId && dragPreview.before}
								class:nimble-ct__portrait--preview-gap-after={dragPreview?.targetId ===
									combatantId && !dragPreview.before}
								data-track-key={entry.key}
								data-combatant-id={combatantId}
								onclick={(event) => handleCombatantCardClick(event, entry.combatant)}
								oncontextmenu={(event) => handleCombatantCardContextMenu(event, entry.combatant)}
								onpointerdown={(event) => handleCombatantCardPointerDown(event, combatantId)}
								draggable={canDragEntry}
								ondragstart={(event) => handleCombatantCardDragStart(event, entry.combatant)}
								ondragend={handleCombatantCardDragEnd}
							>
								<div class={`nimble-ct__portrait-card ${isPlayerEntry ? cardOutlineClass : ''}`}>
									<img
										class="nimble-ct__image"
										src={getCombatantImageForDisplay(entry.combatant)}
										alt="Combatant portrait"
										draggable="false"
									/>
									{#if canDragEntry}
										<div
											class="nimble-ct__drag-handle"
											data-ct-drag-handle="true"
											data-combatant-id={combatantId}
										></div>
									{/if}
									{#if !isPlayerEntry && shouldRenderHpBadge(entry.combatant, ctVisibilityPermissions) && hpBadgeText}
										<span
											class={`nimble-ct__badge nimble-ct__badge--hp ${getCombatantHpBadgeClass(entry.combatant)}`}
											data-tooltip={hpBadgeTooltip}>{hpBadgeText}</span
										>
									{/if}
									{#if resourceChips.length > 0}
										<div class="nimble-ct__resource-chips">
											{#each resourceChips as resourceChip (resourceChip.key)}
												<span
													class={`nimble-ct__resource-chip nimble-ct__resource-chip--${resourceChip.tone}`}
													class:nimble-ct__resource-chip--inactive={resourceChip.active === false}
													data-tooltip={resourceChip.title}
												>
													<i class={resourceChip.iconClass}></i>
													{#if resourceChip.text}
														<span class="nimble-ct__resource-chip-text">{resourceChip.text}</span>
													{/if}
												</span>
											{/each}
										</div>
									{/if}
									{#if shouldShowInitiativePromptForCombatant(entry.combatant)}
										<button
											class="nimble-ct__initiative-roll"
											type="button"
											aria-label="Roll Initiative"
											data-tooltip="Roll Initiative"
											data-tooltip-direction="UP"
											disabled={!canCurrentUserRollInitiativeForCombatant(entry.combatant)}
											onclick={(event) => {
												void handleCombatantInitiativeRoll(event, entry.combatant);
											}}
										>
											<i class="fa-solid fa-dice-d20"></i>
										</button>
									{/if}
									{#if canShowActions}
										<div class="nimble-ct__pips">
											{#if useActionDice}
												{#each actionState.slots as slot}
													<button
														type="button"
														class="nimble-ct__action-die-button"
														aria-label={`Set actions to ${slot + 1}`}
														data-tooltip={`Set actions to ${slot + 1}`}
														data-tooltip-direction="UP"
														disabled={!canCurrentUserAdjustCombatantActions(entry.combatant)}
														onclick={(event) => {
															void handleActionDieClick(event, entry.combatant, slot);
														}}
													>
														<i
															class={`${getActionDiceIconClass(slot)} ${slot < actionState.current ? 'nimble-ct__action-die--active' : 'nimble-ct__action-die--spent'}`}
														></i>
													</button>
												{/each}
												{#if actionState.overflow > 0}
													<span class="nimble-ct__action-overflow">+{actionState.overflow}</span>
												{/if}
											{:else}
												{@const displayCurrentActions = Math.max(
													0,
													Math.floor(actionState.current),
												)}
												{@const displayMaxActions = Math.max(0, Math.floor(actionState.max))}
												{@const canAdjustActions = canCurrentUserAdjustCombatantActions(
													entry.combatant,
												)}
												<div
													class="nimble-ct__action-box-shell"
													class:nimble-ct__action-box-shell--editable={canAdjustActions}
												>
													{#if canAdjustActions}
														<button
															type="button"
															class="nimble-ct__action-adjust nimble-ct__action-adjust--minus"
															aria-label="Decrease available actions"
															data-tooltip="Decrease actions"
															data-tooltip-direction="UP"
															disabled={displayCurrentActions <= 0}
															onclick={(event) => {
																void handleActionDeltaClick(event, entry.combatant, -1);
															}}
														>
															<i class="fa-solid fa-minus"></i>
														</button>
													{/if}
													<span
														class="nimble-ct__action-box"
														data-tooltip={`Available actions: ${displayCurrentActions} / ${displayMaxActions}`}
														data-tooltip-direction="UP"
													>
														{displayCurrentActions}/{displayMaxActions}
													</span>
													{#if canAdjustActions}
														<button
															type="button"
															class="nimble-ct__action-adjust nimble-ct__action-adjust--plus"
															aria-label="Increase available actions"
															data-tooltip="Increase actions"
															data-tooltip-direction="UP"
															disabled={!game.user?.isGM &&
																displayCurrentActions >= displayMaxActions}
															onclick={(event) => {
																void handleActionDeltaClick(event, entry.combatant, 1);
															}}
														>
															<i class="fa-solid fa-plus"></i>
														</button>
													{/if}
												</div>
											{/if}
										</div>
									{/if}
									{#if showEndTurnOverlay}
										<button
											class="nimble-ct__end-turn-overlay"
											type="button"
											aria-label="End Turn"
											onclick={handleEndTurnFromCard}
										>
											End Turn
										</button>
									{/if}
								</div>
								{#if isPlayerEntry && resourceDrawerData && cardName}
									<div class="nimble-ct__resource-drawer-stack">
										<div class="nimble-ct__resource-drawer">
											<div
												class={`nimble-ct__drawer-cell nimble-ct__drawer-cell--left nimble-ct__drawer-cell--hp ${getCombatantHpBadgeClass(entry.combatant)}`}
												class:nimble-ct__drawer-cell--hidden={!resourceDrawerData.hp.visible}
												data-tooltip={resourceDrawerData.hp.title}
												data-tooltip-direction="LEFT"
											>
												{#if resourceDrawerData.hp.visible && resourceDrawerData.hp.text}
													{#if resourceDrawerData.hp.iconClass}
														<i class={resourceDrawerData.hp.iconClass}></i>
													{/if}
													<span class="nimble-ct__drawer-text">{resourceDrawerData.hp.text}</span>
												{/if}
											</div>
											<button
												type="button"
												class="nimble-ct__drawer-cell nimble-ct__drawer-reaction-button nimble-ct__drawer-cell--utility"
												class:nimble-ct__drawer-cell--inactive={resourceDrawerData.defend.active ===
													false}
												class:nimble-ct__drawer-cell--hidden={!resourceDrawerData.defend.visible}
												data-tooltip={resourceDrawerData.defend.title}
												data-tooltip-direction="RIGHT"
												disabled={!canToggleHeroicReactionFromDrawer(
													entry.combatant,
													'defend',
													resourceDrawerData.defend.active,
												)}
												onclick={(event) =>
													handleHeroicReactionToggle(event, entry.combatant, 'defend')}
											>
												{#if resourceDrawerData.defend.visible}
													<i class={resourceDrawerData.defend.iconClass}></i>
												{/if}
											</button>
											<button
												type="button"
												class="nimble-ct__drawer-cell nimble-ct__drawer-reaction-button nimble-ct__drawer-cell--utility"
												class:nimble-ct__drawer-cell--inactive={resourceDrawerData.interpose
													.active === false}
												class:nimble-ct__drawer-cell--hidden={!resourceDrawerData.interpose.visible}
												data-tooltip={resourceDrawerData.interpose.title}
												data-tooltip-direction="RIGHT"
												disabled={!canToggleHeroicReactionFromDrawer(
													entry.combatant,
													'interpose',
													resourceDrawerData.interpose.active,
												)}
												onclick={(event) =>
													handleHeroicReactionToggle(event, entry.combatant, 'interpose')}
											>
												{#if resourceDrawerData.interpose.visible}
													<i class={resourceDrawerData.interpose.iconClass}></i>
												{/if}
											</button>
											<div
												class="nimble-ct__drawer-cell nimble-ct__drawer-cell--wounds"
												class:nimble-ct__drawer-cell--hidden={!resourceDrawerData.wounds.visible}
												data-tooltip={resourceDrawerData.wounds.title}
												data-tooltip-direction="LEFT"
											>
												{#if resourceDrawerData.wounds.visible}
													<i class={resourceDrawerData.wounds.iconClass}></i>
													{#if resourceDrawerData.wounds.text}
														<span class="nimble-ct__drawer-text"
															>{resourceDrawerData.wounds.text}</span
														>
													{/if}
												{/if}
											</div>
											<button
												type="button"
												class="nimble-ct__drawer-cell nimble-ct__drawer-reaction-button nimble-ct__drawer-cell--utility"
												class:nimble-ct__drawer-cell--inactive={resourceDrawerData.opportunityAttack
													.active === false}
												class:nimble-ct__drawer-cell--hidden={!resourceDrawerData.opportunityAttack
													.visible}
												data-tooltip={resourceDrawerData.opportunityAttack.title}
												data-tooltip-direction="RIGHT"
												disabled={!canToggleHeroicReactionFromDrawer(
													entry.combatant,
													'opportunityAttack',
													resourceDrawerData.opportunityAttack.active,
												)}
												onclick={(event) =>
													handleHeroicReactionToggle(event, entry.combatant, 'opportunityAttack')}
											>
												{#if resourceDrawerData.opportunityAttack.visible}
													<i class={resourceDrawerData.opportunityAttack.iconClass}></i>
												{/if}
											</button>
											<button
												type="button"
												class="nimble-ct__drawer-cell nimble-ct__drawer-reaction-button nimble-ct__drawer-cell--utility"
												class:nimble-ct__drawer-cell--inactive={resourceDrawerData.help.active ===
													false}
												class:nimble-ct__drawer-cell--hidden={!resourceDrawerData.help.visible}
												data-tooltip={resourceDrawerData.help.title}
												data-tooltip-direction="RIGHT"
												disabled={!canToggleHeroicReactionFromDrawer(
													entry.combatant,
													'help',
													resourceDrawerData.help.active,
												)}
												onclick={(event) =>
													handleHeroicReactionToggle(event, entry.combatant, 'help')}
											>
												{#if resourceDrawerData.help.visible}
													<i class={resourceDrawerData.help.iconClass}></i>
												{/if}
											</button>
										</div>
										<div class="nimble-ct__player-name-drawer">
											<span class="nimble-ct__player-name-drawer-text">{cardName}</span>
										</div>
									</div>
								{:else if cardName}
									<div class="nimble-ct__name-drawer-stack">
										<div class="nimble-ct__player-name-drawer">
											<span class="nimble-ct__player-name-drawer-text">{cardName}</span>
										</div>
									</div>
								{/if}
							</li>
						{:else}
							<!-- svelte-ignore a11y_click_events_have_key_events -->
							<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
							<li
								class={`nimble-ct__portrait nimble-ct__portrait--monster nimble-ct__portrait--name-drawer ${showMonsterStackOutline ? 'nimble-ct__portrait--outline-monster' : ''}`}
								class:nimble-ct__portrait--active={activeEntryKey === entry.key}
								data-track-key={entry.key}
								onclick={handleMonsterStackClick}
								oncontextmenu={handleMonsterStackContextMenu}
							>
								<div class="nimble-ct__portrait-card">
									<span class="nimble-ct__monster-stack-icon" aria-hidden="true">
										<i class="fa-solid fa-dragon"></i>
									</span>
									<span class="nimble-ct__badge">x{sceneAllMonsterCombatants.length}</span>
									{#if combatStarted && activeEntryKey === entry.key && canCurrentUserEndTurn}
										<button
											class="nimble-ct__end-turn-overlay"
											type="button"
											aria-label="End Turn"
											onclick={handleEndTurnFromCard}
										>
											End Turn
										</button>
									{/if}
								</div>
								<div class="nimble-ct__name-drawer-stack">
									<div class="nimble-ct__player-name-drawer">
										<span class="nimble-ct__player-name-drawer-text">Monsters and Minions</span>
									</div>
								</div>
							</li>
						{/if}
					{/each}
					{#if combatStarted && orderedAliveEntries.length > 0 && roundSeparatorIndex < 0}
						<li class="nimble-ct__round-separator" data-tooltip="Current Round">
							<span class="nimble-ct__round-separator-line"></span>
							<span class="nimble-ct__round-separator-round"
								><i class="fa-solid fa-angle-right"></i>{currentRoundLabel}</span
							>
						</li>
					{/if}
					{#if virtualizedAliveEntries.trailingWidthPx > 0}
						<li
							class="nimble-ct__virtual-spacer"
							aria-hidden="true"
							style={`width: ${virtualizedAliveEntries.trailingWidthPx}px;`}
						></li>
					{/if}

					{#if renderedDeadCombatants.length > 0}
						<li class="nimble-ct__dead">Dead</li>
						{#each renderedDeadCombatants as combatant (combatant._id)}
							{@const actionState = getActionState(combatant)}
							{@const isPlayerEntry = isPlayerCombatant(combatant)}
							{@const cardOutlineClass = getCombatantOutlineClass(
								combatant,
								ctVisibilityPermissions,
							)}
							{@const hpBadgeText = getCombatantHpBadgeText(combatant, ctVisibilityPermissions)}
							{@const hpBadgeTooltip = getCombatantHpBadgeTooltip(
								combatant,
								ctVisibilityPermissions,
							)}
							{@const resourceChips = isPlayerEntry
								? []
								: getCombatantCardResourceChips(combatant, ctVisibilityPermissions)}
							{@const resourceDrawerData = isPlayerEntry
								? getPlayerCombatantDrawerData(combatant, ctVisibilityPermissions)
								: null}
							{@const cardName = getCombatantDisplayName(combatant)}
							{@const canShowActions = shouldRenderCombatantActions(
								combatant,
								ctVisibilityPermissions,
							)}
							<!-- svelte-ignore a11y_click_events_have_key_events -->
							<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
							<li
								class={`nimble-ct__portrait nimble-ct__portrait--dead ${cardOutlineClass} ${isPlayerEntry ? 'nimble-ct__portrait--resource-drawer' : 'nimble-ct__portrait--name-drawer'}`}
								data-track-key={`dead-${getCombatantId(combatant)}`}
								onclick={(event) => handleCombatantCardClick(event, combatant)}
								oncontextmenu={(event) => handleCombatantCardContextMenu(event, combatant)}
							>
								<div class={`nimble-ct__portrait-card ${isPlayerEntry ? cardOutlineClass : ''}`}>
									<img
										class="nimble-ct__image"
										src={getCombatantImageForDisplay(combatant)}
										alt="Dead combatant portrait"
										draggable="false"
									/>
									{#if !isPlayerEntry && shouldRenderHpBadge(combatant, ctVisibilityPermissions) && hpBadgeText}
										<span
											class={`nimble-ct__badge nimble-ct__badge--hp ${getCombatantHpBadgeClass(combatant)}`}
											data-tooltip={hpBadgeTooltip}>{hpBadgeText}</span
										>
									{/if}
									{#if resourceChips.length > 0}
										<div class="nimble-ct__resource-chips">
											{#each resourceChips as resourceChip (resourceChip.key)}
												<span
													class={`nimble-ct__resource-chip nimble-ct__resource-chip--${resourceChip.tone}`}
													class:nimble-ct__resource-chip--inactive={resourceChip.active === false}
													data-tooltip={resourceChip.title}
												>
													<i class={resourceChip.iconClass}></i>
													{#if resourceChip.text}
														<span class="nimble-ct__resource-chip-text">{resourceChip.text}</span>
													{/if}
												</span>
											{/each}
										</div>
									{/if}
									{#if canShowActions}
										<div class="nimble-ct__pips">
											{#if useActionDice}
												{#each actionState.slots as slot}
													<button
														type="button"
														class="nimble-ct__action-die-button"
														aria-label={`Set actions to ${slot + 1}`}
														data-tooltip={`Set actions to ${slot + 1}`}
														data-tooltip-direction="UP"
														disabled={!canCurrentUserAdjustCombatantActions(combatant)}
														onclick={(event) => {
															void handleActionDieClick(event, combatant, slot);
														}}
													>
														<i
															class={`${getActionDiceIconClass(slot)} ${slot < actionState.current ? 'nimble-ct__action-die--active' : 'nimble-ct__action-die--spent'}`}
														></i>
													</button>
												{/each}
												{#if actionState.overflow > 0}
													<span class="nimble-ct__action-overflow">+{actionState.overflow}</span>
												{/if}
											{:else}
												{@const displayCurrentActions = Math.max(
													0,
													Math.floor(actionState.current),
												)}
												{@const displayMaxActions = Math.max(0, Math.floor(actionState.max))}
												{@const canAdjustActions = canCurrentUserAdjustCombatantActions(combatant)}
												<div
													class="nimble-ct__action-box-shell"
													class:nimble-ct__action-box-shell--editable={canAdjustActions}
												>
													{#if canAdjustActions}
														<button
															type="button"
															class="nimble-ct__action-adjust nimble-ct__action-adjust--minus"
															aria-label="Decrease available actions"
															data-tooltip="Decrease actions"
															data-tooltip-direction="UP"
															disabled={displayCurrentActions <= 0}
															onclick={(event) => {
																void handleActionDeltaClick(event, combatant, -1);
															}}
														>
															<i class="fa-solid fa-minus"></i>
														</button>
													{/if}
													<span
														class="nimble-ct__action-box"
														data-tooltip={`Available actions: ${displayCurrentActions} / ${displayMaxActions}`}
														data-tooltip-direction="UP"
													>
														{displayCurrentActions}/{displayMaxActions}
													</span>
													{#if canAdjustActions}
														<button
															type="button"
															class="nimble-ct__action-adjust nimble-ct__action-adjust--plus"
															aria-label="Increase available actions"
															data-tooltip="Increase actions"
															data-tooltip-direction="UP"
															disabled={!game.user?.isGM &&
																displayCurrentActions >= displayMaxActions}
															onclick={(event) => {
																void handleActionDeltaClick(event, combatant, 1);
															}}
														>
															<i class="fa-solid fa-plus"></i>
														</button>
													{/if}
												</div>
											{/if}
										</div>
									{/if}
								</div>
								{#if isPlayerEntry && resourceDrawerData && cardName}
									<div class="nimble-ct__resource-drawer-stack">
										<div class="nimble-ct__resource-drawer">
											<div
												class={`nimble-ct__drawer-cell nimble-ct__drawer-cell--left nimble-ct__drawer-cell--hp ${getCombatantHpBadgeClass(combatant)}`}
												class:nimble-ct__drawer-cell--hidden={!resourceDrawerData.hp.visible}
												data-tooltip={resourceDrawerData.hp.title}
												data-tooltip-direction="LEFT"
											>
												{#if resourceDrawerData.hp.visible && resourceDrawerData.hp.text}
													{#if resourceDrawerData.hp.iconClass}
														<i class={resourceDrawerData.hp.iconClass}></i>
													{/if}
													<span class="nimble-ct__drawer-text">{resourceDrawerData.hp.text}</span>
												{/if}
											</div>
											<button
												type="button"
												class="nimble-ct__drawer-cell nimble-ct__drawer-reaction-button nimble-ct__drawer-cell--utility"
												class:nimble-ct__drawer-cell--inactive={resourceDrawerData.defend.active ===
													false}
												class:nimble-ct__drawer-cell--hidden={!resourceDrawerData.defend.visible}
												data-tooltip={resourceDrawerData.defend.title}
												data-tooltip-direction="RIGHT"
												disabled={!canToggleHeroicReactionFromDrawer(
													combatant,
													'defend',
													resourceDrawerData.defend.active,
												)}
												onclick={(event) => handleHeroicReactionToggle(event, combatant, 'defend')}
											>
												{#if resourceDrawerData.defend.visible}
													<i class={resourceDrawerData.defend.iconClass}></i>
												{/if}
											</button>
											<button
												type="button"
												class="nimble-ct__drawer-cell nimble-ct__drawer-reaction-button nimble-ct__drawer-cell--utility"
												class:nimble-ct__drawer-cell--inactive={resourceDrawerData.interpose
													.active === false}
												class:nimble-ct__drawer-cell--hidden={!resourceDrawerData.interpose.visible}
												data-tooltip={resourceDrawerData.interpose.title}
												data-tooltip-direction="RIGHT"
												disabled={!canToggleHeroicReactionFromDrawer(
													combatant,
													'interpose',
													resourceDrawerData.interpose.active,
												)}
												onclick={(event) =>
													handleHeroicReactionToggle(event, combatant, 'interpose')}
											>
												{#if resourceDrawerData.interpose.visible}
													<i class={resourceDrawerData.interpose.iconClass}></i>
												{/if}
											</button>
											<div
												class="nimble-ct__drawer-cell nimble-ct__drawer-cell--wounds"
												class:nimble-ct__drawer-cell--hidden={!resourceDrawerData.wounds.visible}
												data-tooltip={resourceDrawerData.wounds.title}
												data-tooltip-direction="LEFT"
											>
												{#if resourceDrawerData.wounds.visible}
													<i class={resourceDrawerData.wounds.iconClass}></i>
													{#if resourceDrawerData.wounds.text}
														<span class="nimble-ct__drawer-text"
															>{resourceDrawerData.wounds.text}</span
														>
													{/if}
												{/if}
											</div>
											<button
												type="button"
												class="nimble-ct__drawer-cell nimble-ct__drawer-reaction-button nimble-ct__drawer-cell--utility"
												class:nimble-ct__drawer-cell--inactive={resourceDrawerData.opportunityAttack
													.active === false}
												class:nimble-ct__drawer-cell--hidden={!resourceDrawerData.opportunityAttack
													.visible}
												data-tooltip={resourceDrawerData.opportunityAttack.title}
												data-tooltip-direction="RIGHT"
												disabled={!canToggleHeroicReactionFromDrawer(
													combatant,
													'opportunityAttack',
													resourceDrawerData.opportunityAttack.active,
												)}
												onclick={(event) =>
													handleHeroicReactionToggle(event, combatant, 'opportunityAttack')}
											>
												{#if resourceDrawerData.opportunityAttack.visible}
													<i class={resourceDrawerData.opportunityAttack.iconClass}></i>
												{/if}
											</button>
											<button
												type="button"
												class="nimble-ct__drawer-cell nimble-ct__drawer-reaction-button nimble-ct__drawer-cell--utility"
												class:nimble-ct__drawer-cell--inactive={resourceDrawerData.help.active ===
													false}
												class:nimble-ct__drawer-cell--hidden={!resourceDrawerData.help.visible}
												data-tooltip={resourceDrawerData.help.title}
												data-tooltip-direction="RIGHT"
												disabled={!canToggleHeroicReactionFromDrawer(
													combatant,
													'help',
													resourceDrawerData.help.active,
												)}
												onclick={(event) => handleHeroicReactionToggle(event, combatant, 'help')}
											>
												{#if resourceDrawerData.help.visible}
													<i class={resourceDrawerData.help.iconClass}></i>
												{/if}
											</button>
										</div>
										<div class="nimble-ct__player-name-drawer">
											<span class="nimble-ct__player-name-drawer-text">{cardName}</span>
										</div>
									</div>
								{:else if cardName}
									<div class="nimble-ct__name-drawer-stack">
										<div class="nimble-ct__player-name-drawer">
											<span class="nimble-ct__player-name-drawer-text">{cardName}</span>
										</div>
									</div>
								{/if}
							</li>
						{/each}
					{/if}
				</ol>
				{#if showTrackScrollbar && trackScrollbarMetrics}
					<div
						class="nimble-ct__scrollbar"
						bind:this={trackScrollbarElement}
						onpointerdown={handleTrackScrollbarPointerDown}
						onpointermove={handleTrackScrollbarPointerMove}
						onpointerup={handleTrackScrollbarPointerRelease}
						onpointercancel={handleTrackScrollbarPointerRelease}
						onlostpointercapture={(event) => {
							handleTrackScrollbarPointerRelease(event);
						}}
					>
						<div
							class="nimble-ct__scrollbar-thumb"
							style={`width: ${trackScrollbarMetrics.thumbWidthPx}px; --nimble-ct-scrollbar-thumb-left: ${trackScrollbarMetrics.thumbLeftPx}px;`}
						></div>
					</div>
				{/if}
			</div>

			{#if game.user}
				<div class="nimble-ct__controls" aria-label="Combat controls right">
					{#if game.user?.isGM}
						<button
							class="nimble-ct__icon-button"
							aria-label="Start Combat"
							data-tooltip="Start Combat"
							data-tooltip-direction="RIGHT"
							style={combatStarted ? 'display: none;' : ''}
							onclick={(event) => handleControlAction(event, 'start-combat')}
							><i class="fa-solid fa-play"></i></button
						>
						<button
							class="nimble-ct__icon-button"
							aria-label="End Combat"
							data-tooltip="End Combat"
							data-tooltip-direction="RIGHT"
							onclick={(event) => handleControlAction(event, 'end-combat')}
							><i class="fa-solid fa-ban"></i></button
						>
					{/if}
					<button
						class="nimble-ct__icon-button"
						aria-label="Combat Settings"
						data-tooltip="Combat Settings"
						data-tooltip-direction="RIGHT"
						onclick={(event) => handleControlAction(event, 'configure')}
						><i class="fa-solid fa-gear"></i></button
					>
					{#if game.user?.isGM}
						<button
							class="nimble-ct__icon-button"
							aria-label="Next Turn"
							data-tooltip="Next Turn"
							data-tooltip-direction="RIGHT"
							onclick={(event) => handleControlAction(event, 'next-turn')}
							><i class="fa-solid fa-chevron-right"></i></button
						>
						<button
							class="nimble-ct__icon-button"
							aria-label="Next Round"
							data-tooltip="Next Round"
							data-tooltip-direction="RIGHT"
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
	.nimble-ct-shell {
		--nimble-ct-action-color: var(--nimble-ct-action-die-color, #ffffff);
		--nimble-ct-action-color-resolved: var(--nimble-ct-action-color);
		--nimble-ct-action-box-bg: color-mix(in srgb, hsl(225 27% 9%) 84%, black 16%);
		--nimble-ct-action-box-border: color-mix(
			in srgb,
			var(--nimble-ct-action-color-resolved) 72%,
			white 28%
		);
		--nimble-ct-action-box-glow: color-mix(
			in srgb,
			var(--nimble-ct-action-color-resolved) 26%,
			transparent
		);
		--nimble-ct-action-adjust-bg: color-mix(in srgb, hsl(226 26% 10%) 86%, black 14%);
		--nimble-ct-action-adjust-border: color-mix(
			in srgb,
			var(--nimble-ct-action-color-resolved) 58%,
			white 42%
		);
		--nimble-ct-action-text-shadow: 0 0 0.18rem color-mix(in srgb, black 70%, transparent);
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		width: 100vw;
		display: flex;
		justify-content: center;
		z-index: 30;
		pointer-events: none;
	}
	.nimble-ct__width-preview {
		position: absolute;
		inset: 0;
		pointer-events: none;
		z-index: 6;
	}
	.nimble-ct__width-preview-track {
		position: absolute;
		top: 0;
		bottom: 0;
		left: 50%;
		width: min(100vw, var(--nimble-ct-width-preview-max));
		transform: translateX(-50%);
	}
	.nimble-ct__width-preview-line {
		position: absolute;
		top: 0;
		bottom: 0;
		width: 4px;
		opacity: 0.9;
	}
	.nimble-ct__width-preview-svg {
		display: block;
		width: 100%;
		height: 100%;
		overflow: visible;
		filter: drop-shadow(0 0 0.26rem color-mix(in srgb, hsl(206 92% 58%) 95%, transparent))
			drop-shadow(0 0 0.6rem color-mix(in srgb, hsl(211 94% 56%) 88%, transparent));
	}
	.nimble-ct__width-preview-stroke {
		stroke: color-mix(in srgb, white 92%, hsl(0 0% 78%) 8%);
		stroke-width: 2.4;
		stroke-dasharray: 6 10;
		stroke-linecap: round;
		vector-effect: non-scaling-stroke;
	}
	.nimble-ct__width-preview-line--left {
		left: 0;
	}
	.nimble-ct__width-preview-line--right {
		right: 0;
	}
	:global(.theme-light) .nimble-ct-shell {
		--nimble-ct-action-color-resolved: hsl(220 36% 22%);
		--nimble-ct-action-box-bg: color-mix(in srgb, white 78%, var(--nimble-ct-action-color) 22%);
		--nimble-ct-action-box-border: color-mix(
			in srgb,
			var(--nimble-ct-action-color) 72%,
			hsl(219 28% 42%) 28%
		);
		--nimble-ct-action-box-glow: color-mix(in srgb, var(--nimble-ct-action-color) 32%, transparent);
		--nimble-ct-action-adjust-bg: color-mix(in srgb, white 70%, var(--nimble-ct-action-color) 30%);
		--nimble-ct-action-adjust-border: color-mix(
			in srgb,
			var(--nimble-ct-action-color) 66%,
			hsl(219 28% 42%) 34%
		);
		--nimble-ct-action-text-shadow: 0 0 0 transparent;
	}
	.nimble-ct {
		--nimble-ct-hover-hitbox-inline: 0.45rem;
		--nimble-ct-control-hover-bridge: 0.8rem;
		--nimble-ct-control-hover-bleed: 0.34rem;
		position: relative;
		z-index: 1;
		pointer-events: none;
		display: grid;
		grid-template-columns: auto auto auto;
		gap: 0.2rem;
		align-items: start;
		justify-content: center;
		width: fit-content;
		max-width: calc(var(--nimble-ct-track-max-width) + 7rem);
		/* Extend hover/focus activation zone slightly past side control bars. */
		padding-inline: var(--nimble-ct-hover-hitbox-inline);
		margin-inline: calc(var(--nimble-ct-hover-hitbox-inline) * -1);
	}
	.nimble-ct__controls {
		position: relative;
		pointer-events: auto;
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
		padding: 0.2rem;
		border: 1px solid color-mix(in srgb, hsl(41 18% 54%) 60%, transparent);
		border-radius: 0.2rem;
		background: color-mix(in srgb, hsl(226 27% 8%) 86%, transparent);
		opacity: 0;
		visibility: visible;
		transition:
			opacity 120ms ease,
			visibility 0s linear 0s;
	}
	.nimble-ct__controls::before,
	.nimble-ct__controls::after {
		content: '';
		position: absolute;
		top: calc(var(--nimble-ct-hover-hitbox-inline) * -1);
		bottom: calc(var(--nimble-ct-hover-hitbox-inline) * -1);
		pointer-events: none;
	}
	.nimble-ct__controls:first-child::before {
		right: calc(var(--nimble-ct-control-hover-bridge) * -1);
		width: var(--nimble-ct-control-hover-bridge);
	}
	.nimble-ct__controls:first-child::after {
		left: calc(var(--nimble-ct-control-hover-bleed) * -1);
		width: var(--nimble-ct-control-hover-bleed);
	}
	.nimble-ct__controls:last-child::before {
		left: calc(var(--nimble-ct-control-hover-bridge) * -1);
		width: var(--nimble-ct-control-hover-bridge);
	}
	.nimble-ct__controls:last-child::after {
		right: calc(var(--nimble-ct-control-hover-bleed) * -1);
		width: var(--nimble-ct-control-hover-bleed);
	}
	.nimble-ct:has(
			.nimble-ct__portrait:hover,
			.nimble-ct__portrait:focus-within,
			.nimble-ct__round-separator:hover,
			.nimble-ct__round-separator:focus-within,
			.nimble-ct__dead:hover,
			.nimble-ct__dead:focus-within,
			.nimble-ct__controls:hover,
			.nimble-ct__controls:focus-within,
			.nimble-ct__scrollbar:hover,
			.nimble-ct__scrollbar:focus-within
		)
		.nimble-ct__controls {
		pointer-events: all;
		opacity: 1;
		visibility: visible;
		transition: opacity 120ms ease;
	}
	.nimble-ct:has(
			.nimble-ct__portrait:hover,
			.nimble-ct__portrait:focus-within,
			.nimble-ct__round-separator:hover,
			.nimble-ct__round-separator:focus-within,
			.nimble-ct__dead:hover,
			.nimble-ct__dead:focus-within,
			.nimble-ct__controls:hover,
			.nimble-ct__controls:focus-within,
			.nimble-ct__scrollbar:hover,
			.nimble-ct__scrollbar:focus-within
		)
		.nimble-ct__controls::before,
	.nimble-ct:has(
			.nimble-ct__portrait:hover,
			.nimble-ct__portrait:focus-within,
			.nimble-ct__round-separator:hover,
			.nimble-ct__round-separator:focus-within,
			.nimble-ct__dead:hover,
			.nimble-ct__dead:focus-within,
			.nimble-ct__controls:hover,
			.nimble-ct__controls:focus-within,
			.nimble-ct__scrollbar:hover,
			.nimble-ct__scrollbar:focus-within
		)
		.nimble-ct__controls::after {
		pointer-events: auto;
	}
	.nimble-ct__icon-button {
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
	.nimble-ct__controls .nimble-ct__icon-button {
		pointer-events: none;
		visibility: hidden;
	}
	.nimble-ct__icon-button:hover,
	.nimble-ct__icon-button:focus-visible {
		color: hsl(36 92% 86%);
		border-color: color-mix(in srgb, hsl(36 90% 84%) 75%, white);
		background: color-mix(in srgb, hsl(225 16% 23%) 90%, transparent);
	}
	.nimble-ct__icon-button:disabled {
		opacity: 0.45;
		cursor: not-allowed;
	}
	.nimble-ct:has(
			.nimble-ct__portrait:hover,
			.nimble-ct__portrait:focus-within,
			.nimble-ct__round-separator:hover,
			.nimble-ct__round-separator:focus-within,
			.nimble-ct__dead:hover,
			.nimble-ct__dead:focus-within,
			.nimble-ct__controls:hover,
			.nimble-ct__controls:focus-within,
			.nimble-ct__scrollbar:hover,
			.nimble-ct__scrollbar:focus-within
		)
		.nimble-ct__controls
		.nimble-ct__icon-button {
		pointer-events: auto;
		visibility: visible;
	}
	.nimble-ct__viewport {
		position: relative;
		width: fit-content;
		max-width: var(--nimble-ct-track-max-width);
		min-width: 0;
		pointer-events: none;
	}
	.nimble-ct__track {
		pointer-events: none;
		display: flex;
		align-items: flex-start;
		justify-content: flex-start;
		gap: 0.28rem;
		margin: 0;
		padding: 0 0.45rem 0;
		list-style: none;
		width: fit-content;
		max-width: var(--nimble-ct-track-max-width);
		min-width: 0;
		overflow-x: auto;
		overflow-y: hidden;
		scrollbar-width: none;
	}
	.nimble-ct__track::-webkit-scrollbar {
		height: 0;
	}
	.nimble-ct__track::-webkit-scrollbar-thumb {
		background: color-mix(in srgb, hsl(0 0% 93%) 38%, transparent);
		border-radius: 999px;
	}
	.nimble-ct__track::-webkit-scrollbar-track {
		background: transparent;
	}
	.nimble-ct__virtual-spacer {
		flex: 0 0 auto;
		height: 0.1rem;
		pointer-events: none;
	}
	.nimble-ct__portrait,
	.nimble-ct__round-separator,
	.nimble-ct__dead {
		pointer-events: auto;
	}
	.nimble-ct__scrollbar {
		position: absolute;
		left: 0;
		right: 0;
		top: calc(9.4rem * var(--nimble-ct-card-scale, 1) + 0.34rem);
		height: 0.7rem;
		display: flex;
		align-items: center;
		opacity: 0;
		visibility: hidden;
		pointer-events: none;
		transition:
			opacity 120ms ease,
			visibility 0s linear 120ms;
		z-index: 0;
	}
	.nimble-ct:has(
			.nimble-ct__portrait:hover,
			.nimble-ct__portrait:focus-within,
			.nimble-ct__round-separator:hover,
			.nimble-ct__round-separator:focus-within,
			.nimble-ct__dead:hover,
			.nimble-ct__dead:focus-within,
			.nimble-ct__controls:hover,
			.nimble-ct__controls:focus-within,
			.nimble-ct__scrollbar:hover,
			.nimble-ct__scrollbar:focus-within
		)
		.nimble-ct__scrollbar {
		opacity: 1;
		visibility: visible;
		pointer-events: auto;
		transition: opacity 120ms ease;
	}
	.nimble-ct__scrollbar::before {
		content: '';
		display: block;
		width: 100%;
		height: 0.24rem;
		border-radius: 999px;
		background: color-mix(in srgb, hsl(226 18% 14%) 78%, transparent);
		box-shadow: inset 0 0 0.16rem color-mix(in srgb, black 44%, transparent);
	}
	.nimble-ct__scrollbar-thumb {
		position: absolute;
		left: 0;
		top: 50%;
		height: 0.3rem;
		border-radius: 999px;
		background: color-mix(in srgb, hsl(0 0% 93%) 54%, transparent);
		box-shadow:
			0 0 0.18rem color-mix(in srgb, hsl(0 0% 100%) 18%, transparent),
			0 0 0.3rem color-mix(in srgb, black 28%, transparent);
		transform: translate(var(--nimble-ct-scrollbar-thumb-left, 0), -50%);
		will-change: transform;
	}
	.nimble-ct__scrollbar-thumb::after {
		content: '';
		position: absolute;
		inset: 0;
		border-radius: inherit;
		background: linear-gradient(
			180deg,
			color-mix(in srgb, hsl(0 0% 100%) 30%, transparent) 0%,
			color-mix(in srgb, hsl(0 0% 100%) 10%, transparent) 100%
		);
	}
	.nimble-ct__portrait {
		--nimble-ct-outline-border-color: color-mix(in srgb, hsl(0 0% 96%) 38%, transparent);
		--nimble-ct-outline-glow-color: transparent;
		position: relative;
		flex: 0 0 auto;
		width: calc(6.25rem * var(--nimble-ct-card-scale, 1));
		height: calc(9.4rem * var(--nimble-ct-card-scale, 1));
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
	.nimble-ct__portrait-card {
		position: relative;
		width: 100%;
		height: 100%;
		z-index: 2;
	}
	.nimble-ct__portrait--outline-player {
		--nimble-ct-outline-border-color: color-mix(in srgb, hsl(212 92% 72%) 82%, white 18%);
		--nimble-ct-outline-glow-color: color-mix(in srgb, hsl(212 92% 62%) 26%, transparent);
		border-color: var(--nimble-ct-outline-border-color);
		box-shadow: 0 0 0.42rem var(--nimble-ct-outline-glow-color);
	}
	.nimble-ct__portrait--outline-monster {
		--nimble-ct-outline-border-color: color-mix(in srgb, hsl(358 92% 60%) 82%, white 18%);
		--nimble-ct-outline-glow-color: color-mix(in srgb, hsl(355 94% 34%) 36%, transparent);
		border-color: var(--nimble-ct-outline-border-color);
		box-shadow: 0 0 0.42rem var(--nimble-ct-outline-glow-color);
	}
	.nimble-ct__portrait--outline-friendly {
		--nimble-ct-outline-border-color: color-mix(in srgb, hsl(136 68% 62%) 78%, white 22%);
		--nimble-ct-outline-glow-color: color-mix(in srgb, hsl(136 68% 48%) 24%, transparent);
		border-color: var(--nimble-ct-outline-border-color);
		box-shadow: 0 0 0.42rem var(--nimble-ct-outline-glow-color);
	}
	.nimble-ct__portrait--resource-drawer {
		--nimble-ct-resource-drawer-height: calc(6.85rem * var(--nimble-ct-card-scale, 1));
		height: calc(9.4rem * var(--nimble-ct-card-scale, 1) + var(--nimble-ct-resource-drawer-height));
	}
	.nimble-ct__portrait--name-drawer {
		--nimble-ct-name-drawer-height: calc(2.6rem * var(--nimble-ct-card-scale, 1));
		height: calc(9.4rem * var(--nimble-ct-card-scale, 1) + var(--nimble-ct-name-drawer-height));
	}
	.nimble-ct__portrait--resource-drawer,
	.nimble-ct__portrait--name-drawer {
		overflow: visible;
		background: transparent;
		border-color: transparent;
		border-radius: 0;
		box-shadow: none;
	}
	.nimble-ct__portrait--resource-drawer.nimble-ct__portrait--active {
		height: calc(
			11.2rem * var(--nimble-ct-card-scale, 1) + var(--nimble-ct-resource-drawer-height)
		);
	}
	.nimble-ct__portrait--name-drawer.nimble-ct__portrait--active {
		height: calc(11.2rem * var(--nimble-ct-card-scale, 1) + var(--nimble-ct-name-drawer-height));
	}
	.nimble-ct__portrait--resource-drawer.nimble-ct__portrait--active,
	.nimble-ct__portrait--name-drawer.nimble-ct__portrait--active {
		border-color: transparent;
		box-shadow: none;
	}
	.nimble-ct__portrait--resource-drawer .nimble-ct__portrait-card,
	.nimble-ct__portrait--name-drawer .nimble-ct__portrait-card {
		height: calc(9.4rem * var(--nimble-ct-card-scale, 1));
		overflow: hidden;
		border: 1px solid var(--nimble-ct-outline-border-color);
		border-top-width: 0;
		border-radius: 0 0 0.36rem 0.36rem;
		background: color-mix(in srgb, hsl(226 26% 8%) 90%, transparent);
		transition:
			height 140ms ease,
			border-color 140ms ease,
			box-shadow 140ms ease;
	}
	.nimble-ct__portrait--resource-drawer.nimble-ct__portrait--active .nimble-ct__portrait-card,
	.nimble-ct__portrait--name-drawer.nimble-ct__portrait--active .nimble-ct__portrait-card {
		height: calc(11.2rem * var(--nimble-ct-card-scale, 1));
		border-color: color-mix(in srgb, var(--nimble-ct-outline-border-color) 84%, white 16%);
		box-shadow:
			0 0 0.7rem color-mix(in srgb, hsl(0 0% 98%) 22%, transparent),
			0 0 0.52rem color-mix(in srgb, var(--nimble-ct-outline-glow-color) 85%, transparent);
	}
	.nimble-ct__portrait--outline-monster.nimble-ct__portrait--active .nimble-ct__portrait-card {
		border-color: color-mix(in srgb, hsl(358 96% 58%) 88%, white 12%);
		box-shadow:
			0 0 0.34rem color-mix(in srgb, hsl(358 96% 46%) 68%, transparent),
			0 0 0.78rem color-mix(in srgb, hsl(355 94% 28%) 44%, transparent);
	}
	.nimble-ct__portrait--draggable .nimble-ct__drag-handle {
		cursor: grab;
	}
	.nimble-ct__portrait--draggable .nimble-ct__drag-handle:active {
		cursor: grabbing;
	}
	.nimble-ct__portrait--preview-gap-before {
		margin-inline-start: 0.95rem;
	}
	.nimble-ct__portrait--preview-gap-after {
		margin-inline-end: 0.95rem;
	}
	.nimble-ct__portrait--active {
		width: calc(7.5rem * var(--nimble-ct-card-scale, 1));
		height: calc(11.2rem * var(--nimble-ct-card-scale, 1));
		border-color: color-mix(in srgb, hsl(0 0% 96%) 68%, transparent);
		box-shadow: 0 0 0.7rem color-mix(in srgb, hsl(0 0% 98%) 33%, transparent);
	}
	.nimble-ct__portrait--dead {
		opacity: 0.46;
	}
	.nimble-ct__portrait--dead .nimble-ct__image {
		filter: grayscale(1) contrast(1.1);
	}
	.nimble-ct__resource-drawer-stack {
		position: absolute;
		left: 50%;
		top: calc(9.4rem * var(--nimble-ct-card-scale, 1) - 0.9rem);
		z-index: 1;
		width: calc(100% - 0.72rem);
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.22rem;
		opacity: 0;
		visibility: hidden;
		pointer-events: none;
		transform: translate(-50%, -0.82rem) scaleY(0.93);
		transform-origin: top center;
		transition:
			opacity 150ms ease,
			transform 200ms cubic-bezier(0.22, 1, 0.36, 1),
			visibility 0s linear 200ms;
	}
	.nimble-ct__resource-drawer {
		position: relative;
		width: 100%;
		padding: 1.28rem 0.38rem 0.56rem;
		display: grid;
		grid-template-columns: minmax(0, 1.8fr) repeat(2, minmax(0, 1fr));
		gap: 0.18rem;
		border: 1px solid var(--nimble-ct-outline-border-color);
		border-radius: 0 0 0.44rem 0.44rem;
		background: linear-gradient(
			180deg,
			color-mix(in srgb, hsl(224 38% 14%) 94%, black 6%) 0%,
			color-mix(in srgb, hsl(227 28% 10%) 96%, black 4%) 100%
		);
		box-shadow:
			0 0 0.78rem color-mix(in srgb, hsl(42 96% 72%) 34%, transparent),
			0 0.28rem 0.9rem color-mix(in srgb, hsl(228 40% 4%) 48%, transparent),
			inset 0 0 0.48rem color-mix(in srgb, hsl(41 82% 64%) 12%, transparent);
	}
	.nimble-ct__player-name-drawer {
		width: calc(100% - 0.5rem);
		max-width: calc(100% - 0.5rem);
		padding: 0.35rem 0.7rem;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		font-size: calc(0.74rem * var(--nimble-ct-card-scale, 1));
		font-weight: 700;
		line-height: 1.05;
		color: hsl(0 0% 95%);
		text-shadow: 0 0 0.32rem color-mix(in srgb, black 75%, transparent);
		background: color-mix(in srgb, hsl(228 22% 10%) 94%, transparent);
		border: 1px solid color-mix(in srgb, hsl(38 26% 59%) 55%, transparent);
		border-radius: 0.44rem;
		box-shadow:
			0 0 0.48rem color-mix(in srgb, hsl(42 90% 66%) 20%, transparent),
			0 0.18rem 0.45rem color-mix(in srgb, black 42%, transparent);
	}
	.nimble-ct__player-name-drawer-text {
		display: block;
		max-width: 100%;
		overflow: visible;
		text-overflow: clip;
		white-space: normal;
		overflow-wrap: anywhere;
		text-align: center;
		line-height: 1.12;
	}
	.nimble-ct__portrait--resource-drawer.nimble-ct__portrait--active
		.nimble-ct__resource-drawer-stack {
		top: calc(11.2rem * var(--nimble-ct-card-scale, 1) - 0.98rem);
	}
	.nimble-ct__name-drawer-stack {
		position: absolute;
		left: 50%;
		top: calc(9.4rem * var(--nimble-ct-card-scale, 1) - 0.18rem);
		z-index: 1;
		width: 100%;
		display: flex;
		justify-content: center;
		opacity: 0;
		visibility: hidden;
		pointer-events: none;
		transform: translate(-50%, -0.46rem) scaleY(0.95);
		transform-origin: top center;
		transition:
			opacity 150ms ease,
			transform 200ms cubic-bezier(0.22, 1, 0.36, 1),
			visibility 0s linear 200ms;
	}
	.nimble-ct__portrait--name-drawer.nimble-ct__portrait--active .nimble-ct__name-drawer-stack {
		top: calc(11.2rem * var(--nimble-ct-card-scale, 1) - 0.22rem);
	}
	.nimble-ct__portrait--monster .nimble-ct__name-drawer-stack {
		top: calc(9.4rem * var(--nimble-ct-card-scale, 1) + 0.08rem);
	}
	.nimble-ct__portrait--monster.nimble-ct__portrait--active .nimble-ct__name-drawer-stack {
		top: calc(11.2rem * var(--nimble-ct-card-scale, 1) + 0.08rem);
	}
	.nimble-ct__portrait--resource-drawer:hover .nimble-ct__resource-drawer-stack,
	.nimble-ct__portrait--resource-drawer:focus-within .nimble-ct__resource-drawer-stack {
		opacity: 1;
		visibility: visible;
		pointer-events: auto;
		transform: translate(-50%, 0) scaleY(1);
		transition:
			opacity 170ms ease,
			transform 220ms cubic-bezier(0.22, 1, 0.36, 1),
			visibility 0s linear 0s;
	}
	.nimble-ct__portrait--name-drawer:hover .nimble-ct__name-drawer-stack,
	.nimble-ct__portrait--name-drawer:focus-within .nimble-ct__name-drawer-stack {
		opacity: 1;
		visibility: visible;
		transform: translate(-50%, 0) scaleY(1);
		transition:
			opacity 170ms ease,
			transform 220ms cubic-bezier(0.22, 1, 0.36, 1),
			visibility 0s linear 0s;
	}
	.nimble-ct__drawer-cell {
		min-height: 1.02rem;
		padding: 0.14rem 0.2rem;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.2rem;
		font-size: 0.56rem;
		font-weight: 700;
		line-height: 1;
		color: hsl(0 0% 96%);
		text-shadow: 0 0 0.24rem color-mix(in srgb, black 82%, transparent);
		border: 1px solid color-mix(in srgb, hsl(40 72% 72%) 34%, transparent);
		border-radius: 0.28rem;
		background: color-mix(in srgb, hsl(224 30% 17%) 88%, black 12%);
		font-variant-numeric: tabular-nums;
	}
	.nimble-ct__drawer-reaction-button {
		all: unset;
		min-height: 1.02rem;
		padding: 0.14rem 0.2rem;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.22rem;
		border: 1px solid;
		border-radius: 0.28rem;
		font-variant-numeric: tabular-nums;
		box-sizing: border-box;
		cursor: pointer;
		transition:
			filter 120ms ease,
			transform 120ms ease,
			opacity 120ms ease;
	}
	.nimble-ct__drawer-reaction-button:hover,
	.nimble-ct__drawer-reaction-button:focus-visible {
		filter: brightness(1.08);
		transform: translateY(-0.01rem);
	}
	.nimble-ct__drawer-reaction-button:disabled {
		cursor: default;
		filter: none;
		transform: none;
	}
	.nimble-ct__drawer-cell i {
		font-size: 0.72rem;
		line-height: 1;
	}
	.nimble-ct__drawer-cell--left {
		justify-content: flex-start;
		padding-inline: 0.28rem 0.34rem;
		border-right-color: color-mix(in srgb, hsl(42 94% 72%) 58%, transparent);
	}
	.nimble-ct__drawer-cell--hp {
		justify-content: center;
		padding-inline: 0.34rem;
	}
	.nimble-ct__drawer-cell--wounds {
		justify-content: center;
		padding-inline: 0.34rem;
		border-color: hsl(2 92% 70%);
		background: hsl(0 78% 36%);
		box-shadow:
			0 0 0.42rem color-mix(in srgb, hsl(0 92% 56%) 34%, transparent),
			inset 0 0 0.36rem color-mix(in srgb, hsl(0 100% 92%) 8%, transparent);
	}
	.nimble-ct__drawer-cell--utility {
		color: hsl(205 100% 78%);
		border-color: hsl(208 88% 68%);
		background: hsl(214 58% 18%);
		box-shadow:
			0 0 0.34rem color-mix(in srgb, hsl(207 100% 62%) 26%, transparent),
			inset 0 0 0.28rem color-mix(in srgb, hsl(203 100% 84%) 10%, transparent);
	}
	.nimble-ct__drawer-cell--inactive {
		opacity: 0.48;
	}
	.nimble-ct__drawer-cell--hidden {
		visibility: hidden;
	}
	.nimble-ct__drawer-text {
		white-space: nowrap;
	}
	.nimble-ct__drawer-cell--hp .nimble-ct__drawer-text,
	.nimble-ct__drawer-cell--wounds .nimble-ct__drawer-text {
		font-size: 0.64rem;
		line-height: 1;
	}
	.nimble-ct__image {
		display: block;
		width: 100%;
		height: 100%;
		object-fit: cover;
		user-select: none;
		pointer-events: none;
	}
	.nimble-ct__drag-handle {
		position: absolute;
		inset: 0 0 2.5rem;
		z-index: 2;
	}
	.nimble-ct__portrait--monster {
		display: block;
	}
	.nimble-ct__portrait--monster .nimble-ct__portrait-card {
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
	.nimble-ct__monster-stack-icon {
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
	.nimble-ct__monster-stack-icon i {
		font-size: 2rem;
		line-height: 1;
	}
	.nimble-ct__portrait--active .nimble-ct__monster-stack-icon {
		width: 4.35rem;
		height: 4.35rem;
	}
	.nimble-ct__portrait--active .nimble-ct__monster-stack-icon i {
		font-size: 2.25rem;
	}
	.nimble-ct__badge {
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
		transform: scale(var(--nimble-ct-badge-scale, 1));
		transform-origin: top left;
		transition:
			transform 140ms ease,
			box-shadow 140ms ease,
			border-color 140ms ease;
	}
	.nimble-ct__badge--hp {
		background: color-mix(in srgb, hsl(220 54% 16%) 90%, black 10%);
		border: 1px solid color-mix(in srgb, hsl(218 35% 63%) 62%, white 10%);
		box-shadow: 0 0 0.26rem color-mix(in srgb, hsl(217 36% 52%) 30%, transparent);
	}
	.nimble-ct__badge--hp-green {
		background: linear-gradient(
			180deg,
			color-mix(in srgb, hsl(131 70% 46%) 90%, black 8%) 0%,
			color-mix(in srgb, hsl(126 55% 26%) 92%, black 12%) 100%
		);
		border: 1px solid color-mix(in srgb, hsl(124 60% 72%) 75%, white 12%);
		box-shadow: 0 0 0.32rem color-mix(in srgb, hsl(126 68% 52%) 40%, transparent);
	}
	.nimble-ct__badge--hp-yellow {
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
	.nimble-ct__badge--hp-red {
		background: linear-gradient(
			180deg,
			color-mix(in srgb, hsl(3 88% 58%) 92%, white 8%) 0%,
			color-mix(in srgb, hsl(0 74% 38%) 92%, black 8%) 100%
		);
		border: 1px solid color-mix(in srgb, hsl(2 95% 76%) 74%, white 8%);
		box-shadow: 0 0 0.32rem color-mix(in srgb, hsl(1 92% 56%) 44%, transparent);
	}
	.nimble-ct__badge--hp-unknown {
		background: color-mix(in srgb, hsl(220 54% 16%) 90%, black 10%);
		border: 1px solid color-mix(in srgb, hsl(218 35% 63%) 62%, white 10%);
		box-shadow: 0 0 0.26rem color-mix(in srgb, hsl(217 36% 52%) 30%, transparent);
	}
	.nimble-ct__resource-chips {
		position: absolute;
		top: 0.16rem;
		right: 0.18rem;
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		gap: 0.18rem;
		z-index: 3;
	}
	.nimble-ct__resource-chip {
		min-height: 0.86rem;
		padding: 0.08rem 0.24rem;
		display: inline-flex;
		align-items: center;
		gap: 0.18rem;
		font-size: 0.53rem;
		font-weight: 700;
		line-height: 1;
		color: hsl(0 0% 96%);
		text-shadow: 0 0 0.24rem color-mix(in srgb, black 82%, transparent);
		border-radius: 999px;
		border: 1px solid color-mix(in srgb, hsl(216 34% 66%) 60%, white 12%);
		background: color-mix(in srgb, hsl(221 46% 15%) 90%, black 10%);
		white-space: nowrap;
	}
	.nimble-ct__resource-chip i {
		font-size: 0.52rem;
		line-height: 1;
	}
	.nimble-ct__resource-chip-text {
		font-variant-numeric: tabular-nums;
	}
	.nimble-ct__resource-chip--mana {
		border-color: color-mix(in srgb, hsl(205 90% 76%) 64%, white 12%);
		background: color-mix(in srgb, hsl(208 74% 24%) 88%, black 12%);
	}
	.nimble-ct__resource-chip--wounds {
		border-color: color-mix(in srgb, hsl(2 84% 74%) 64%, white 12%);
		background: color-mix(in srgb, hsl(0 66% 24%) 88%, black 12%);
	}
	.nimble-ct__resource-chip--utility {
		border-color: color-mix(in srgb, hsl(42 84% 76%) 60%, white 16%);
		background: color-mix(in srgb, hsl(44 42% 22%) 86%, black 14%);
	}
	.nimble-ct__resource-chip--inactive {
		opacity: 0.52;
	}
	.nimble-ct__initiative-roll {
		position: absolute;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		width: 3.8rem;
		height: 3.8rem;
		margin: 0;
		padding: 0;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		font-size: 2rem;
		color: hsl(36 94% 86%);
		background: color-mix(in srgb, hsl(230 24% 12%) 90%, black 10%);
		border: 1px solid color-mix(in srgb, hsl(42 78% 72%) 75%, white 10%);
		border-radius: 50%;
		box-shadow: 0 0 0.55rem color-mix(in srgb, hsl(41 84% 66%) 46%, transparent);
		cursor: pointer;
		z-index: 4;
		transition:
			color 120ms ease,
			background 120ms ease,
			border-color 120ms ease,
			box-shadow 120ms ease;
	}
	.nimble-ct__initiative-roll:hover,
	.nimble-ct__initiative-roll:focus-visible {
		color: hsl(42 97% 91%);
		filter: brightness(1.08);
	}
	.nimble-ct__initiative-roll:disabled {
		opacity: 0.45;
		cursor: not-allowed;
	}
	.nimble-ct__pips {
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
		cursor: default;
	}
	.nimble-ct__action-die-button {
		all: unset;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
	}
	.nimble-ct__action-die-button:disabled {
		cursor: default;
		opacity: 0.6;
	}
	.nimble-ct__pips i {
		font-size: 1.74rem;
		line-height: 1;
		filter: drop-shadow(0 0 0.12rem color-mix(in srgb, black 70%, transparent));
	}
	.nimble-ct__action-die--active {
		color: var(--nimble-ct-action-die-color, #ffffff);
		opacity: 1;
	}
	.nimble-ct__action-die--spent {
		color: color-mix(in srgb, var(--nimble-ct-action-die-color, #ffffff) 44%, hsl(138 18% 22%) 56%);
		opacity: 0.45;
	}
	.nimble-ct__action-overflow {
		font-size: 0.46rem;
		font-weight: 700;
		color: hsl(39 90% 82%);
	}
	.nimble-ct__action-box-shell {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.32rem;
	}
	.nimble-ct__action-box {
		min-width: 3.1rem;
		height: 1.45rem;
		padding-inline: 0.42rem;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		border-radius: 0.28rem;
		border: 1px solid var(--nimble-ct-action-box-border);
		background: var(--nimble-ct-action-box-bg);
		color: var(--nimble-ct-action-color-resolved);
		font-size: 0.88rem;
		font-weight: 800;
		line-height: 1;
		font-variant-numeric: tabular-nums;
		text-shadow: var(--nimble-ct-action-text-shadow);
		box-shadow: 0 0 0.36rem var(--nimble-ct-action-box-glow);
	}
	.nimble-ct__action-adjust {
		all: unset;
		width: 1.18rem;
		height: 1.1rem;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		border-radius: 0.22rem;
		border: 1px solid var(--nimble-ct-action-adjust-border);
		background: var(--nimble-ct-action-adjust-bg);
		color: var(--nimble-ct-action-color-resolved);
		font-size: 0.28rem;
		line-height: 1;
		cursor: pointer;
		transition:
			opacity 110ms ease,
			transform 110ms ease,
			filter 110ms ease;
	}
	.nimble-ct__action-adjust:hover,
	.nimble-ct__action-adjust:focus-visible {
		filter: brightness(1.12);
	}
	.nimble-ct__action-adjust i {
		font-size: 0.6rem;
		line-height: 1;
	}
	.nimble-ct__action-adjust:disabled {
		cursor: default;
		opacity: 0.42;
	}
	:global(.theme-light) .nimble-ct__controls {
		border-color: color-mix(in srgb, hsl(40 40% 56%) 48%, hsl(216 24% 60%) 52%);
		background: linear-gradient(
			180deg,
			color-mix(in srgb, white 88%, hsl(42 30% 84%) 12%) 0%,
			color-mix(in srgb, hsl(42 24% 90%) 78%, hsl(216 18% 84%) 22%) 100%
		);
		box-shadow: 0 0.14rem 0.42rem color-mix(in srgb, hsl(220 24% 46%) 16%, transparent);
	}
	:global(.theme-light) .nimble-ct__icon-button {
		color: hsl(220 36% 22%);
		background: linear-gradient(
			180deg,
			color-mix(in srgb, white 94%, hsl(42 24% 88%) 6%) 0%,
			color-mix(in srgb, hsl(40 22% 92%) 70%, hsl(219 18% 88%) 30%) 100%
		);
		border-color: color-mix(in srgb, hsl(38 36% 56%) 46%, hsl(216 24% 58%) 54%);
		box-shadow:
			0 0 0.18rem color-mix(in srgb, white 58%, transparent),
			inset 0 0 0.18rem color-mix(in srgb, hsl(42 50% 72%) 12%, transparent);
	}
	:global(.theme-light) .nimble-ct__icon-button:hover,
	:global(.theme-light) .nimble-ct__icon-button:focus-visible {
		color: hsl(34 84% 24%);
		border-color: color-mix(in srgb, hsl(38 76% 56%) 58%, hsl(217 26% 54%) 42%);
		background: color-mix(in srgb, white 92%, hsl(42 26% 88%) 8%);
	}
	:global(.theme-light) .nimble-ct__initiative-roll {
		color: hsl(36 82% 28%);
		background: linear-gradient(
			180deg,
			color-mix(in srgb, white 94%, hsl(42 24% 88%) 6%) 0%,
			color-mix(in srgb, hsl(42 30% 90%) 72%, hsl(218 18% 86%) 28%) 100%
		);
		border-color: color-mix(in srgb, hsl(41 70% 58%) 62%, hsl(216 24% 58%) 38%);
		box-shadow:
			0 0 0.48rem color-mix(in srgb, hsl(41 82% 58%) 20%, transparent),
			inset 0 0 0.3rem color-mix(in srgb, hsl(42 70% 72%) 10%, transparent);
		filter: none;
		transition:
			color 120ms ease,
			box-shadow 120ms ease;
	}
	:global(.theme-light) .nimble-ct__initiative-roll:hover,
	:global(.theme-light) .nimble-ct__initiative-roll:focus-visible {
		color: hsl(34 88% 22%);
		background: linear-gradient(
			180deg,
			color-mix(in srgb, white 94%, hsl(42 24% 88%) 6%) 0%,
			color-mix(in srgb, hsl(42 30% 90%) 72%, hsl(218 18% 86%) 28%) 100%
		);
		border-color: color-mix(in srgb, hsl(41 70% 58%) 62%, hsl(216 24% 58%) 38%);
		box-shadow:
			0 0 0.58rem color-mix(in srgb, hsl(41 82% 58%) 24%, transparent),
			inset 0 0 0.34rem color-mix(in srgb, hsl(42 70% 72%) 12%, transparent);
		filter: none !important;
	}
	:global(.theme-light) .nimble-ct__resource-drawer {
		background: linear-gradient(
			180deg,
			color-mix(in srgb, white 92%, hsl(42 44% 84%) 8%) 0%,
			color-mix(in srgb, hsl(42 30% 91%) 72%, hsl(214 26% 87%) 28%) 100%
		);
		box-shadow:
			0 0 0.72rem color-mix(in srgb, hsl(42 84% 56%) 18%, transparent),
			0 0.2rem 0.7rem color-mix(in srgb, hsl(220 22% 48%) 16%, transparent),
			inset 0 0 0.36rem color-mix(in srgb, hsl(41 76% 60%) 10%, transparent);
	}
	:global(.theme-light) .nimble-ct__player-name-drawer {
		color: hsl(220 30% 20%);
		text-shadow: none;
		background: linear-gradient(
			180deg,
			color-mix(in srgb, white 92%, hsl(44 40% 84%) 8%) 0%,
			color-mix(in srgb, hsl(42 32% 90%) 78%, hsl(217 24% 86%) 22%) 100%
		);
		border-color: color-mix(in srgb, hsl(39 40% 54%) 55%, hsl(216 26% 64%) 45%);
		box-shadow:
			0 0 0.4rem color-mix(in srgb, hsl(42 80% 58%) 14%, transparent),
			0 0.16rem 0.32rem color-mix(in srgb, hsl(220 22% 46%) 14%, transparent);
	}
	:global(.theme-light) .nimble-ct__player-name-drawer-text,
	:global(.theme-light) .nimble-ct__drawer-cell {
		color: hsl(220 30% 20%);
		text-shadow: none;
	}
	:global(.theme-light) .nimble-ct__drawer-cell {
		border-color: color-mix(in srgb, hsl(42 46% 58%) 40%, hsl(217 18% 60%) 60%);
		background: color-mix(in srgb, white 78%, hsl(218 18% 86%) 22%);
	}
	:global(.theme-light) .nimble-ct__drawer-cell--utility {
		color: hsl(212 78% 24%);
		border-color: color-mix(in srgb, hsl(208 86% 56%) 56%, hsl(214 22% 56%) 44%);
		background: color-mix(in srgb, hsl(205 100% 86%) 72%, white 28%);
		box-shadow:
			0 0 0.24rem color-mix(in srgb, hsl(208 100% 60%) 16%, transparent),
			inset 0 0 0.18rem color-mix(in srgb, hsl(206 94% 58%) 12%, transparent);
	}
	:global(.theme-light) .nimble-ct__drawer-cell--wounds {
		color: hsl(0 0% 98%);
		border-color: hsl(2 70% 56%);
		background: hsl(0 68% 50%);
		box-shadow:
			0 0 0.32rem color-mix(in srgb, hsl(0 78% 50%) 26%, transparent),
			inset 0 0 0.24rem color-mix(in srgb, hsl(0 100% 98%) 10%, transparent);
	}
	:global(.theme-light) .nimble-ct__drawer-cell--hp.nimble-ct__badge--hp-green {
		color: hsl(142 64% 18%);
		background: linear-gradient(
			180deg,
			color-mix(in srgb, hsl(126 74% 74%) 88%, white 12%) 0%,
			color-mix(in srgb, hsl(126 54% 58%) 84%, white 16%) 100%
		);
		border-color: color-mix(in srgb, hsl(126 54% 42%) 58%, white 42%);
		box-shadow: 0 0 0.3rem color-mix(in srgb, hsl(126 64% 48%) 22%, transparent);
	}
	:global(.theme-light) .nimble-ct__drawer-cell--hp.nimble-ct__badge--hp-yellow {
		color: hsl(38 82% 20%);
		background: linear-gradient(
			180deg,
			color-mix(in srgb, hsl(49 100% 80%) 88%, white 12%) 0%,
			color-mix(in srgb, hsl(45 92% 64%) 86%, white 14%) 100%
		);
		border-color: color-mix(in srgb, hsl(45 86% 46%) 56%, white 44%);
		box-shadow: 0 0 0.3rem color-mix(in srgb, hsl(47 92% 54%) 22%, transparent);
	}
	:global(.theme-light) .nimble-ct__drawer-cell--hp.nimble-ct__badge--hp-red {
		color: hsl(0 0% 98%);
		background: linear-gradient(
			180deg,
			color-mix(in srgb, hsl(2 90% 68%) 88%, white 12%) 0%,
			color-mix(in srgb, hsl(0 78% 52%) 88%, white 12%) 100%
		);
		border-color: color-mix(in srgb, hsl(0 72% 42%) 60%, white 40%);
		box-shadow: 0 0 0.3rem color-mix(in srgb, hsl(0 82% 52%) 22%, transparent);
	}
	:global(.theme-light) .nimble-ct__drawer-cell--hp.nimble-ct__badge--hp-unknown {
		color: hsl(220 30% 20%);
		background: color-mix(in srgb, white 78%, hsl(218 18% 86%) 22%);
		border-color: color-mix(in srgb, hsl(42 46% 58%) 40%, hsl(217 18% 60%) 60%);
		box-shadow: none;
	}
	.nimble-ct__action-box-shell--editable .nimble-ct__action-adjust {
		opacity: 0;
		pointer-events: none;
		transform: translateY(0.08rem);
	}
	.nimble-ct__portrait:hover .nimble-ct__action-box-shell--editable .nimble-ct__action-adjust,
	.nimble-ct__portrait:focus-within
		.nimble-ct__action-box-shell--editable
		.nimble-ct__action-adjust,
	.nimble-ct__pips:hover .nimble-ct__action-box-shell--editable .nimble-ct__action-adjust {
		opacity: 1;
		pointer-events: all;
		transform: translateY(0);
	}
	.nimble-ct__end-turn-overlay {
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
	.nimble-ct__portrait--active:hover .nimble-ct__end-turn-overlay,
	.nimble-ct__portrait--active:focus-within .nimble-ct__end-turn-overlay {
		opacity: 1;
		transform: translate(-50%, 0);
		pointer-events: all;
	}
	.nimble-ct__end-turn-overlay:hover,
	.nimble-ct__end-turn-overlay:focus-visible {
		filter: brightness(1.12);
	}
	.nimble-ct__dead {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		height: calc(9rem * var(--nimble-ct-card-scale, 1));
		padding-inline: 0.26rem;
		font-size: 0.56rem;
		font-weight: 700;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: hsl(0 0% 79%);
	}
	.nimble-ct__round-separator {
		display: inline-flex;
		align-items: center;
		gap: 0.28rem;
		height: 100%;
		opacity: 0.8;
		margin-inline: 0.1rem;
	}
	.nimble-ct__round-separator-line {
		width: 0;
		height: calc(8.4rem * var(--nimble-ct-card-scale, 1));
		border-left: 2px solid color-mix(in srgb, hsl(0 0% 100%) 75%, transparent);
		border-bottom-right-radius: 999px;
		border-bottom-left-radius: 999px;
		transition:
			height 140ms ease,
			border-color 140ms ease;
	}
	.nimble-ct__round-separator-round {
		display: inline-flex;
		align-items: center;
		gap: 0.18rem;
		font-size: 1.04rem;
		font-weight: 700;
		line-height: 1;
		white-space: nowrap;
		font-variant-numeric: tabular-nums;
		color: hsl(0 0% 96%);
		text-shadow: 0 0 0.32rem color-mix(in srgb, black 75%, transparent);
		backface-visibility: hidden;
		transform: translateZ(0);
		transition:
			font-size 140ms ease,
			gap 140ms ease;
	}
	@media (max-width: 900px) {
		.nimble-ct__icon-button {
			width: 1.36rem;
			height: 1.36rem;
			font-size: 0.7rem;
		}
		.nimble-ct__portrait {
			width: calc(4.5rem * var(--nimble-ct-card-scale, 1));
			height: calc(6.7rem * var(--nimble-ct-card-scale, 1));
		}
		.nimble-ct__portrait--active {
			width: calc(5.35rem * var(--nimble-ct-card-scale, 1));
			height: calc(8.05rem * var(--nimble-ct-card-scale, 1));
		}
		.nimble-ct__round-separator-line {
			height: calc(6.1rem * var(--nimble-ct-card-scale, 1));
		}
		.nimble-ct__round-separator-round {
			font-size: 0.84rem;
		}
	}
	@media (hover: none), (pointer: coarse) {
		.nimble-ct__action-box-shell--editable .nimble-ct__action-adjust {
			opacity: 1;
			pointer-events: all;
			transform: none;
		}
		.nimble-ct__controls {
			pointer-events: all;
			opacity: 1;
			visibility: visible;
			transition: none;
		}
		.nimble-ct__controls .nimble-ct__icon-button {
			pointer-events: all;
			visibility: visible;
		}
		.nimble-ct__track {
			scrollbar-width: thin;
		}
		.nimble-ct__track::-webkit-scrollbar {
			height: 0.44rem;
		}
	}
</style>
