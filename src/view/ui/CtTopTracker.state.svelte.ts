import { onDestroy, onMount, tick } from 'svelte';
import GenericDialog from '../../documents/dialogs/GenericDialog.svelte.js';
import { COMBAT_TRACKER_CLIENT_SETTING_UPDATED_EVENT_NAME } from '../../settings/combatTrackerSettings.js';
import { canCurrentUserReorderCombatant } from '../../utils/combatantOrdering.js';
import {
	COMBATANT_ACTIONS_CURRENT_PATH,
	getCombatantCurrentActions,
	getCombatantMaxActions,
	requestAdvanceCombatTurn,
	resolveCombatantCurrentActionsAfterDelta,
} from '../../utils/combatTurnActions.js';
import type { HeroicReactionKey } from '../../utils/heroicActions.js';
import { isCombatantDead } from '../../utils/isCombatantDead.js';
import CtSettingsDialogComponent from '../dialogs/CtSettingsDialog.svelte';
import {
	canCurrentUserAdjustCombatantActions,
	canCurrentUserRollInitiativeForCombatant,
	getCombatantId,
	getCombatantSceneId,
	isCombatRoundStarted,
	isCombatStarted,
	isEligibleForInitiativeRoll,
	isMonsterOrMinionCombatant,
	isPlayerCombatant,
	localizeWithFallback,
	shouldShowInitiativePromptForCombatant,
} from './ctTopTracker/combat.utils.js';
import {
	CT_CARD_SIZE_PREVIEW_EVENT_NAME,
	CT_SETTINGS_DIALOG_UNIQUE_ID,
	CT_VIRTUALIZATION_ENTRY_THRESHOLD,
	CT_WIDTH_PREVIEW_EVENT_NAME,
} from './ctTopTracker/constants.js';
import { registerCtTopTrackerHooks } from './ctTopTracker/hooks.js';
import {
	buildVirtualizedAliveEntries,
	getDragTargetExpansionPx,
	getEstimatedCtEntryWidthPx,
	resolvePreviewBeforeState,
	trackDependency,
} from './ctTopTracker/layout.utils.js';
import { CtTopTrackerStore } from './ctTopTracker/topTrackerStore.svelte.js';
import type {
	CanvasTokenLike,
	CombatantDropPreview,
	CombatWithDrop,
	CombatWithHeroicReactionToggle,
	CtWidthPreviewEventDetail,
} from './ctTopTracker/types.js';

export function createCtTopTrackerState() {
	const trackerStore = new CtTopTrackerStore();

	function resolveActionCombat(): Combat | null {
		return trackerStore.resolveActionCombat();
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
					resizable: false,
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

	async function centerActiveEntryInView(
		activeKey: string | null,
		behavior: ScrollBehavior = 'smooth',
	): Promise<void> {
		if (!trackElement) return;
		await tick();
		if (!trackElement) return;
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
				? activeIndex * getEstimatedCtEntryWidthPx(ctEffectiveCardSizeLevel) -
					trackElement.clientWidth / 2 +
					getEstimatedCtEntryWidthPx(ctEffectiveCardSizeLevel) / 2
				: null;
		if (scrollLeft == null) return;
		trackElement.scrollTo({ left: Math.max(0, scrollLeft), behavior });
		updateTrackViewportMetrics();
	}

	function updateCurrentCombat(force = false): void {
		queueMicrotask(() => {
			if (!trackerStore.refreshCurrentCombat(force)) return;
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

		return result === 'yes' || (result as unknown) === true;
	}

	async function handleEndTurnFromCard(event: MouseEvent): Promise<void> {
		event.preventDefault();
		event.stopPropagation();
		if (!canCurrentUserEndTurn) return;
		const actionCombat = resolveActionCombat();
		if (!actionCombat) return;
		const advanced = await requestAdvanceCombatTurn({ combat: actionCombat });
		if (!advanced) return;
		updateCurrentCombat(true);
	}

	async function toggleMonsterCardExpansion(event: MouseEvent): Promise<void> {
		event.preventDefault();
		event.stopPropagation();
		try {
			if (!(await trackerStore.toggleMonsterCardsExpanded())) return;
			updateCurrentCombat(true);
			await tick();
			await centerActiveEntryInView(trackerStore.activeEntryKey);
		} catch (error) {
			console.error('[Nimble][CT] Failed to toggle monster expansion', { error });
			ui.notifications?.error('Unable to toggle monster expansion.');
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
				} as Record<string, unknown>,
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
		return trackerStore.canToggleHeroicReactionFromDrawer(combatant, reactionKey, reactionActive);
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

	function getTrackWheelZoneBounds(): {
		left: number;
		right: number;
		top: number;
		bottom: number;
	} | null {
		if (!trackElement) return null;
		const interactiveRects = Array.from(
			trackElement.querySelectorAll<HTMLElement>(
				'.nimble-ct__portrait-card, .nimble-ct__round-separator',
			),
		)
			.map((element) => element.getBoundingClientRect())
			.filter((rect) => rect.width > 0 && rect.height > 0);
		if (interactiveRects.length < 1) {
			const fallbackRect = trackElement.getBoundingClientRect();
			if (fallbackRect.width <= 0 || fallbackRect.height <= 0) return null;
			return {
				left: fallbackRect.left,
				right: fallbackRect.right,
				top: fallbackRect.top,
				bottom: fallbackRect.bottom,
			};
		}

		return interactiveRects.reduce(
			(bounds, rect) => ({
				left: Math.min(bounds.left, rect.left),
				right: Math.max(bounds.right, rect.right),
				top: Math.min(bounds.top, rect.top),
				bottom: Math.max(bounds.bottom, rect.bottom),
			}),
			{
				left: Number.POSITIVE_INFINITY,
				right: Number.NEGATIVE_INFINITY,
				top: Number.POSITIVE_INFINITY,
				bottom: Number.NEGATIVE_INFINITY,
			},
		);
	}

	function isPointerWithinTrackWheelZone(clientX: number, clientY: number): boolean {
		const rect = getTrackWheelZoneBounds();
		if (!rect) return false;
		return (
			clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom
		);
	}

	function clearDropPreview(): void {
		pendingDropPreview = null;
		if (trackElement) {
			delete trackElement.dataset.dropTargetId;
			delete trackElement.dataset.dropBefore;
		}
		trackerStore.clearDropPreview();
	}

	function clearDragState(): void {
		pendingDropPreview = null;
		if (trackElement) {
			delete trackElement.dataset.dragSourceId;
			delete trackElement.dataset.dropTargetId;
			delete trackElement.dataset.dropBefore;
		}
		trackerStore.clearDragState();
	}

	function handleCombatantCardPointerDown(event: PointerEvent, combatantId: string): void {
		const target = event.target;
		if (!(target instanceof HTMLElement)) {
			trackerStore.dragHandleArmedCombatantId = null;
			return;
		}
		const handle = target.closest<HTMLElement>('[data-ct-drag-handle="true"]');
		if (!handle) {
			trackerStore.dragHandleArmedCombatantId = null;
			return;
		}
		const handleCombatantId = handle.dataset.combatantId ?? '';
		trackerStore.dragHandleArmedCombatantId =
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

	function handleTrackScrollbarKeyDown(event: KeyboardEvent): void {
		const metrics = getTrackScrollbarMetrics();
		if (!metrics || metrics.maxScrollLeftPx <= 0) return;

		const currentRatio = trackScrollLeft / metrics.maxScrollLeftPx;
		const stepRatio = Math.min(1, Math.max(trackClientWidth, 48) / metrics.maxScrollLeftPx);

		switch (event.key) {
			case 'Home':
				event.preventDefault();
				scrollTrackToRatio(0);
				return;
			case 'End':
				event.preventDefault();
				scrollTrackToRatio(1);
				return;
			case 'ArrowLeft':
				event.preventDefault();
				scrollTrackToRatio(currentRatio - stepRatio);
				return;
			case 'ArrowRight':
				event.preventDefault();
				scrollTrackToRatio(currentRatio + stepRatio);
				return;
			default:
				return;
		}
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
		const before = resolvePreviewBeforeState(
			relative,
			bestMatch.targetId,
			pendingDropPreview ?? dragPreview,
		);
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

		pendingDropPreview = preview;
		if (trackElement) {
			trackElement.dataset.dropTargetId = preview.targetId;
			trackElement.dataset.dropBefore = String(preview.before);
		}

		const isUnchanged =
			dragPreview?.sourceId === preview.sourceId &&
			dragPreview?.targetId === preview.targetId &&
			dragPreview?.before === preview.before;
		if (!isUnchanged) {
			trackerStore.dragPreview = preview;
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
		trackerStore.activeDragSourceId = combatantDocument.id ?? null;
		trackerStore.dragHandleArmedCombatantId = null;
		clearDropPreview();
		if (trackElement) {
			trackElement.dataset.dragSourceId = combatantDocument.id ?? '';
		}

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
		const dropPreview = pendingDropPreview ?? dragPreview ?? getDragPreview(event);
		if (!activeDragSourceId || !dropPreview?.targetId) {
			clearDragState();
			return;
		}

		trackElement.dataset.dragSourceId = activeDragSourceId ?? '';
		trackElement.dataset.dropTargetId = dropPreview.targetId;
		trackElement.dataset.dropBefore = String(dropPreview.before);

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
			} as unknown as DragEvent & { target: EventTarget & HTMLElement };
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
					await actionCombat.previousTurn();
					updateCurrentCombat(true);
					return;
				case 'previous-round':
					await actionCombat.previousRound();
					updateCurrentCombat(true);
					return;
				case 'start-combat': {
					const combatId = actionCombat.id ?? actionCombat._id ?? null;
					if (actionCombat.combatants.size < 1) {
						ui.notifications?.warn('Add at least one combatant before starting combat.');
						return;
					}

					if (!isCombatRoundStarted(actionCombat)) {
						await actionCombat.startCombat();
					}

					const refreshedCombat =
						combatId && game.combats.get(combatId) ? game.combats.get(combatId) : actionCombat;
					trackerStore.preferredCombatId = combatId;
					trackerStore.replaceCurrentCombat(refreshedCombat ?? actionCombat);

					if (!isCombatStarted(refreshedCombat ?? null)) {
						ui.notifications?.warn('Combat did not enter Round 1. Check the browser console logs.');
					}

					ui.combat?.render(true);
					updateCurrentCombat(true);
					return;
				}
				case 'end-combat': {
					const combatId = actionCombat.id ?? actionCombat._id ?? null;
					const confirmed = await confirmEndEncounter();
					if (!confirmed) return;
					await actionCombat.delete();
					if (trackerStore.preferredCombatId === combatId) trackerStore.preferredCombatId = null;
					ui.combat?.render(true);
					updateCurrentCombat(true);
					return;
				}
				case 'next-turn':
					await actionCombat.nextTurn();
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

	let trackElement: HTMLOListElement | null = $state(null);
	let trackScrollLeft = $state(0);
	let trackClientWidth = $state(0);
	let trackScrollWidth = $state(0);
	let trackScrollbarElement: HTMLDivElement | null = $state(null);
	let trackScrollbarWidth = $state(0);
	let scrollbarDragPointerId: number | null = $state(null);
	let scrollbarDragOffsetPx = $state(0);
	let pendingDropPreview: CombatantDropPreview | null = null;
	const currentCombat = $derived(trackerStore.currentCombat);
	const sceneAliveCombatants = $derived(trackerStore.sceneAliveCombatants);
	const playerHpBarTextMode = $derived(trackerStore.playerHpBarTextMode);
	const nonPlayerHpBarEnabled = $derived(trackerStore.nonPlayerHpBarEnabled);
	const nonPlayerHpBarTextMode = $derived(trackerStore.nonPlayerHpBarTextMode);
	const resourceDrawerHoverEnabled = $derived(trackerStore.resourceDrawerHoverEnabled);
	const ctEnabled = $derived(trackerStore.ctEnabled);
	const activeDragSourceId = $derived(trackerStore.activeDragSourceId);
	const dragHandleArmedCombatantId = $derived(trackerStore.dragHandleArmedCombatantId);
	const dragPreview = $derived(trackerStore.dragPreview);
	const sceneMonsterAliveCombatants = $derived(trackerStore.sceneMonsterAliveCombatants);
	const sceneAllMonsterCombatants = $derived(trackerStore.sceneAllMonsterCombatants);
	const hasMonsterCombatants = $derived(trackerStore.hasMonsterCombatants);
	const canCurrentUserToggleMonsterCards = $derived(trackerStore.canCurrentUserToggleMonsterCards);
	const renderedDeadCombatants = $derived(trackerStore.renderedDeadCombatants);
	const monsterCardsExpanded = $derived(trackerStore.monsterCardsExpanded);
	const orderedAliveEntries = $derived(trackerStore.orderedAliveEntries);
	const activeEntryKey = $derived(trackerStore.activeEntryKey);
	const canCurrentUserEndTurn = $derived(trackerStore.canCurrentUserEndTurn);
	const shouldVirtualizeAliveEntries = $derived(
		orderedAliveEntries.length >= CT_VIRTUALIZATION_ENTRY_THRESHOLD,
	);
	const virtualizedAliveEntries = $derived.by(() =>
		buildVirtualizedAliveEntries(
			{
				entries: orderedAliveEntries,
				enabled: shouldVirtualizeAliveEntries,
				scrollLeft: trackScrollLeft,
				viewportWidth: trackClientWidth,
			},
			trackerStore.ctEffectiveCardSizeLevel,
		),
	);
	const roundSeparatorIndex = $derived(trackerStore.roundSeparatorIndex);
	const combatStarted = $derived(trackerStore.combatStarted);
	const currentRoundLabel = $derived(trackerStore.currentRoundLabel);
	const ctTrackMaxWidth = $derived(trackerStore.ctTrackMaxWidth);
	const ctWidthPreviewVisible = $derived(trackerStore.ctWidthPreviewVisible);
	const ctWidthPreviewMaxWidth = $derived(trackerStore.ctWidthPreviewMaxWidth);
	const ctCardSizePreviewActive = $derived(trackerStore.ctCardSizePreviewActive);
	const ctEffectiveCardSizeLevel = $derived(trackerStore.ctEffectiveCardSizeLevel);
	const ctCardScale = $derived(trackerStore.ctCardScale);
	const trackScrollbarMetrics = $derived.by(() => getTrackScrollbarMetrics());
	const showTrackScrollbar = $derived(Boolean(trackScrollbarMetrics));

	let unregisterCtHooks: (() => void) | undefined;
	let resizeListener: (() => void) | undefined;
	let ctWidthPreviewListener: ((event: Event) => void) | undefined;
	let ctCardSizePreviewListener: ((event: Event) => void) | undefined;
	let ctClientSettingUpdatedListener: ((event: Event) => void) | undefined;
	let trackWheelListener: ((event: WheelEvent) => void) | undefined;
	let trackHoverListener: ((event: MouseEvent) => void) | undefined;

	function updateTrackGapCursor(active: boolean): void {
		document.body.classList.toggle('nimble-ct--track-hover', active);
	}

	function applyCtTopTrackerSettingPatch(settingKey: unknown): void {
		const patch = trackerStore.applySettingPatch(settingKey);
		if (!patch) return;
		if (patch.shouldCenterActiveEntry) {
			void centerActiveEntryInView(trackerStore.activeEntryKey, 'auto');
		}
	}

	onMount(() => {
		updateCurrentCombat(true);
		queueMicrotask(() => {
			updateTrackViewportMetrics();
		});

		resizeListener = () => {
			updateTrackViewportMetrics();
			trackerStore.invalidateLayout();
		};
		window.addEventListener('resize', resizeListener);
		trackWheelListener = (event: WheelEvent) => {
			if (!isPointerWithinTrackWheelZone(event.clientX, event.clientY)) return;
			handleTrackWheel(event);
		};
		window.addEventListener('wheel', trackWheelListener, {
			passive: false,
			capture: true,
		});
		trackHoverListener = (event: MouseEvent) => {
			updateTrackGapCursor(isPointerWithinTrackWheelZone(event.clientX, event.clientY));
		};
		window.addEventListener('mousemove', trackHoverListener);
		ctWidthPreviewListener = (event: Event) => {
			if (!(event instanceof CustomEvent)) return;
			const detail = (event.detail ?? {}) as CtWidthPreviewEventDetail;
			trackerStore.applyWidthPreviewDetail(detail);
		};
		window.addEventListener(CT_WIDTH_PREVIEW_EVENT_NAME, ctWidthPreviewListener);
		ctCardSizePreviewListener = (event: Event) => {
			if (!(event instanceof CustomEvent)) return;
			const detail = (event.detail ?? {}) as { active?: boolean; cardSizeLevel?: unknown };
			trackerStore.applyCardSizePreviewDetail(detail);
		};
		window.addEventListener(CT_CARD_SIZE_PREVIEW_EVENT_NAME, ctCardSizePreviewListener);
		ctClientSettingUpdatedListener = (event: Event) => {
			if (!(event instanceof CustomEvent)) return;
			applyCtTopTrackerSettingPatch(event.detail?.key);
		};
		window.addEventListener(
			COMBAT_TRACKER_CLIENT_SETTING_UPDATED_EVENT_NAME,
			ctClientSettingUpdatedListener,
		);

		unregisterCtHooks = registerCtTopTrackerHooks({
			updateCurrentCombat: (force = true) => updateCurrentCombat(force),
			onLayoutInvalidated: () => {
				trackerStore.invalidateLayout();
			},
			onSettingKeyUpdated: (settingKey: unknown) => {
				applyCtTopTrackerSettingPatch(settingKey);
			},
		});
	});

	onDestroy(() => {
		if (resizeListener) window.removeEventListener('resize', resizeListener);
		if (trackWheelListener) {
			window.removeEventListener('wheel', trackWheelListener, { capture: true });
		}
		if (trackHoverListener) {
			window.removeEventListener('mousemove', trackHoverListener);
		}
		updateTrackGapCursor(false);
		if (ctWidthPreviewListener) {
			window.removeEventListener(CT_WIDTH_PREVIEW_EVENT_NAME, ctWidthPreviewListener);
		}
		if (ctCardSizePreviewListener) {
			window.removeEventListener(CT_CARD_SIZE_PREVIEW_EVENT_NAME, ctCardSizePreviewListener);
		}
		if (ctClientSettingUpdatedListener) {
			window.removeEventListener(
				COMBAT_TRACKER_CLIENT_SETTING_UPDATED_EVENT_NAME,
				ctClientSettingUpdatedListener,
			);
		}
		if (unregisterCtHooks) unregisterCtHooks();
	});

	$effect(() => {
		void centerActiveEntryInView(activeEntryKey);
	});

	$effect(() => {
		trackDependency(orderedAliveEntries.length);
		trackDependency(trackerStore.layoutVersion);
		trackDependency(trackerStore.ctEffectiveCardSizeLevel);
		void tick().then(() => {
			updateTrackViewportMetrics();
		});
	});
	return {
		get trackElement() {
			return trackElement;
		},
		set trackElement(value) {
			trackElement = value;
		},
		get trackScrollbarElement() {
			return trackScrollbarElement;
		},
		set trackScrollbarElement(value) {
			trackScrollbarElement = value;
		},
		get trackScrollLeft() {
			return trackScrollLeft;
		},
		get currentCombat() {
			return currentCombat;
		},
		get playerHpBarTextMode() {
			return playerHpBarTextMode;
		},
		get nonPlayerHpBarEnabled() {
			return nonPlayerHpBarEnabled;
		},
		get nonPlayerHpBarTextMode() {
			return nonPlayerHpBarTextMode;
		},
		get resourceDrawerHoverEnabled() {
			return resourceDrawerHoverEnabled;
		},
		get ctEnabled() {
			return ctEnabled;
		},
		get activeDragSourceId() {
			return activeDragSourceId;
		},
		get dragPreview() {
			return dragPreview;
		},
		get sceneAllMonsterCombatants() {
			return sceneAllMonsterCombatants;
		},
		get hasMonsterCombatants() {
			return hasMonsterCombatants;
		},
		get canCurrentUserToggleMonsterCards() {
			return canCurrentUserToggleMonsterCards;
		},
		get renderedDeadCombatants() {
			return renderedDeadCombatants;
		},
		get monsterCardsExpanded() {
			return monsterCardsExpanded;
		},
		get orderedAliveEntries() {
			return orderedAliveEntries;
		},
		get activeEntryKey() {
			return activeEntryKey;
		},
		get canCurrentUserEndTurn() {
			return canCurrentUserEndTurn;
		},
		get virtualizedAliveEntries() {
			return virtualizedAliveEntries;
		},
		get roundSeparatorIndex() {
			return roundSeparatorIndex;
		},
		get combatStarted() {
			return combatStarted;
		},
		get currentRoundLabel() {
			return currentRoundLabel;
		},
		get ctTrackMaxWidth() {
			return ctTrackMaxWidth;
		},
		get ctWidthPreviewVisible() {
			return ctWidthPreviewVisible;
		},
		get ctWidthPreviewMaxWidth() {
			return ctWidthPreviewMaxWidth;
		},
		get ctCardSizePreviewActive() {
			return ctCardSizePreviewActive;
		},
		get ctCardScale() {
			return ctCardScale;
		},
		get trackScrollbarMetrics() {
			return trackScrollbarMetrics;
		},
		get showTrackScrollbar() {
			return showTrackScrollbar;
		},
		handleCombatantInitiativeRoll,
		handleEndTurnFromCard,
		toggleMonsterCardExpansion,
		handleActionDeltaClick,
		canToggleHeroicReactionFromDrawer,
		handleHeroicReactionToggle,
		handleCombatantCardClick,
		handleCombatantCardContextMenu,
		handleMonsterStackClick,
		handleMonsterStackContextMenu,
		handleTrackDragOver,
		handleTrackDrop,
		handleTrackScroll,
		handleCombatantCardPointerDown,
		handleCombatantCardDragStart,
		handleCombatantCardDragEnd,
		handleControlAction,
		handleTrackScrollbarKeyDown,
		handleTrackScrollbarPointerDown,
		handleTrackScrollbarPointerMove,
		handleTrackScrollbarPointerRelease,
		canDragCombatant,
	};
}
