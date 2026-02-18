import { isCombatantDead } from '../utils/isCombatantDead.js';
import { NimbleTokenDocument } from '../documents/token/tokenDocument.js';
import {
	getMinionGroupId,
	getMinionGroupLabel,
	isMinionCombatant,
} from '../utils/minionGrouping.js';

const MINION_GROUP_ACTION_BAR_ID = 'nimble-minion-group-actions';
const MINION_GROUP_TOKEN_UI_DEBUG_DISABLED_KEY = 'NIMBLE_DISABLE_GROUP_TOKEN_UI_LOGS';
const MINION_GROUP_ACTION_BAR_SCALE_STORAGE_KEY = 'nimble.minionGroupActionBar.scale';
const MINION_GROUP_ACTION_BAR_POSITION_STORAGE_KEY = 'nimble.minionGroupActionBar.position';
const MINION_GROUP_ACTION_BAR_DEFAULT_SCALE = 2;
const MINION_GROUP_ACTION_BAR_MIN_SCALE = 2;
const MINION_GROUP_ACTION_BAR_MAX_SCALE = 3;
const MINION_GROUP_ACTION_BAR_VIEWPORT_MARGIN_PX = 8;
const ALLOW_GROUPING_OUTSIDE_COMBAT_SETTING_KEY = 'allowMinionGroupingOutsideCombat';

let didRegisterMinionGroupTokenActions = false;
let minionGroupActionBarElement: HTMLDivElement | null = null;
let refreshScheduled = false;
let isExecutingAction = false;
let actionBarScale = MINION_GROUP_ACTION_BAR_DEFAULT_SCALE;
let actionBarPosition: { left: number; top: number } | null = null;
let dragState: {
	pointerId: number;
	startX: number;
	startY: number;
	startLeft: number;
	startTop: number;
} | null = null;
let resizeState: {
	pointerId: number;
	startX: number;
	startY: number;
	startLeft: number;
	startTop: number;
	startScale: number;
	startWidth: number;
	startHeight: number;
	corner: ResizeCorner;
} | null = null;
let interactionMoveHandler: ((event: PointerEvent) => void) | null = null;
let interactionUpHandler: ((event: PointerEvent) => void) | null = null;
let windowResizeHandler: (() => void) | null = null;

type HookRegistration = { hook: string; id: number };
let hookIds: HookRegistration[] = [];

type GroupAction = 'create' | 'add';
type ScopedGroupAction = 'remove' | 'dissolve';
type ActionKind = GroupAction | ScopedGroupAction;
type ResizeCorner = 'nw' | 'ne' | 'sw' | 'se';
type ActionRequest = {
	kind: ActionKind;
	groupId?: string;
};

interface SelectedGroupSummary {
	groupId: string;
	label: string | null;
	selectedCount: number;
	totalCount: number;
	selectedCombatantIds: string[];
	isPartialSelection: boolean;
	isFullSelection: boolean;
}

type CombatWithGrouping = Combat & {
	createMinionGroup?: (combatantIds: string[]) => Promise<Combatant.Implementation[]>;
	addMinionsToGroup?: (
		groupId: string,
		combatantIds: string[],
	) => Promise<Combatant.Implementation[]>;
	removeMinionsFromGroups?: (combatantIds: string[]) => Promise<Combatant.Implementation[]>;
	dissolveMinionGroups?: (groupIds: string[]) => Promise<Combatant.Implementation[]>;
};

interface SelectionContext {
	combat: CombatWithGrouping | null;
	allowGroupingOutsideCombat: boolean;
	selectedTokenCount: number;
	selectedCombatants: Combatant.Implementation[];
	selectedMinions: Combatant.Implementation[];
	selectedOutOfCombatMinionTokenIds: string[];
	selectedMinionCountForUi: number;
	selectedUngroupedAliveMinionCountForActions: number;
	selectedInCombatNonMinionCount: number;
	selectedOutOfCombatMinionTokenCount: number;
	selectedOutOfCombatNonMinionTokenCount: number;
	selectedDeadMinions: Combatant.Implementation[];
	selectedUngroupedAliveMinions: Combatant.Implementation[];
	selectedGroupedMinions: Combatant.Implementation[];
	selectedGroupIds: string[];
	selectedGroupSummaries: SelectedGroupSummary[];
	addableGroupSummaries: SelectedGroupSummary[];
	removableGroupSummaries: SelectedGroupSummary[];
	dissolvableGroupSummaries: SelectedGroupSummary[];
	ignoredTokenCount: number;
	isTokenLayerActive: boolean;
	canCreateGroup: boolean;
	canAddToGroup: boolean;
	canRemoveFromGroup: boolean;
	canDissolveGroups: boolean;
}

function isTokenUiDebugEnabled(): boolean {
	return (
		Boolean(game.user?.isGM) &&
		(globalThis as Record<string, unknown>)[MINION_GROUP_TOKEN_UI_DEBUG_DISABLED_KEY] !== true
	);
}

function logTokenUi(message: string, details: Record<string, unknown> = {}): void {
	if (!isTokenUiDebugEnabled()) return;
	console.info(`[Nimble][MinionGrouping][TokenUI] ${message}`, details);
}

function isGroupingOutsideCombatEnabled(): boolean {
	try {
		return Boolean(
			game.settings.get(
				'nimble' as 'core',
				ALLOW_GROUPING_OUTSIDE_COMBAT_SETTING_KEY as 'rollMode',
			),
		);
	} catch (_error) {
		// Keep grouping available by default if setting cannot be read.
		return true;
	}
}

function clampActionBarScale(scale: number): number {
	if (!Number.isFinite(scale)) return MINION_GROUP_ACTION_BAR_DEFAULT_SCALE;
	return Math.max(
		MINION_GROUP_ACTION_BAR_MIN_SCALE,
		Math.min(MINION_GROUP_ACTION_BAR_MAX_SCALE, scale),
	);
}

function readStoredActionBarScale(): number {
	try {
		const raw = globalThis.localStorage.getItem(MINION_GROUP_ACTION_BAR_SCALE_STORAGE_KEY);
		const parsed = Number.parseFloat(raw ?? '');
		if (!Number.isFinite(parsed)) return MINION_GROUP_ACTION_BAR_DEFAULT_SCALE;
		return clampActionBarScale(parsed);
	} catch (_error) {
		return MINION_GROUP_ACTION_BAR_DEFAULT_SCALE;
	}
}

function saveStoredActionBarScale(scale: number): void {
	try {
		globalThis.localStorage.setItem(
			MINION_GROUP_ACTION_BAR_SCALE_STORAGE_KEY,
			String(clampActionBarScale(scale)),
		);
	} catch (_error) {
		// No-op: local storage may be unavailable in strict browser privacy modes.
	}
}

function readStoredActionBarPosition(): {
	left: number;
	top: number;
} | null {
	try {
		const raw = globalThis.localStorage.getItem(MINION_GROUP_ACTION_BAR_POSITION_STORAGE_KEY);
		if (!raw) return null;
		const parsed = JSON.parse(raw) as { left?: unknown; top?: unknown };
		const left = Number(parsed.left);
		const top = Number(parsed.top);
		if (!Number.isFinite(left) || !Number.isFinite(top)) return null;
		return { left, top };
	} catch (_error) {
		return null;
	}
}

function saveStoredActionBarPosition(
	position: {
		left: number;
		top: number;
	} | null,
): void {
	try {
		if (!position) {
			globalThis.localStorage.removeItem(MINION_GROUP_ACTION_BAR_POSITION_STORAGE_KEY);
			return;
		}
		globalThis.localStorage.setItem(
			MINION_GROUP_ACTION_BAR_POSITION_STORAGE_KEY,
			JSON.stringify({
				left: Math.round(position.left),
				top: Math.round(position.top),
			}),
		);
	} catch (_error) {
		// No-op: local storage may be unavailable in strict browser privacy modes.
	}
}

function clampActionBarPositionWithinViewport(
	left: number,
	top: number,
	rect: { width: number; height: number },
): { left: number; top: number } {
	const maxLeft = Math.max(
		MINION_GROUP_ACTION_BAR_VIEWPORT_MARGIN_PX,
		window.innerWidth - rect.width - MINION_GROUP_ACTION_BAR_VIEWPORT_MARGIN_PX,
	);
	const maxTop = Math.max(
		MINION_GROUP_ACTION_BAR_VIEWPORT_MARGIN_PX,
		window.innerHeight - rect.height - MINION_GROUP_ACTION_BAR_VIEWPORT_MARGIN_PX,
	);
	return {
		left: Math.round(Math.max(MINION_GROUP_ACTION_BAR_VIEWPORT_MARGIN_PX, Math.min(maxLeft, left))),
		top: Math.round(Math.max(MINION_GROUP_ACTION_BAR_VIEWPORT_MARGIN_PX, Math.min(maxTop, top))),
	};
}

function applyActionBarLayout(): void {
	if (!minionGroupActionBarElement) return;
	minionGroupActionBarElement.style.setProperty(
		'--nimble-minion-group-actions-scale',
		String(actionBarScale),
	);

	if (actionBarPosition) {
		minionGroupActionBarElement.classList.add('nimble-minion-group-actions--positioned');
		minionGroupActionBarElement.style.left = `${Math.round(actionBarPosition.left)}px`;
		minionGroupActionBarElement.style.top = `${Math.round(actionBarPosition.top)}px`;
		minionGroupActionBarElement.style.bottom = 'auto';
		minionGroupActionBarElement.style.right = 'auto';
		minionGroupActionBarElement.style.transform = 'none';
		return;
	}

	minionGroupActionBarElement.classList.remove('nimble-minion-group-actions--positioned');
	minionGroupActionBarElement.style.removeProperty('left');
	minionGroupActionBarElement.style.removeProperty('top');
	minionGroupActionBarElement.style.removeProperty('bottom');
	minionGroupActionBarElement.style.removeProperty('right');
	minionGroupActionBarElement.style.removeProperty('transform');
}

function setActionBarScale(scale: number, options: { persist?: boolean } = {}): void {
	const nextScale = clampActionBarScale(scale);
	if (nextScale === actionBarScale) return;
	actionBarScale = nextScale;
	applyActionBarLayout();
	scheduleVisibleGroupActionButtonsGridNormalization();

	if (actionBarPosition && minionGroupActionBarElement && !minionGroupActionBarElement.hidden) {
		const rect = minionGroupActionBarElement.getBoundingClientRect();
		actionBarPosition = clampActionBarPositionWithinViewport(
			actionBarPosition.left,
			actionBarPosition.top,
			rect,
		);
		applyActionBarLayout();
	}

	if (options.persist ?? true) {
		saveStoredActionBarScale(nextScale);
	}
}

function scheduleVisibleGroupActionButtonsGridNormalization(): void {
	if (!minionGroupActionBarElement || minionGroupActionBarElement.hidden) return;
	const actions = minionGroupActionBarElement.querySelector<HTMLDivElement>(
		'.nimble-minion-group-actions__actions',
	);
	if (!actions) return;
	scheduleGroupActionButtonsGridNormalization(actions);
}

function setActionBarPosition(
	position: { left: number; top: number } | null,
	options: { persist?: boolean } = {},
): void {
	if (position === null) {
		actionBarPosition = null;
		applyActionBarLayout();
		if (options.persist ?? true) saveStoredActionBarPosition(null);
		return;
	}

	const element = ensureActionBarElement();
	const rect = element.getBoundingClientRect();
	actionBarPosition = clampActionBarPositionWithinViewport(position.left, position.top, rect);
	applyActionBarLayout();

	if (options.persist ?? true) {
		saveStoredActionBarPosition(actionBarPosition);
	}
}

function normalizeActionBarPositionForDragStart(): { left: number; top: number } {
	if (actionBarPosition) return actionBarPosition;
	const element = ensureActionBarElement();
	const rect = element.getBoundingClientRect();
	const normalized = { left: rect.left, top: rect.top };
	setActionBarPosition(normalized, { persist: false });
	return actionBarPosition ?? normalized;
}

function stopInteractionTracking(): void {
	if (interactionMoveHandler) {
		window.removeEventListener('pointermove', interactionMoveHandler);
		interactionMoveHandler = null;
	}
	if (interactionUpHandler) {
		window.removeEventListener('pointerup', interactionUpHandler);
		window.removeEventListener('pointercancel', interactionUpHandler);
		interactionUpHandler = null;
	}
	dragState = null;
	resizeState = null;
}

function handleWindowPointerMove(event: PointerEvent): void {
	if (dragState && event.pointerId === dragState.pointerId) {
		event.preventDefault();
		const nextLeft = dragState.startLeft + (event.clientX - dragState.startX);
		const nextTop = dragState.startTop + (event.clientY - dragState.startY);
		setActionBarPosition({ left: nextLeft, top: nextTop }, { persist: false });
		return;
	}

	if (resizeState && event.pointerId === resizeState.pointerId) {
		event.preventDefault();
		const deltaX = event.clientX - resizeState.startX;
		const deltaY = event.clientY - resizeState.startY;
		const widthDelta = resizeState.corner.includes('e') ? deltaX : -deltaX;
		const heightDelta = resizeState.corner.includes('s') ? deltaY : -deltaY;

		const nextWidth = Math.max(1, resizeState.startWidth + widthDelta);
		const nextHeight = Math.max(1, resizeState.startHeight + heightDelta);
		const widthRatio = nextWidth / Math.max(1, resizeState.startWidth);
		const heightRatio = nextHeight / Math.max(1, resizeState.startHeight);
		const nextScale = resizeState.startScale * ((widthRatio + heightRatio) / 2);
		const clampedScale = clampActionBarScale(nextScale);
		const scaleRatio = clampedScale / resizeState.startScale;
		const scaledWidth = resizeState.startWidth * scaleRatio;
		const scaledHeight = resizeState.startHeight * scaleRatio;
		const nextLeft = resizeState.corner.includes('w')
			? resizeState.startLeft + (resizeState.startWidth - scaledWidth)
			: resizeState.startLeft;
		const nextTop = resizeState.corner.includes('n')
			? resizeState.startTop + (resizeState.startHeight - scaledHeight)
			: resizeState.startTop;

		setActionBarScale(clampedScale, { persist: false });
		setActionBarPosition({ left: nextLeft, top: nextTop }, { persist: false });
	}
}

function handleWindowPointerUp(event: PointerEvent): void {
	const didCompleteDrag = Boolean(dragState && event.pointerId === dragState.pointerId);
	const didCompleteResize = Boolean(resizeState && event.pointerId === resizeState.pointerId);
	if (!didCompleteDrag && !didCompleteResize) return;

	stopInteractionTracking();
	saveStoredActionBarScale(actionBarScale);
	saveStoredActionBarPosition(actionBarPosition);
	logTokenUi('Action bar layout updated', {
		actionBarScale,
		actionBarPosition,
	});
}

function startInteractionTracking(): void {
	interactionMoveHandler = handleWindowPointerMove;
	interactionUpHandler = handleWindowPointerUp;
	window.addEventListener('pointermove', interactionMoveHandler);
	window.addEventListener('pointerup', interactionUpHandler);
	window.addEventListener('pointercancel', interactionUpHandler);
}

function handleDragHandlePointerDown(event: PointerEvent): void {
	if (event.button !== 0) return;
	event.preventDefault();
	event.stopPropagation();
	stopInteractionTracking();
	const startPosition = normalizeActionBarPositionForDragStart();
	dragState = {
		pointerId: event.pointerId,
		startX: event.clientX,
		startY: event.clientY,
		startLeft: startPosition.left,
		startTop: startPosition.top,
	};
	resizeState = null;
	startInteractionTracking();
}

function handleResizeHandlePointerDown(event: PointerEvent, corner: ResizeCorner): void {
	if (event.button !== 0) return;
	event.preventDefault();
	event.stopPropagation();
	stopInteractionTracking();
	const startPosition = normalizeActionBarPositionForDragStart();
	const element = ensureActionBarElement();
	const rect = element.getBoundingClientRect();
	resizeState = {
		pointerId: event.pointerId,
		startX: event.clientX,
		startY: event.clientY,
		startLeft: startPosition.left,
		startTop: startPosition.top,
		startScale: actionBarScale,
		startWidth: rect.width,
		startHeight: rect.height,
		corner,
	};
	dragState = null;
	startInteractionTracking();
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
	return combat.combatants.contents.some((combatant) => getCombatantSceneId(combatant) === sceneId);
}

function getCombatForCurrentScene(): CombatWithGrouping | null {
	const sceneId = canvas.scene?.id;
	if (!sceneId) return null;

	const activeCombat = game.combat as CombatWithGrouping | null;
	if (activeCombat?.active && activeCombat.scene?.id === sceneId) return activeCombat;

	const viewedCombat = (game.combats.viewed ?? null) as CombatWithGrouping | null;
	if (viewedCombat?.scene?.id === sceneId) return viewedCombat;

	const combatForScene = game.combats.contents.find((combat) =>
		hasCombatantsForScene(combat, sceneId),
	);
	return (combatForScene as CombatWithGrouping | undefined) ?? null;
}

function isTokenLayerActive(): boolean {
	const tokensLayer = canvas?.tokens as
		| (foundry.canvas.layers.CanvasLayer & { active?: boolean; options?: { name?: string } })
		| undefined;
	const activeLayer = canvas?.activeLayer as
		| (foundry.canvas.layers.CanvasLayer & { options?: { name?: string } })
		| null
		| undefined;
	if (!canvas?.ready || !tokensLayer || !activeLayer) return false;
	if (tokensLayer.active === true) return true;
	if (activeLayer === tokensLayer) return true;

	const activeLayerName = activeLayer.options?.name ?? '';
	const tokensLayerName = tokensLayer.options?.name ?? 'tokens';
	return activeLayerName === tokensLayerName || activeLayerName === 'tokens';
}

function getTokenActorType(token: Token): string | null {
	const actorType =
		(token.document?.actor?.type as string | undefined) ??
		(token.actor?.type as string | undefined) ??
		null;
	return typeof actorType === 'string' ? actorType : null;
}

function isMinionToken(token: Token): boolean {
	return getTokenActorType(token) === 'minion';
}

function buildSelectionContext(): SelectionContext {
	const allowGroupingOutsideCombat = isGroupingOutsideCombatEnabled();
	const combat = getCombatForCurrentScene();
	const selectedTokens = canvas?.tokens?.controlled ?? [];
	const selectedTokenCount = selectedTokens.length;
	const sceneId = canvas.scene?.id;
	const selectedCombatants: Combatant.Implementation[] = [];
	const selectedOutOfCombatMinionTokenIds: string[] = [];
	let ignoredTokenCount = 0;
	let selectedOutOfCombatMinionTokenCount = 0;
	let selectedOutOfCombatNonMinionTokenCount = 0;

	const combatantsByTokenId = new Map<string, Combatant.Implementation>();
	if (combat && sceneId) {
		for (const combatant of combat.combatants.contents) {
			if (getCombatantSceneId(combatant) !== sceneId) continue;
			if (!combatant.tokenId) continue;
			combatantsByTokenId.set(combatant.tokenId, combatant);
		}
	}

	if (selectedTokenCount > 0) {
		const seenCombatantIds = new Set<string>();
		const seenOutOfCombatMinionTokenIds = new Set<string>();
		for (const token of selectedTokens) {
			const tokenId = token.document?.id ?? token.id ?? '';
			if (!tokenId) {
				if (isMinionToken(token)) selectedOutOfCombatMinionTokenCount += 1;
				else selectedOutOfCombatNonMinionTokenCount += 1;
				ignoredTokenCount += 1;
				continue;
			}

			const combatant = combatantsByTokenId.get(tokenId);
			if (!combatant?.id) {
				if (isMinionToken(token)) {
					selectedOutOfCombatMinionTokenCount += 1;
					if (!seenOutOfCombatMinionTokenIds.has(tokenId)) {
						seenOutOfCombatMinionTokenIds.add(tokenId);
						selectedOutOfCombatMinionTokenIds.push(tokenId);
					}
				} else {
					selectedOutOfCombatNonMinionTokenCount += 1;
				}
				ignoredTokenCount += 1;
				continue;
			}
			if (seenCombatantIds.has(combatant.id)) continue;

			seenCombatantIds.add(combatant.id);
			selectedCombatants.push(combatant);
		}
	}

	const selectedMinions = selectedCombatants.filter((combatant) => isMinionCombatant(combatant));
	const selectedInCombatNonMinionCount = Math.max(
		0,
		selectedCombatants.length - selectedMinions.length,
	);
	const selectedDeadMinions = selectedMinions.filter((combatant) => isCombatantDead(combatant));
	const selectedGroupedMinions = selectedMinions.filter(
		(combatant) => getMinionGroupId(combatant) !== null,
	);
	const selectedInCombatUngroupedAliveMinions = selectedMinions.filter(
		(combatant) => !isCombatantDead(combatant) && getMinionGroupId(combatant) === null,
	);
	const selectedUngroupedAliveMinions = selectedInCombatUngroupedAliveMinions;
	const outOfCombatMinionCountForActions = allowGroupingOutsideCombat
		? selectedOutOfCombatMinionTokenIds.length
		: 0;
	const selectedUngroupedAliveMinionCountForActions =
		selectedInCombatUngroupedAliveMinions.length + outOfCombatMinionCountForActions;
	const selectedMinionCountForUi = selectedMinions.length + selectedOutOfCombatMinionTokenCount;
	const selectedGroupIds = [
		...new Set(
			selectedGroupedMinions
				.map((combatant) => getMinionGroupId(combatant))
				.filter((groupId): groupId is string => typeof groupId === 'string'),
		),
	];
	const groupedMemberTotalsByGroupId = new Map<string, number>();
	const groupedLabelByGroupId = new Map<string, string | null>();
	if (combat && sceneId) {
		for (const combatant of combat.combatants.contents) {
			if (getCombatantSceneId(combatant) !== sceneId) continue;
			if (!isMinionCombatant(combatant)) continue;
			const groupId = getMinionGroupId(combatant);
			if (!groupId) continue;
			groupedMemberTotalsByGroupId.set(
				groupId,
				(groupedMemberTotalsByGroupId.get(groupId) ?? 0) + 1,
			);
			if (!groupedLabelByGroupId.has(groupId)) {
				groupedLabelByGroupId.set(groupId, getMinionGroupLabel(combatant));
			}
		}
	}
	const selectedGroupedIdsByGroupId = new Map<string, string[]>();
	for (const combatant of selectedGroupedMinions) {
		const groupId = getMinionGroupId(combatant);
		if (!groupId) continue;
		const selectedIds = selectedGroupedIdsByGroupId.get(groupId) ?? [];
		if (combatant.id) selectedIds.push(combatant.id);
		selectedGroupedIdsByGroupId.set(groupId, selectedIds);
		if (!groupedLabelByGroupId.has(groupId)) {
			groupedLabelByGroupId.set(groupId, getMinionGroupLabel(combatant));
		}
	}

	const selectedGroupSummaries = selectedGroupIds.map((groupId) => {
		const selectedCombatantIds = selectedGroupedIdsByGroupId.get(groupId) ?? [];
		const selectedCount = selectedCombatantIds.length;
		const totalCount = groupedMemberTotalsByGroupId.get(groupId) ?? selectedCount;
		const label = groupedLabelByGroupId.get(groupId) ?? null;
		const isFullSelection = selectedCount > 0 && selectedCount >= totalCount;
		const isPartialSelection = selectedCount > 0 && selectedCount < totalCount;
		return {
			groupId,
			label,
			selectedCount,
			totalCount,
			selectedCombatantIds,
			isPartialSelection,
			isFullSelection,
		};
	});
	const removableGroupSummaries = selectedGroupSummaries.filter(
		(summary) => summary.isPartialSelection,
	);
	// Any selected member should allow dissolving that entire group.
	const dissolvableGroupSummaries = selectedGroupSummaries.filter(
		(summary) => summary.selectedCount > 0,
	);
	const addableGroupSummaries = selectedGroupSummaries.filter(
		(summary) => summary.selectedCount > 0,
	);

	const canCreateGroup =
		selectedUngroupedAliveMinionCountForActions >= 2 && selectedGroupedMinions.length === 0;
	const canAddToGroup =
		addableGroupSummaries.length > 0 && selectedUngroupedAliveMinionCountForActions > 0;
	const canRemoveFromGroup = removableGroupSummaries.length > 0;
	const canDissolveGroups = dissolvableGroupSummaries.length > 0;

	return {
		combat,
		allowGroupingOutsideCombat,
		selectedTokenCount,
		selectedCombatants,
		selectedMinions,
		selectedOutOfCombatMinionTokenIds,
		selectedMinionCountForUi,
		selectedUngroupedAliveMinionCountForActions,
		selectedInCombatNonMinionCount,
		selectedOutOfCombatMinionTokenCount,
		selectedOutOfCombatNonMinionTokenCount,
		selectedDeadMinions,
		selectedUngroupedAliveMinions,
		selectedGroupedMinions,
		selectedGroupIds,
		selectedGroupSummaries,
		addableGroupSummaries,
		removableGroupSummaries,
		dissolvableGroupSummaries,
		ignoredTokenCount,
		isTokenLayerActive: isTokenLayerActive(),
		canCreateGroup,
		canAddToGroup,
		canRemoveFromGroup,
		canDissolveGroups,
	};
}

function ensureActionBarElement(): HTMLDivElement {
	if (minionGroupActionBarElement && document.body.contains(minionGroupActionBarElement)) {
		return minionGroupActionBarElement;
	}

	const element = document.createElement('div');
	element.id = MINION_GROUP_ACTION_BAR_ID;
	element.className = 'nimble-minion-group-actions';
	element.hidden = true;
	element.addEventListener('click', handleActionBarClick);
	document.body.appendChild(element);
	minionGroupActionBarElement = element;
	applyActionBarLayout();
	return element;
}

function hideActionBar(): void {
	if (!minionGroupActionBarElement) return;
	minionGroupActionBarElement.hidden = true;
	minionGroupActionBarElement.replaceChildren();
}

function createActionButton(
	action: ActionKind,
	compactLabel: string,
	tooltip: string,
	options: { groupId?: string } = {},
): HTMLButtonElement {
	const button = document.createElement('button');
	button.type = 'button';
	button.className = 'nimble-minion-group-actions__button';
	const isPositiveAction = action === 'create' || action === 'add';
	button.classList.add(
		isPositiveAction
			? 'nimble-minion-group-actions__button--positive'
			: 'nimble-minion-group-actions__button--negative',
	);
	button.dataset.actionKind = action;
	if (options.groupId) button.dataset.groupId = options.groupId;
	else delete button.dataset.groupId;
	button.title = tooltip;
	button.ariaLabel = tooltip;

	const prefixChip = document.createElement('span');
	prefixChip.className =
		'nimble-minion-group-actions__button-chip nimble-minion-group-actions__button-chip--prefix';
	const valueChip = document.createElement('span');
	valueChip.className =
		'nimble-minion-group-actions__button-chip nimble-minion-group-actions__button-chip--value';
	valueChip.textContent = compactLabel;

	switch (action) {
		case 'create': {
			const icon = document.createElement('i');
			icon.className = 'fa-solid fa-layer-group';
			prefixChip.append(icon);
			break;
		}
		case 'add':
			prefixChip.textContent = '+';
			break;
		case 'remove':
			prefixChip.textContent = '-';
			break;
		case 'dissolve': {
			const icon = document.createElement('i');
			icon.className = 'fa-solid fa-ban';
			prefixChip.append(icon);
			break;
		}
	}

	button.append(prefixChip, valueChip);
	button.disabled = isExecutingAction;
	return button;
}

function createHintText(message: string): HTMLSpanElement {
	const hint = document.createElement('span');
	hint.className = 'nimble-minion-group-actions__hint';
	hint.textContent = message;
	return hint;
}

function getSelectionHintMessage(
	context: SelectionContext,
	hasGroupingActions: boolean,
): string | null {
	if (hasGroupingActions) {
		return null;
	}

	const hasInCombatMinions = context.selectedMinions.length > 0;
	const hasOutOfCombatMinions = context.selectedOutOfCombatMinionTokenCount > 0;
	const hasAnyNonMinions =
		context.selectedInCombatNonMinionCount > 0 ||
		context.selectedOutOfCombatNonMinionTokenCount > 0;

	if (!hasInCombatMinions && hasOutOfCombatMinions) {
		return 'Select more minions';
	}

	if (!hasInCombatMinions && hasAnyNonMinions) {
		return 'No minions selected';
	}

	if (hasInCombatMinions) {
		return 'Select more minions';
	}

	if (context.selectedTokenCount > 0) {
		return 'No minions selected';
	}

	if (!context.combat) {
		return 'Select more minions';
	}

	return null;
}

function formatGroupDisplayLabel(label: string | null | undefined): string {
	const normalized = label?.trim().toUpperCase() ?? '';
	return normalized.length > 0 ? normalized : '?';
}

interface ActionButtonDescriptor {
	kind: ActionKind;
	compactLabel: string;
	tooltip: string;
	groupId?: string;
	groupLabel?: string;
}

function compareGroupSort(
	left: { groupId: string; groupLabel: string },
	right: { groupId: string; groupLabel: string },
): number {
	const labelCompare = left.groupLabel.localeCompare(right.groupLabel, undefined, {
		numeric: true,
		sensitivity: 'base',
	});
	if (labelCompare !== 0) return labelCompare;
	return left.groupId.localeCompare(right.groupId, undefined, {
		numeric: true,
		sensitivity: 'base',
	});
}

function buildActionButtonDescriptors(context: SelectionContext): ActionButtonDescriptor[] {
	const descriptors: ActionButtonDescriptor[] = [];

	if (context.canCreateGroup) {
		const groupCount = context.selectedUngroupedAliveMinionCountForActions;
		descriptors.push({
			kind: 'create',
			compactLabel: String(groupCount),
			tooltip: `Group ${groupCount} Minion${groupCount === 1 ? '' : 's'}`,
		});
	}

	if (context.canAddToGroup) {
		const groupCount = context.selectedUngroupedAliveMinionCountForActions;
		const addTargets = [...context.addableGroupSummaries].sort((left, right) =>
			compareGroupSort(
				{
					groupId: left.groupId,
					groupLabel: formatGroupDisplayLabel(left.label),
				},
				{
					groupId: right.groupId,
					groupLabel: formatGroupDisplayLabel(right.label),
				},
			),
		);
		for (const groupSummary of addTargets) {
			const groupLabel = formatGroupDisplayLabel(groupSummary.label);
			descriptors.push({
				kind: 'add',
				groupId: groupSummary.groupId,
				groupLabel,
				compactLabel: `${groupLabel}+${groupCount}`,
				tooltip: `Add ${groupCount} to Group ${groupLabel}`,
			});
		}
	}

	const removeTargets = [...context.removableGroupSummaries].sort((left, right) =>
		compareGroupSort(
			{
				groupId: left.groupId,
				groupLabel: formatGroupDisplayLabel(left.label),
			},
			{
				groupId: right.groupId,
				groupLabel: formatGroupDisplayLabel(right.label),
			},
		),
	);
	for (const groupSummary of removeTargets) {
		const groupLabel = formatGroupDisplayLabel(groupSummary.label);
		descriptors.push({
			kind: 'remove',
			groupId: groupSummary.groupId,
			groupLabel,
			compactLabel: `${groupLabel}-${groupSummary.selectedCount}`,
			tooltip: `Remove ${groupSummary.selectedCount} from Group ${groupLabel}`,
		});
	}

	const dissolveTargets = [...context.dissolvableGroupSummaries].sort((left, right) =>
		compareGroupSort(
			{
				groupId: left.groupId,
				groupLabel: formatGroupDisplayLabel(left.label),
			},
			{
				groupId: right.groupId,
				groupLabel: formatGroupDisplayLabel(right.label),
			},
		),
	);
	for (const groupSummary of dissolveTargets) {
		const groupLabel = formatGroupDisplayLabel(groupSummary.label);
		descriptors.push({
			kind: 'dissolve',
			groupId: groupSummary.groupId,
			groupLabel,
			compactLabel: groupLabel,
			tooltip: `Dissolve Group ${groupLabel}`,
		});
	}

	return descriptors;
}

function renderActionButtons(actions: HTMLDivElement, descriptors: ActionButtonDescriptor[]): void {
	if (descriptors.length === 0) return;

	const hasGroupScopedActions = descriptors.some((descriptor) => Boolean(descriptor.groupId));
	const useGroupColumns = descriptors.length > 2 && hasGroupScopedActions;

	if (!useGroupColumns) {
		for (const descriptor of descriptors) {
			actions.append(
				createActionButton(descriptor.kind, descriptor.compactLabel, descriptor.tooltip, {
					groupId: descriptor.groupId,
				}),
			);
		}
		return;
	}

	actions.classList.add('nimble-minion-group-actions__actions--group-columns');

	const globalDescriptors = descriptors.filter((descriptor) => !descriptor.groupId);
	for (const descriptor of globalDescriptors) {
		const column = document.createElement('div');
		column.className =
			'nimble-minion-group-actions__actions-column nimble-minion-group-actions__actions-column--global';
		column.append(
			createActionButton(descriptor.kind, descriptor.compactLabel, descriptor.tooltip, {
				groupId: descriptor.groupId,
			}),
		);
		actions.append(column);
	}

	const groupedDescriptors = descriptors.filter(
		(descriptor): descriptor is ActionButtonDescriptor & { groupId: string; groupLabel: string } =>
			typeof descriptor.groupId === 'string' && typeof descriptor.groupLabel === 'string',
	);
	const groupedEntries = [
		...new Map(
			groupedDescriptors.map((descriptor) => [
				descriptor.groupId,
				{
					groupId: descriptor.groupId,
					groupLabel: descriptor.groupLabel,
				},
			]),
		).values(),
	].sort(compareGroupSort);

	const groupedActionByKey = new Map<string, ActionButtonDescriptor>();
	for (const descriptor of groupedDescriptors) {
		groupedActionByKey.set(`${descriptor.groupId}:${descriptor.kind}`, descriptor);
	}

	const actionRowOrder: ActionKind[] = ['add', 'remove', 'dissolve'];
	const presentRowKinds = actionRowOrder.filter((kind) =>
		groupedDescriptors.some((descriptor) => descriptor.kind === kind),
	);

	for (const groupedEntry of groupedEntries) {
		const column = document.createElement('div');
		column.className = 'nimble-minion-group-actions__actions-column';
		column.dataset.groupId = groupedEntry.groupId;
		column.dataset.groupLabel = groupedEntry.groupLabel;

		for (const rowKind of presentRowKinds) {
			const descriptor = groupedActionByKey.get(`${groupedEntry.groupId}:${rowKind}`);
			if (!descriptor) {
				const placeholder = document.createElement('div');
				placeholder.className =
					'nimble-minion-group-actions__button nimble-minion-group-actions__button--placeholder';
				placeholder.setAttribute('aria-hidden', 'true');
				column.append(placeholder);
				continue;
			}

			column.append(
				createActionButton(descriptor.kind, descriptor.compactLabel, descriptor.tooltip, {
					groupId: descriptor.groupId,
				}),
			);
		}
		actions.append(column);
	}
}

function normalizeGroupActionButtonsGrid(actions: HTMLDivElement): void {
	if (!actions.classList.contains('nimble-minion-group-actions__actions--group-columns')) {
		actions.style.removeProperty('--nimble-minion-group-actions-column-width');
		actions.style.removeProperty('--nimble-minion-group-actions-row-height');
		return;
	}

	// Clear previous pixel-locked sizing so measurements reflect the current scale.
	actions.style.removeProperty('--nimble-minion-group-actions-column-width');
	actions.style.removeProperty('--nimble-minion-group-actions-row-height');

	const buttonSelector =
		'.nimble-minion-group-actions__actions-column > .nimble-minion-group-actions__button:not(.nimble-minion-group-actions__button--placeholder)';
	const buttons = [...actions.querySelectorAll<HTMLElement>(buttonSelector)];
	if (buttons.length === 0) return;

	let maxWidth = 0;
	let maxHeight = 0;
	for (const button of buttons) {
		const rect = button.getBoundingClientRect();
		if (rect.width > maxWidth) maxWidth = rect.width;
		if (rect.height > maxHeight) maxHeight = rect.height;
	}

	if (maxWidth > 0) {
		actions.style.setProperty(
			'--nimble-minion-group-actions-column-width',
			`${Math.ceil(maxWidth)}px`,
		);
	}
	if (maxHeight > 0) {
		actions.style.setProperty(
			'--nimble-minion-group-actions-row-height',
			`${Math.ceil(maxHeight)}px`,
		);
	}
}

function scheduleGroupActionButtonsGridNormalization(actions: HTMLDivElement): void {
	normalizeGroupActionButtonsGrid(actions);

	const reflowNormalize = () => {
		if (!document.body.contains(actions)) return;
		normalizeGroupActionButtonsGrid(actions);
	};

	if (typeof globalThis.requestAnimationFrame === 'function') {
		globalThis.requestAnimationFrame(reflowNormalize);
		return;
	}

	setTimeout(reflowNormalize, 0);
}

function createCornerHandle(corner: ResizeCorner): HTMLDivElement {
	const handle = document.createElement('div');
	handle.className = `nimble-minion-group-actions__corner-handle nimble-minion-group-actions__corner-handle--${corner}`;
	handle.setAttribute('role', 'presentation');
	handle.title = 'Drag corner to resize';
	handle.addEventListener('pointerdown', (event) => handleResizeHandlePointerDown(event, corner));
	return handle;
}

function renderActionBar(context: SelectionContext): void {
	const actionBar = ensureActionBarElement();
	const hasSelectedMinionTokens =
		context.selectedMinions.length > 0 || context.selectedOutOfCombatMinionTokenCount > 0;

	const shouldRender =
		Boolean(game.user?.isGM) &&
		Boolean(canvas?.ready) &&
		context.selectedTokenCount > 0 &&
		hasSelectedMinionTokens;

	if (!shouldRender) {
		logTokenUi('Action bar hidden', {
			isGM: Boolean(game.user?.isGM),
			canvasReady: Boolean(canvas?.ready),
			selectedTokenCount: context.selectedTokenCount,
			hasSelectedMinionTokens,
			isTokenLayerActive: context.isTokenLayerActive,
		});
		hideActionBar();
		return;
	}

	logTokenUi('Action bar rendered', {
		allowGroupingOutsideCombat: context.allowGroupingOutsideCombat,
		selectedTokenCount: context.selectedTokenCount,
		selectedCombatants: context.selectedCombatants.length,
		selectedMinions: context.selectedMinions.length,
		selectedMinionCountForUi: context.selectedMinionCountForUi,
		selectedUngroupedAliveMinionCountForActions:
			context.selectedUngroupedAliveMinionCountForActions,
		selectedOutOfCombatMinionTokenIds: context.selectedOutOfCombatMinionTokenIds,
		selectedInCombatNonMinionCount: context.selectedInCombatNonMinionCount,
		selectedOutOfCombatMinionTokenCount: context.selectedOutOfCombatMinionTokenCount,
		selectedOutOfCombatNonMinionTokenCount: context.selectedOutOfCombatNonMinionTokenCount,
		selectedDeadMinions: context.selectedDeadMinions.length,
		selectedUngroupedAliveMinions: context.selectedUngroupedAliveMinions.length,
		selectedGroupedMinions: context.selectedGroupedMinions.length,
		selectedGroupIds: context.selectedGroupIds,
		ignoredTokenCount: context.ignoredTokenCount,
		isTokenLayerActive: context.isTokenLayerActive,
		canCreateGroup: context.canCreateGroup,
		canAddToGroup: context.canAddToGroup,
		canRemoveFromGroup: context.canRemoveFromGroup,
		canDissolveGroups: context.canDissolveGroups,
		addableGroups: context.addableGroupSummaries.map((summary) => ({
			groupId: summary.groupId,
			label: summary.label,
			selectedCount: summary.selectedCount,
			totalCount: summary.totalCount,
		})),
		removableGroups: context.removableGroupSummaries.map((summary) => ({
			groupId: summary.groupId,
			label: summary.label,
			selectedCount: summary.selectedCount,
			totalCount: summary.totalCount,
		})),
		dissolvableGroups: context.dissolvableGroupSummaries.map((summary) => ({
			groupId: summary.groupId,
			label: summary.label,
			selectedCount: summary.selectedCount,
			totalCount: summary.totalCount,
		})),
	});

	actionBar.hidden = false;
	actionBar.replaceChildren();
	applyActionBarLayout();

	const dragHandle = document.createElement('div');
	dragHandle.className = 'nimble-minion-group-actions__drag-handle';
	dragHandle.title = 'Drag to move';
	dragHandle.addEventListener('pointerdown', handleDragHandlePointerDown);
	const headerTitle = document.createElement('span');
	headerTitle.className = 'nimble-minion-group-actions__title';
	headerTitle.textContent = 'Minion Groups';
	dragHandle.append(headerTitle);
	actionBar.append(dragHandle);

	const hasGroupingActions =
		context.canCreateGroup ||
		context.canAddToGroup ||
		context.canRemoveFromGroup ||
		context.canDissolveGroups;
	const hintMessage = getSelectionHintMessage(context, hasGroupingActions);

	const commandRow = document.createElement('div');
	commandRow.className = 'nimble-minion-group-actions__command-row';

	if (isExecutingAction) {
		const busyBadge = document.createElement('span');
		busyBadge.className =
			'nimble-minion-group-actions__badge nimble-minion-group-actions__badge--busy';
		busyBadge.title = 'Working';
		const busyIcon = document.createElement('i');
		busyIcon.className = 'fa-solid fa-spinner';
		const busyValue = document.createElement('span');
		busyValue.textContent = '...';
		busyBadge.append(busyIcon, busyValue);
		commandRow.append(busyBadge);
	}

	if (hintMessage) {
		commandRow.append(createHintText(hintMessage));
	}

	const actions = document.createElement('div');
	actions.className = 'nimble-minion-group-actions__actions';
	const actionDescriptors = buildActionButtonDescriptors(context);
	renderActionButtons(actions, actionDescriptors);
	commandRow.append(actions);
	actionBar.append(commandRow);
	scheduleGroupActionButtonsGridNormalization(actions);

	actionBar.append(createCornerHandle('nw'));
	actionBar.append(createCornerHandle('ne'));
	actionBar.append(createCornerHandle('sw'));
	actionBar.append(createCornerHandle('se'));

	if (actionBarPosition) {
		setActionBarPosition(actionBarPosition, { persist: false });
	}
}

function scheduleActionBarRefresh(source = 'unknown'): void {
	if (refreshScheduled) return;
	refreshScheduled = true;
	logTokenUi('Scheduling action bar refresh', { source });

	setTimeout(() => {
		refreshScheduled = false;
		logTokenUi('Running action bar refresh', { source });
		renderActionBar(buildSelectionContext());
	}, 0);
}

function clearTokenSelection(): void {
	canvas?.tokens?.releaseAll();
}

function getOutOfCombatMinionTokenDocuments(tokenIds: string[]): NimbleTokenDocument[] {
	if (tokenIds.length === 0) return [];
	const sceneTokens = canvas.scene?.tokens;
	if (!sceneTokens) return [];

	const documents: NimbleTokenDocument[] = [];
	for (const tokenId of tokenIds) {
		const tokenDocument = sceneTokens.get(tokenId);
		if (!tokenDocument) continue;
		if ((tokenDocument.actor?.type as string | undefined) !== 'minion') continue;
		documents.push(tokenDocument as NimbleTokenDocument);
	}
	return documents;
}

function buildSceneCombatantByTokenIdMap(
	combat: CombatWithGrouping,
	sceneId: string,
): Map<string, Combatant.Implementation> {
	const combatantsByTokenId = new Map<string, Combatant.Implementation>();
	for (const combatant of combat.combatants.contents) {
		if (getCombatantSceneId(combatant) !== sceneId) continue;
		if (!combatant.tokenId) continue;
		combatantsByTokenId.set(combatant.tokenId, combatant);
	}
	return combatantsByTokenId;
}

async function ensureCombatForGroupingAction(
	currentCombat: CombatWithGrouping | null,
	outOfCombatMinionTokenDocuments: NimbleTokenDocument[],
): Promise<CombatWithGrouping | null> {
	let targetCombat = currentCombat;

	if (outOfCombatMinionTokenDocuments.length > 0) {
		await NimbleTokenDocument.createCombatants(outOfCombatMinionTokenDocuments, {
			combat: targetCombat ?? undefined,
		});
		targetCombat = getCombatForCurrentScene();
	}

	return targetCombat;
}

function collectUngroupedAliveActionTargetIds(
	context: SelectionContext,
	combat: CombatWithGrouping,
): string[] {
	const sceneId = canvas.scene?.id;
	if (!sceneId) return [];

	const targetIds = new Set<string>();
	for (const combatant of context.selectedUngroupedAliveMinions) {
		if (combatant.id) targetIds.add(combatant.id);
	}

	if (context.allowGroupingOutsideCombat && context.selectedOutOfCombatMinionTokenIds.length > 0) {
		const combatantsByTokenId = buildSceneCombatantByTokenIdMap(combat, sceneId);
		for (const tokenId of context.selectedOutOfCombatMinionTokenIds) {
			const combatant = combatantsByTokenId.get(tokenId);
			if (!combatant?.id) continue;
			if (!isMinionCombatant(combatant)) continue;
			if (isCombatantDead(combatant)) continue;
			if (getMinionGroupId(combatant) !== null) continue;
			targetIds.add(combatant.id);
		}
	}

	return [...targetIds];
}

async function performGroupAction(action: ActionRequest): Promise<void> {
	const context = buildSelectionContext();
	if (!game.user?.isGM) return;

	switch (action.kind) {
		case 'create': {
			if (!context.canCreateGroup) return;
			const outOfCombatMinionTokenDocuments = context.allowGroupingOutsideCombat
				? getOutOfCombatMinionTokenDocuments(context.selectedOutOfCombatMinionTokenIds)
				: [];
			const combat = await ensureCombatForGroupingAction(
				context.combat,
				outOfCombatMinionTokenDocuments,
			);
			if (!combat || typeof combat.createMinionGroup !== 'function') return;
			const targetIds = collectUngroupedAliveActionTargetIds(context, combat);
			if (targetIds.length < 2) return;
			await combat.createMinionGroup(targetIds);
			break;
		}
		case 'add': {
			if (!context.canAddToGroup || !action.groupId) {
				return;
			}
			const outOfCombatMinionTokenDocuments = context.allowGroupingOutsideCombat
				? getOutOfCombatMinionTokenDocuments(context.selectedOutOfCombatMinionTokenIds)
				: [];
			const combat = await ensureCombatForGroupingAction(
				context.combat,
				outOfCombatMinionTokenDocuments,
			);
			if (!combat || typeof combat.addMinionsToGroup !== 'function') return;
			const isAddableGroup = context.addableGroupSummaries.some(
				(summary) => summary.groupId === action.groupId,
			);
			if (!isAddableGroup) return;
			const targetIds = collectUngroupedAliveActionTargetIds(context, combat);
			if (targetIds.length === 0) return;
			await combat.addMinionsToGroup(action.groupId, targetIds);
			break;
		}
		case 'remove': {
			const combat = context.combat;
			if (!combat) return;
			if (
				!context.canRemoveFromGroup ||
				typeof combat.removeMinionsFromGroups !== 'function' ||
				!action.groupId
			) {
				return;
			}
			const groupSummary = context.removableGroupSummaries.find(
				(summary) => summary.groupId === action.groupId,
			);
			if (!groupSummary) return;
			const targetIds = groupSummary.selectedCombatantIds;
			if (targetIds.length === 0) return;
			await combat.removeMinionsFromGroups(targetIds);
			break;
		}
		case 'dissolve': {
			const combat = context.combat;
			if (!combat) return;
			if (
				!context.canDissolveGroups ||
				typeof combat.dissolveMinionGroups !== 'function' ||
				!action.groupId
			) {
				return;
			}
			const isDissolvableGroup = context.dissolvableGroupSummaries.some(
				(summary) => summary.groupId === action.groupId,
			);
			if (!isDissolvableGroup) return;
			await combat.dissolveMinionGroups([action.groupId]);
			break;
		}
	}

	clearTokenSelection();
	scheduleActionBarRefresh();
}

async function handleActionSelection(action: ActionRequest): Promise<void> {
	if (isExecutingAction) return;
	isExecutingAction = true;
	logTokenUi('Action requested', { actionKind: action.kind, groupId: action.groupId ?? null });
	scheduleActionBarRefresh('action-start');

	try {
		await performGroupAction(action);
	} catch (error) {
		console.error('[Nimble][MinionGrouping][TokenUI] Token grouping action failed', {
			actionKind: action.kind,
			groupId: action.groupId ?? null,
			error,
		});
		ui.notifications?.error('Minion grouping action failed. See console for details.');
	} finally {
		isExecutingAction = false;
		scheduleActionBarRefresh('action-end');
	}
}

function parseActionKind(value: string | undefined): ActionKind | null {
	switch (value) {
		case 'create':
		case 'add':
		case 'remove':
		case 'dissolve':
			return value;
		default:
			return null;
	}
}

function parseActionRequest(button: HTMLButtonElement): ActionRequest | null {
	const actionKind = parseActionKind(button.dataset.actionKind);
	if (!actionKind) return null;
	const groupId = button.dataset.groupId?.trim() || undefined;
	if ((actionKind === 'add' || actionKind === 'remove' || actionKind === 'dissolve') && !groupId) {
		return null;
	}
	return { kind: actionKind, groupId };
}

function handleActionBarClick(event: MouseEvent): void {
	const target = event.target as HTMLElement | null;
	const button = target?.closest<HTMLButtonElement>('button[data-action-kind]');
	if (!button) return;
	event.preventDefault();
	event.stopPropagation();

	const action = parseActionRequest(button);
	if (!action) return;
	void handleActionSelection(action);
}

function registerHook(event: string, callback: (...args: unknown[]) => unknown): void {
	const hookId = (
		Hooks.on as (eventName: string, cb: (...args: unknown[]) => unknown) => number
	).call(Hooks, event, callback);
	hookIds.push({ hook: event, id: hookId });
}

export function unregisterMinionGroupTokenActions(): void {
	stopInteractionTracking();
	if (windowResizeHandler) {
		window.removeEventListener('resize', windowResizeHandler);
		windowResizeHandler = null;
	}
	for (const { hook, id } of hookIds) {
		Hooks.off(hook as Hooks.HookName, id);
	}
	hookIds = [];
	hideActionBar();
	if (minionGroupActionBarElement?.parentElement) {
		minionGroupActionBarElement.removeEventListener('click', handleActionBarClick);
		minionGroupActionBarElement.parentElement.removeChild(minionGroupActionBarElement);
	}
	minionGroupActionBarElement = null;
	didRegisterMinionGroupTokenActions = false;
	isExecutingAction = false;
	refreshScheduled = false;
}

export default function registerMinionGroupTokenActions(): void {
	if (didRegisterMinionGroupTokenActions) return;
	didRegisterMinionGroupTokenActions = true;
	console.info('[Nimble][MinionGrouping][TokenUI] registerMinionGroupTokenActions invoked');
	(globalThis as Record<string, unknown>).__nimbleMinionGroupTokenActionsRegistered = true;
	logTokenUi('Registering token action bar hooks');
	actionBarScale = readStoredActionBarScale();
	actionBarPosition = readStoredActionBarPosition();

	ensureActionBarElement();
	hideActionBar();

	windowResizeHandler = () => {
		if (!actionBarPosition || !minionGroupActionBarElement || minionGroupActionBarElement.hidden)
			return;
		const rect = minionGroupActionBarElement.getBoundingClientRect();
		actionBarPosition = clampActionBarPositionWithinViewport(
			actionBarPosition.left,
			actionBarPosition.top,
			rect,
		);
		applyActionBarLayout();
		saveStoredActionBarPosition(actionBarPosition);
	};
	window.addEventListener('resize', windowResizeHandler);

	registerHook('canvasReady', () => scheduleActionBarRefresh('canvasReady'));
	registerHook('canvasTearDown', () => hideActionBar());
	registerHook('controlToken', () => scheduleActionBarRefresh('controlToken'));
	registerHook('createCombat', () => scheduleActionBarRefresh('createCombat'));
	registerHook('updateCombat', () => scheduleActionBarRefresh('updateCombat'));
	registerHook('deleteCombat', () => scheduleActionBarRefresh('deleteCombat'));
	registerHook('createCombatant', () => scheduleActionBarRefresh('createCombatant'));
	registerHook('updateCombatant', () => scheduleActionBarRefresh('updateCombatant'));
	registerHook('deleteCombatant', () => scheduleActionBarRefresh('deleteCombatant'));
	registerHook('renderSceneControls', () => scheduleActionBarRefresh('renderSceneControls'));
	registerHook('activateTokenLayer', () => scheduleActionBarRefresh('activateTokenLayer'));
	registerHook('deactivateTokenLayer', () => scheduleActionBarRefresh('deactivateTokenLayer'));
	registerHook('updateSetting', () => scheduleActionBarRefresh('updateSetting'));

	if (canvas?.ready) {
		scheduleActionBarRefresh('initial-ready');
	}
}
