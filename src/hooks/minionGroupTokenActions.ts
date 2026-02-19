import { isCombatantDead } from '../utils/isCombatantDead.js';
import { NimbleTokenDocument } from '../documents/token/tokenDocument.js';
import {
	getMinionGroupId,
	getMinionGroupLabel,
	getMinionGroupSummaries,
	isMinionCombatant,
} from '../utils/minionGrouping.js';
import { shouldUseCanvasLiteTemporaryGroups } from '../utils/minionGroupingModes.js';
import {
	createMinionGroupAttackSelectionState,
	deriveDefaultMemberActionSelection,
	rememberMemberActionSelection,
	type MinionGroupAttackOption,
	type MinionGroupAttackSessionContext,
	type MinionGroupAttackSelectionState,
} from '../utils/minionGroupAttackSession.js';

const MINION_GROUP_ACTION_BAR_ID = 'nimble-minion-group-actions';
const MINION_GROUP_ATTACK_PANEL_ID = 'nimble-minion-group-attack-panel';
const MINION_GROUP_TOKEN_UI_DEBUG_DISABLED_KEY = 'NIMBLE_DISABLE_GROUP_TOKEN_UI_LOGS';
const MINION_GROUP_ACTION_BAR_SCALE_STORAGE_KEY = 'nimble.minionGroupActionBar.scale';
const MINION_GROUP_ACTION_BAR_POSITION_STORAGE_KEY = 'nimble.minionGroupActionBar.position';
const MINION_GROUP_ACTION_BAR_DEFAULT_SCALE = 2;
const MINION_GROUP_ACTION_BAR_MIN_SCALE = 2;
const MINION_GROUP_ACTION_BAR_MAX_SCALE = 3;
const MINION_GROUP_ACTION_BAR_VIEWPORT_MARGIN_PX = 8;
const MINION_GROUP_ATTACK_PANEL_VIEWPORT_MARGIN_PX = 8;
const ALLOW_GROUPING_OUTSIDE_COMBAT_SETTING_KEY = 'allowMinionGroupingOutsideCombat';
const CANVAS_LITE_SELECTION_ATTACK_GROUP_ID = '__nimbleCanvasLiteSelectionAttackGroup';

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
let minionGroupAttackPanelElement: HTMLDivElement | null = null;
let activeGroupAttackSession: MinionGroupAttackSelectionState | null = null;
let activeGroupAttackMembers: GroupAttackMemberView[] = [];
let activeGroupAttackWarnings: string[] = [];
let activeGroupAttackLabel: string | null = null;
let groupAttackPanelPosition: { left: number; top: number } | null = null;
let groupAttackPanelDragState: {
	pointerId: number;
	startX: number;
	startY: number;
	startLeft: number;
	startTop: number;
} | null = null;
let groupAttackPanelMoveHandler: ((event: PointerEvent) => void) | null = null;
let groupAttackPanelUpHandler: ((event: PointerEvent) => void) | null = null;
const rememberedGroupAttackSelectionsByActorType = new Map<string, string>();

type HookRegistration = { hook: string; id: number };
let hookIds: HookRegistration[] = [];

type GroupAction = 'create' | 'add' | 'attack';
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
	aliveCount: number;
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
	performMinionGroupAttack?: (params: {
		groupId: string;
		memberCombatantIds?: string[];
		targetTokenId: string;
		selections: Array<{ memberCombatantId: string; actionId: string | null }>;
		endTurn?: boolean;
	}) => Promise<{
		groupId: string;
		targetTokenId: string;
		rolledCombatantIds: string[];
		skippedMembers: Array<{ combatantId: string; reason: string }>;
		unsupportedSelectionWarnings: string[];
		endTurnApplied: boolean;
	}>;
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
	canAttackGroups: boolean;
	attackableGroupSummaries: SelectedGroupSummary[];
}

interface GroupAttackMemberView {
	combatantId: string;
	combatantName: string;
	actorType: string;
	actionsRemaining: number;
	actionOptions: MinionGroupAttackOption[];
}

interface GroupAttackSessionSyncResult {
	nextSession: MinionGroupAttackSelectionState;
	nextMembers: GroupAttackMemberView[];
}

interface MonsterFeatureActionItemLike {
	id?: string;
	name?: string;
	type?: string;
	system?: {
		subtype?: string;
		activation?: {
			effects?: unknown[];
		};
	};
}

interface ActorWithActionItems {
	type?: string;
	items?: { contents?: MonsterFeatureActionItemLike[] } | MonsterFeatureActionItemLike[];
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
	const selectedAliveMinions = selectedMinions.filter((combatant) => !isCombatantDead(combatant));
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
	const groupedAliveMemberTotalsByGroupId = new Map<string, number>();
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
			if (!isCombatantDead(combatant)) {
				groupedAliveMemberTotalsByGroupId.set(
					groupId,
					(groupedAliveMemberTotalsByGroupId.get(groupId) ?? 0) + 1,
				);
			}
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
		const aliveCount = groupedAliveMemberTotalsByGroupId.get(groupId) ?? 0;
		const isFullSelection = selectedCount > 0 && selectedCount >= totalCount;
		const isPartialSelection = selectedCount > 0 && selectedCount < totalCount;
		return {
			groupId,
			label,
			selectedCount,
			totalCount,
			aliveCount,
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
	const groupedAttackableGroupSummaries = selectedGroupSummaries.filter(
		(summary) => summary.selectedCount > 0 && summary.aliveCount > 0,
	);
	const canvasLiteSelectedAliveMinionIds = [
		...new Set(
			selectedAliveMinions
				.map((combatant) => combatant.id)
				.filter((combatantId): combatantId is string => typeof combatantId === 'string'),
		),
	];
	const isCanvasLiteMode = shouldUseCanvasLiteTemporaryGroups();
	const attackableGroupSummaries = isCanvasLiteMode
		? canvasLiteSelectedAliveMinionIds.length >= 1
			? [
					{
						groupId: CANVAS_LITE_SELECTION_ATTACK_GROUP_ID,
						label: null,
						selectedCount: canvasLiteSelectedAliveMinionIds.length,
						totalCount: canvasLiteSelectedAliveMinionIds.length,
						aliveCount: canvasLiteSelectedAliveMinionIds.length,
						selectedCombatantIds: canvasLiteSelectedAliveMinionIds,
						isPartialSelection: false,
						isFullSelection: true,
					},
				]
			: []
		: groupedAttackableGroupSummaries;

	const canCreateGroup =
		selectedUngroupedAliveMinionCountForActions >= 2 && selectedGroupedMinions.length === 0;
	const canAddToGroup =
		addableGroupSummaries.length > 0 && selectedUngroupedAliveMinionCountForActions > 0;
	const canRemoveFromGroup = removableGroupSummaries.length > 0;
	const canDissolveGroups = dissolvableGroupSummaries.length > 0;
	const canAttackGroups =
		isCanvasLiteMode && Boolean(combat) && attackableGroupSummaries.length > 0;

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
		canAttackGroups,
		attackableGroupSummaries,
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

function hideActionBar(options: { hideAttackPanel?: boolean } = {}): void {
	if (!minionGroupActionBarElement) return;
	minionGroupActionBarElement.hidden = true;
	minionGroupActionBarElement.replaceChildren();
	if (options.hideAttackPanel ?? true) {
		hideGroupAttackPanel();
	}
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
	if (action === 'attack') {
		button.classList.add('nimble-minion-group-actions__button--attack');
	} else {
		button.classList.add(
			isPositiveAction
				? 'nimble-minion-group-actions__button--positive'
				: 'nimble-minion-group-actions__button--negative',
		);
	}
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
		case 'attack': {
			const icon = document.createElement('i');
			icon.className = 'fa-solid fa-crosshairs';
			prefixChip.append(icon);
			break;
		}
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

function getGroupAttackAvailabilityDiagnostics(context: SelectionContext): {
	available: boolean;
	reasons: string[];
	isCanvasLiteMode: boolean;
} {
	const reasons: string[] = [];
	const isCanvasLiteMode = shouldUseCanvasLiteTemporaryGroups();

	if (!isCanvasLiteMode) reasons.push('modeNotCanvasLite');
	if (!context.combat) reasons.push('noCombatForScene');
	if (context.attackableGroupSummaries.length === 0) reasons.push('noAttackableSelection');

	return {
		available: context.canAttackGroups,
		reasons,
		isCanvasLiteMode,
	};
}

function flattenActivationEffects(effects: unknown): Array<Record<string, unknown>> {
	const flattened: Array<Record<string, unknown>> = [];
	const walk = (node: unknown): void => {
		if (!node || typeof node !== 'object') return;
		const asRecord = node as Record<string, unknown>;
		flattened.push(asRecord);

		const children = asRecord.children;
		if (!Array.isArray(children)) return;
		for (const child of children) walk(child);
	};

	if (Array.isArray(effects)) {
		for (const effect of effects) walk(effect);
	}

	return flattened;
}

function getUnsupportedActionEffectTypes(item: MonsterFeatureActionItemLike): string[] {
	const effects = item.system?.activation?.effects;
	const flattened = flattenActivationEffects(effects);
	if (flattened.length === 0) return [];

	const unsupported = new Set<string>();
	const supported = new Set(['damage', 'text']);
	for (const node of flattened) {
		const type = node.type;
		if (typeof type !== 'string' || type.length === 0) continue;
		if (supported.has(type)) continue;
		unsupported.add(type);
	}

	return [...unsupported].sort((left, right) => left.localeCompare(right));
}

function getActionRollFormulaLabel(item: MonsterFeatureActionItemLike): string | null {
	const effects = item.system?.activation?.effects;
	const flattened = flattenActivationEffects(effects);
	if (flattened.length === 0) return null;

	const formulas = [
		...new Set(
			flattened
				.filter(
					(node) =>
						node.type === 'damage' &&
						typeof node.formula === 'string' &&
						node.formula.trim().length > 0,
				)
				.map((node) => node.formula as string)
				.map((formula) => formula.trim()),
		),
	];

	if (formulas.length === 0) return null;
	return formulas.join(' + ');
}

function getActorActionItems(actor: ActorWithActionItems | null): MonsterFeatureActionItemLike[] {
	if (!actor?.items) return [];
	const items = Array.isArray(actor.items) ? actor.items : actor.items.contents;
	if (!Array.isArray(items)) return [];

	return items.filter(
		(item) => item?.type === 'monsterFeature' && item?.system?.subtype === 'action' && !!item.id,
	);
}

function buildGroupAttackActionOptions(
	actor: ActorWithActionItems | null,
): MinionGroupAttackOption[] {
	const actionItems = getActorActionItems(actor);
	return actionItems
		.map((item) => {
			const unsupportedReasons = getUnsupportedActionEffectTypes(item).map(
				(type) => `Unsupported effect type: ${type}`,
			);
			return {
				actionId: item.id ?? '',
				label: item.name?.trim() || 'Unnamed Action',
				rollFormula: getActionRollFormulaLabel(item),
				unsupportedReasons,
			};
		})
		.filter((option) => option.actionId.length > 0)
		.sort((left, right) =>
			left.label.localeCompare(right.label, undefined, { sensitivity: 'base' }),
		);
}

function getCurrentTargetSummary(): { targetTokenId: string | null; targetName: string | null } {
	const selectedTargets = Array.from(game.user?.targets ?? []);
	if (selectedTargets.length !== 1) return { targetTokenId: null, targetName: null };

	const [target] = selectedTargets;
	const tokenId = (target?.id ?? target?.document?.id ?? '').trim();
	if (!tokenId) return { targetTokenId: null, targetName: null };

	const targetName =
		target?.name?.trim() ||
		target?.document?.name?.trim() ||
		target?.document?.actor?.name?.trim() ||
		'Target';

	return {
		targetTokenId: tokenId,
		targetName,
	};
}

function getGroupAttackPanelElement(): HTMLDivElement {
	if (minionGroupAttackPanelElement && document.body.contains(minionGroupAttackPanelElement)) {
		return minionGroupAttackPanelElement;
	}

	const element = document.createElement('div');
	element.id = MINION_GROUP_ATTACK_PANEL_ID;
	element.className = 'nimble-minion-group-attack-panel';
	element.hidden = true;
	document.body.appendChild(element);
	minionGroupAttackPanelElement = element;
	return element;
}

function clampGroupAttackPanelPositionWithinViewport(
	left: number,
	top: number,
	rect: { width: number; height: number },
): { left: number; top: number } {
	const maxLeft = Math.max(
		MINION_GROUP_ATTACK_PANEL_VIEWPORT_MARGIN_PX,
		window.innerWidth - rect.width - MINION_GROUP_ATTACK_PANEL_VIEWPORT_MARGIN_PX,
	);
	const maxTop = Math.max(
		MINION_GROUP_ATTACK_PANEL_VIEWPORT_MARGIN_PX,
		window.innerHeight - rect.height - MINION_GROUP_ATTACK_PANEL_VIEWPORT_MARGIN_PX,
	);

	return {
		left: Math.round(
			Math.max(MINION_GROUP_ATTACK_PANEL_VIEWPORT_MARGIN_PX, Math.min(maxLeft, left)),
		),
		top: Math.round(Math.max(MINION_GROUP_ATTACK_PANEL_VIEWPORT_MARGIN_PX, Math.min(maxTop, top))),
	};
}

function setGroupAttackPanelPosition(
	position: { left: number; top: number } | null,
	options: { persist?: boolean } = {},
): void {
	const panel = getGroupAttackPanelElement();
	if (position === null) {
		groupAttackPanelPosition = null;
		panel.style.removeProperty('left');
		panel.style.removeProperty('top');
		panel.style.removeProperty('transform');
		return;
	}

	const panelRect = panel.getBoundingClientRect();
	groupAttackPanelPosition = clampGroupAttackPanelPositionWithinViewport(
		position.left,
		position.top,
		panelRect,
	);
	panel.style.left = `${groupAttackPanelPosition.left}px`;
	panel.style.top = `${groupAttackPanelPosition.top}px`;
	panel.style.transform = 'none';

	if (options.persist ?? false) {
		// Reserved for future persistence; intentionally disabled for now.
	}
}

function normalizeGroupAttackPanelPositionForDragStart(): { left: number; top: number } {
	if (groupAttackPanelPosition) return groupAttackPanelPosition;
	const panel = getGroupAttackPanelElement();
	const panelRect = panel.getBoundingClientRect();
	const normalized = { left: panelRect.left, top: panelRect.top };
	setGroupAttackPanelPosition(normalized);
	return groupAttackPanelPosition ?? normalized;
}

function stopGroupAttackPanelDragTracking(): void {
	if (groupAttackPanelMoveHandler) {
		window.removeEventListener('pointermove', groupAttackPanelMoveHandler);
		groupAttackPanelMoveHandler = null;
	}
	if (groupAttackPanelUpHandler) {
		window.removeEventListener('pointerup', groupAttackPanelUpHandler);
		window.removeEventListener('pointercancel', groupAttackPanelUpHandler);
		groupAttackPanelUpHandler = null;
	}
	groupAttackPanelDragState = null;
}

function handleGroupAttackPanelPointerMove(event: PointerEvent): void {
	if (!groupAttackPanelDragState || event.pointerId !== groupAttackPanelDragState.pointerId) return;
	event.preventDefault();
	const nextLeft =
		groupAttackPanelDragState.startLeft + (event.clientX - groupAttackPanelDragState.startX);
	const nextTop =
		groupAttackPanelDragState.startTop + (event.clientY - groupAttackPanelDragState.startY);
	setGroupAttackPanelPosition({ left: nextLeft, top: nextTop });
}

function handleGroupAttackPanelPointerUp(event: PointerEvent): void {
	if (!groupAttackPanelDragState || event.pointerId !== groupAttackPanelDragState.pointerId) return;
	stopGroupAttackPanelDragTracking();
}

function startGroupAttackPanelDragTracking(): void {
	groupAttackPanelMoveHandler = handleGroupAttackPanelPointerMove;
	groupAttackPanelUpHandler = handleGroupAttackPanelPointerUp;
	window.addEventListener('pointermove', groupAttackPanelMoveHandler);
	window.addEventListener('pointerup', groupAttackPanelUpHandler);
	window.addEventListener('pointercancel', groupAttackPanelUpHandler);
}

function handleGroupAttackPanelDragStart(event: PointerEvent): void {
	if (event.button !== 0) return;
	event.preventDefault();
	event.stopPropagation();
	stopGroupAttackPanelDragTracking();
	const startPosition = normalizeGroupAttackPanelPositionForDragStart();
	groupAttackPanelDragState = {
		pointerId: event.pointerId,
		startX: event.clientX,
		startY: event.clientY,
		startLeft: startPosition.left,
		startTop: startPosition.top,
	};
	startGroupAttackPanelDragTracking();
}

function hideGroupAttackPanel(): void {
	if (minionGroupAttackPanelElement) {
		minionGroupAttackPanelElement.hidden = true;
		minionGroupAttackPanelElement.replaceChildren();
	}
	stopGroupAttackPanelDragTracking();
	activeGroupAttackSession = null;
	activeGroupAttackMembers = [];
	activeGroupAttackWarnings = [];
	activeGroupAttackLabel = null;
}

function getGroupDisplayLabel(label: string | null | undefined): string {
	return formatGroupDisplayLabel(label);
}

function getGroupAttackMembers(
	combat: CombatWithGrouping,
	groupId: string,
	context: SelectionContext,
): Array<{ combatant: Combatant.Implementation; member: GroupAttackMemberView }> {
	if (groupId === CANVAS_LITE_SELECTION_ATTACK_GROUP_ID) {
		const rows: Array<{ combatant: Combatant.Implementation; member: GroupAttackMemberView }> = [];
		for (const combatant of context.selectedMinions) {
			if (!combatant.id) continue;
			if (isCombatantDead(combatant)) continue;
			if (!isMinionCombatant(combatant)) continue;

			const actionsRemaining = Number(
				(combatant.system as unknown as { actions?: { base?: { current?: unknown } } }).actions
					?.base?.current ?? 0,
			);
			const actor = (combatant.actor as unknown as ActorWithActionItems | null) ?? null;
			const actorType = actor?.type?.trim()?.toLowerCase() || 'minion';
			const actionOptions = buildGroupAttackActionOptions(actor);

			rows.push({
				combatant,
				member: {
					combatantId: combatant.id,
					combatantName: combatant.name?.trim() || combatant.token?.name || 'Minion',
					actorType,
					actionsRemaining: Number.isFinite(actionsRemaining) ? Math.max(0, actionsRemaining) : 0,
					actionOptions,
				},
			});
		}

		return rows;
	}

	const summaries = getMinionGroupSummaries(combat.combatants.contents);
	const summary = summaries.get(groupId);
	if (!summary) return [];

	const rows: Array<{ combatant: Combatant.Implementation; member: GroupAttackMemberView }> = [];
	for (const combatant of summary.aliveMembers) {
		if (!combatant.id) continue;
		if (!isMinionCombatant(combatant)) continue;

		const actionsRemaining = Number(
			(combatant.system as unknown as { actions?: { base?: { current?: unknown } } }).actions?.base
				?.current ?? 0,
		);
		const actor = (combatant.actor as unknown as ActorWithActionItems | null) ?? null;
		const actorType = actor?.type?.trim()?.toLowerCase() || 'minion';
		const actionOptions = buildGroupAttackActionOptions(actor);

		rows.push({
			combatant,
			member: {
				combatantId: combatant.id,
				combatantName: combatant.name?.trim() || combatant.token?.name || 'Minion',
				actorType,
				actionsRemaining: Number.isFinite(actionsRemaining) ? Math.max(0, actionsRemaining) : 0,
				actionOptions,
			},
		});
	}

	return rows;
}

function getActionSelectValueForMember(memberCombatantId: string): string {
	return activeGroupAttackSession?.selectionsByMemberId.get(memberCombatantId)?.actionId ?? '';
}

function setActionSelectValueForMember(memberCombatantId: string, actionId: string | null): void {
	if (!activeGroupAttackSession) return;
	const current = activeGroupAttackSession.selectionsByMemberId.get(memberCombatantId);
	if (!current) return;
	current.actionId = actionId;
	activeGroupAttackSession.selectionsByMemberId.set(memberCombatantId, current);
}

function getSelectedActionRollFormulaForMember(member: GroupAttackMemberView): string {
	const selectedActionId = getActionSelectValueForMember(member.combatantId);
	if (!selectedActionId) return '-';
	const selectedOption = member.actionOptions.find(
		(option) => option.actionId === selectedActionId,
	);
	return selectedOption?.rollFormula?.trim() || '-';
}

function buildSessionSyncForMembers(
	context: MinionGroupAttackSessionContext,
	memberRows: Array<{ member: GroupAttackMemberView }>,
	previousSession: MinionGroupAttackSelectionState | null,
): GroupAttackSessionSyncResult {
	const nextSession = createMinionGroupAttackSelectionState(context);
	const previousSelections = previousSession?.selectionsByMemberId;

	for (const row of memberRows) {
		const memberCombatantId = row.member.combatantId;
		const existingSelection = previousSelections?.get(memberCombatantId)?.actionId ?? null;
		const hasExistingSelection =
			typeof existingSelection === 'string' &&
			existingSelection.length > 0 &&
			row.member.actionOptions.some((option) => option.actionId === existingSelection);
		const defaultSelection = deriveDefaultMemberActionSelection(
			{
				combatantId: row.member.combatantId,
				actorType: row.member.actorType,
				actionOptions: row.member.actionOptions,
			},
			context,
			rememberedGroupAttackSelectionsByActorType,
		);
		const selectedActionId = hasExistingSelection ? existingSelection : defaultSelection;
		if (!selectedActionId) continue;
		nextSession.selectionsByMemberId.set(memberCombatantId, {
			memberCombatantId,
			actionId: selectedActionId,
		});
	}

	return {
		nextSession,
		nextMembers: memberRows.map((row) => row.member),
	};
}

function buildAttackActionButtonLabel(endTurn: boolean): string {
	return endTurn ? 'Roll + End Turn' : 'Roll';
}

function buildSelectionWarnings(result: {
	skippedMembers: Array<{ combatantId: string; reason: string }>;
	unsupportedSelectionWarnings: string[];
	endTurnApplied: boolean;
}): string[] {
	const warnings: string[] = [];
	for (const skippedMember of result.skippedMembers) {
		const reasonLabel =
			skippedMember.reason === 'noActionSelected'
				? 'No action selected'
				: skippedMember.reason === 'noActionsRemaining'
					? 'No actions remaining'
					: skippedMember.reason === 'actionNotFound'
						? 'Selected action not found'
						: skippedMember.reason === 'actorCannotActivate'
							? 'Actor cannot activate item'
							: skippedMember.reason === 'activationFailed'
								? 'Activation failed'
								: skippedMember.reason;
		warnings.push(`${skippedMember.combatantId}: ${reasonLabel}`);
	}

	for (const unsupportedWarning of result.unsupportedSelectionWarnings) {
		warnings.push(unsupportedWarning);
	}

	if (result.skippedMembers.length > 0 || result.unsupportedSelectionWarnings.length > 0) {
		return warnings;
	}

	return warnings;
}

function renderGroupAttackPanel(): void {
	const panel = getGroupAttackPanelElement();
	const session = activeGroupAttackSession;
	if (!session) {
		hideGroupAttackPanel();
		return;
	}

	const { targetTokenId, targetName } = getCurrentTargetSummary();
	const hasExactlyOneTarget = Boolean(targetTokenId);
	const groupLabel = getGroupDisplayLabel(activeGroupAttackLabel);
	const isSelectionAttackGroup = session.context.groupId === CANVAS_LITE_SELECTION_ATTACK_GROUP_ID;
	const hasRollableMembers = activeGroupAttackMembers.some((member) => {
		if (member.actionsRemaining < 1) return false;
		const selectedActionId = getActionSelectValueForMember(member.combatantId);
		return selectedActionId.length > 0;
	});

	panel.hidden = false;
	panel.replaceChildren();

	const header = document.createElement('div');
	header.className = 'nimble-minion-group-attack-panel__header';
	header.title = 'Drag to move';
	header.addEventListener('pointerdown', handleGroupAttackPanelDragStart);
	const title = document.createElement('h3');
	title.className = 'nimble-minion-group-attack-panel__title';
	title.textContent = isSelectionAttackGroup
		? 'Selected Minions Attack'
		: `Group ${groupLabel} Attack`;
	header.append(title);
	panel.append(header);

	const targetRow = document.createElement('div');
	targetRow.className = 'nimble-minion-group-attack-panel__target';
	targetRow.textContent = hasExactlyOneTarget
		? `Target: ${targetName ?? 'Target'}`
		: 'Target: select exactly 1 token target';
	panel.append(targetRow);

	const table = document.createElement('table');
	table.className = 'nimble-minion-group-attack-panel__table';
	const body = document.createElement('tbody');

	for (const member of activeGroupAttackMembers) {
		const row = document.createElement('tr');
		row.className = 'nimble-minion-group-attack-panel__row';

		const memberCell = document.createElement('td');
		memberCell.className = 'nimble-minion-group-attack-panel__member';
		memberCell.textContent = member.combatantName;

		const actionCell = document.createElement('td');
		actionCell.className = 'nimble-minion-group-attack-panel__action';
		const select = document.createElement('select');
		select.className = 'nimble-minion-group-attack-panel__select';
		select.disabled = member.actionOptions.length === 0 || member.actionsRemaining < 1;
		select.dataset.memberCombatantId = member.combatantId;

		const placeholder = document.createElement('option');
		placeholder.value = '';
		placeholder.textContent = member.actionsRemaining < 1 ? 'No actions left' : 'Select action';
		select.append(placeholder);

		for (const actionOption of member.actionOptions) {
			const option = document.createElement('option');
			option.value = actionOption.actionId;
			option.textContent = actionOption.label;
			if (actionOption.unsupportedReasons.length > 0) {
				option.dataset.unsupported = 'true';
				option.title = actionOption.unsupportedReasons.join(' ');
			}
			select.append(option);
		}

		select.value = getActionSelectValueForMember(member.combatantId);
		select.addEventListener('change', (event) => {
			const target = event.currentTarget as HTMLSelectElement;
			const nextActionId = target.value.trim();
			setActionSelectValueForMember(
				member.combatantId,
				nextActionId.length > 0 ? nextActionId : null,
			);
			renderGroupAttackPanel();
		});

		const diceCell = document.createElement('td');
		diceCell.className = 'nimble-minion-group-attack-panel__dice';
		diceCell.textContent = getSelectedActionRollFormulaForMember(member);

		actionCell.append(select);
		row.append(memberCell, actionCell, diceCell);
		body.append(row);
	}

	table.append(body);
	panel.append(table);

	if (activeGroupAttackWarnings.length > 0) {
		const warningList = document.createElement('ul');
		warningList.className = 'nimble-minion-group-attack-panel__warnings';
		for (const warning of activeGroupAttackWarnings) {
			const item = document.createElement('li');
			item.textContent = warning;
			warningList.append(item);
		}
		panel.append(warningList);
	}

	const buttons = document.createElement('div');
	buttons.className = 'nimble-minion-group-attack-panel__buttons';
	const rollButton = document.createElement('button');
	rollButton.type = 'button';
	rollButton.className =
		'nimble-minion-group-attack-panel__button nimble-minion-group-attack-panel__button--positive';
	rollButton.textContent = buildAttackActionButtonLabel(false);
	rollButton.disabled = !hasExactlyOneTarget || !hasRollableMembers || isExecutingAction;
	rollButton.addEventListener('click', () => {
		void executeGroupAttackRoll(false);
	});
	buttons.append(rollButton);

	const rollEndTurnButton = document.createElement('button');
	rollEndTurnButton.type = 'button';
	rollEndTurnButton.className =
		'nimble-minion-group-attack-panel__button nimble-minion-group-attack-panel__button--positive';
	rollEndTurnButton.textContent = buildAttackActionButtonLabel(true);
	rollEndTurnButton.disabled = !hasExactlyOneTarget || !hasRollableMembers || isExecutingAction;
	rollEndTurnButton.addEventListener('click', () => {
		void executeGroupAttackRoll(true);
	});
	buttons.append(rollEndTurnButton);

	const closeButton = document.createElement('button');
	closeButton.type = 'button';
	closeButton.className =
		'nimble-minion-group-attack-panel__button nimble-minion-group-attack-panel__button--negative';
	closeButton.textContent = 'Close';
	closeButton.disabled = isExecutingAction;
	closeButton.addEventListener('click', () => {
		hideGroupAttackPanel();
	});
	buttons.append(closeButton);

	panel.append(buttons);

	queueMicrotask(() => {
		const panelRect = panel.getBoundingClientRect();
		if (groupAttackPanelPosition) {
			setGroupAttackPanelPosition(groupAttackPanelPosition);
			return;
		}

		if (minionGroupActionBarElement && !minionGroupActionBarElement.hidden) {
			const actionBarRect = minionGroupActionBarElement.getBoundingClientRect();
			let left = actionBarRect.right + 12;
			let top = actionBarRect.top;

			if (
				left + panelRect.width >
				window.innerWidth - MINION_GROUP_ATTACK_PANEL_VIEWPORT_MARGIN_PX
			) {
				left = Math.max(
					MINION_GROUP_ATTACK_PANEL_VIEWPORT_MARGIN_PX,
					actionBarRect.left - panelRect.width - 12,
				);
			}
			if (
				top + panelRect.height >
				window.innerHeight - MINION_GROUP_ATTACK_PANEL_VIEWPORT_MARGIN_PX
			) {
				top = Math.max(
					MINION_GROUP_ATTACK_PANEL_VIEWPORT_MARGIN_PX,
					window.innerHeight - panelRect.height - MINION_GROUP_ATTACK_PANEL_VIEWPORT_MARGIN_PX,
				);
			}

			setGroupAttackPanelPosition({ left, top });
			return;
		}

		setGroupAttackPanelPosition(null);
	});
}

async function executeGroupAttackRoll(endTurn: boolean): Promise<void> {
	const session = activeGroupAttackSession;
	if (!session) return;
	if (isExecutingAction) return;

	const combat = getCombatForCurrentScene();
	if (!combat || typeof combat.performMinionGroupAttack !== 'function') {
		ui.notifications?.warn('No active combat found for group attack.');
		return;
	}

	const targetSummary = getCurrentTargetSummary();
	if (!targetSummary.targetTokenId) {
		ui.notifications?.warn('Select exactly 1 target token before rolling a group attack.');
		return;
	}

	const selections = activeGroupAttackMembers.map((member) => ({
		memberCombatantId: member.combatantId,
		actionId: getActionSelectValueForMember(member.combatantId) || null,
	}));

	isExecutingAction = true;
	scheduleActionBarRefresh('group-attack-roll-start');
	try {
		const result = await combat.performMinionGroupAttack({
			groupId: session.context.groupId,
			memberCombatantIds: session.context.memberCombatantIds,
			targetTokenId: targetSummary.targetTokenId,
			selections,
			endTurn,
		});

		for (const member of activeGroupAttackMembers) {
			const selectedActionId = getActionSelectValueForMember(member.combatantId);
			if (!selectedActionId) continue;
			rememberMemberActionSelection(
				rememberedGroupAttackSelectionsByActorType,
				session.context,
				member.actorType,
				selectedActionId,
			);
		}

		activeGroupAttackWarnings = buildSelectionWarnings(result);
		if (result.rolledCombatantIds.length === 0) {
			ui.notifications?.warn('No group attacks were rolled.');
		}
		if (endTurn && !result.endTurnApplied) {
			activeGroupAttackWarnings = [
				...activeGroupAttackWarnings,
				'End turn was not applied because this group is not currently active.',
			];
		}

		renderGroupAttackPanel();
		scheduleActionBarRefresh('group-attack-roll-end');
	} catch (error) {
		console.error('[Nimble][MinionGrouping][TokenUI] Group attack roll failed', {
			groupId: session.context.groupId,
			error,
		});
		ui.notifications?.error('Group attack failed. See console for details.');
	} finally {
		isExecutingAction = false;
		scheduleActionBarRefresh('group-attack-roll-finalize');
	}
}

function openGroupAttackPanel(context: SelectionContext, groupId: string): void {
	if (!shouldUseCanvasLiteTemporaryGroups()) return;
	const combat = context.combat;
	if (!combat || !groupId) return;

	const selectedGroup = context.attackableGroupSummaries.find(
		(summary) => summary.groupId === groupId,
	);
	if (!selectedGroup) return;

	const memberRows = getGroupAttackMembers(combat, groupId, context);
	if (memberRows.length === 0) {
		ui.notifications?.warn('Selected group has no alive minions to attack.');
		return;
	}

	const sessionContext: MinionGroupAttackSessionContext = {
		combatId: combat.id ?? '',
		groupId,
		memberCombatantIds: memberRows.map((row) => row.member.combatantId),
		targetTokenId: getCurrentTargetSummary().targetTokenId,
		groupingMode: 'canvasLite',
		isTemporaryGroup: true,
	};
	const syncedSession = buildSessionSyncForMembers(
		sessionContext,
		memberRows,
		activeGroupAttackSession,
	);
	activeGroupAttackSession = syncedSession.nextSession;
	activeGroupAttackMembers = syncedSession.nextMembers;
	activeGroupAttackWarnings = [];
	activeGroupAttackLabel = selectedGroup.label;
	renderGroupAttackPanel();
}

function syncCanvasLiteAttackPanel(context: SelectionContext): void {
	const shouldRenderPanel =
		Boolean(game.user?.isGM) &&
		Boolean(canvas?.ready) &&
		context.selectedTokenCount > 0 &&
		Boolean(context.combat) &&
		context.selectedMinions.some((combatant) => !isCombatantDead(combatant));
	if (!shouldRenderPanel) {
		hideGroupAttackPanel();
		return;
	}

	const selectedGroup = context.attackableGroupSummaries.find(
		(summary) => summary.groupId === CANVAS_LITE_SELECTION_ATTACK_GROUP_ID,
	);
	if (!selectedGroup || !context.combat) {
		hideGroupAttackPanel();
		return;
	}

	const memberRows = getGroupAttackMembers(
		context.combat,
		CANVAS_LITE_SELECTION_ATTACK_GROUP_ID,
		context,
	);
	if (memberRows.length === 0) {
		hideGroupAttackPanel();
		return;
	}

	const sessionContext: MinionGroupAttackSessionContext = {
		combatId: context.combat.id ?? '',
		groupId: CANVAS_LITE_SELECTION_ATTACK_GROUP_ID,
		memberCombatantIds: memberRows.map((row) => row.member.combatantId),
		targetTokenId: getCurrentTargetSummary().targetTokenId,
		groupingMode: 'canvasLite',
		isTemporaryGroup: true,
	};
	const syncedSession = buildSessionSyncForMembers(
		sessionContext,
		memberRows,
		activeGroupAttackSession,
	);
	activeGroupAttackSession = syncedSession.nextSession;
	activeGroupAttackMembers = syncedSession.nextMembers;
	activeGroupAttackWarnings = [];
	activeGroupAttackLabel = selectedGroup.label;
	renderGroupAttackPanel();
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

	if (context.canAttackGroups) {
		const attackTargets = [...context.attackableGroupSummaries].sort((left, right) =>
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

		for (const groupSummary of attackTargets) {
			const isSelectionAttackGroup = groupSummary.groupId === CANVAS_LITE_SELECTION_ATTACK_GROUP_ID;
			const groupLabel = formatGroupDisplayLabel(groupSummary.label);
			descriptors.push({
				kind: 'attack',
				groupId: isSelectionAttackGroup ? undefined : groupSummary.groupId,
				groupLabel: isSelectionAttackGroup ? undefined : groupLabel,
				compactLabel: isSelectionAttackGroup ? String(groupSummary.selectedCount) : groupLabel,
				tooltip: isSelectionAttackGroup
					? `Open attack for ${groupSummary.selectedCount} selected minions`
					: `Open Group ${groupLabel} attack`,
			});
		}
	}

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

	const actionRowOrder: ActionKind[] = ['attack', 'add', 'remove', 'dissolve'];
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
	if (shouldUseCanvasLiteTemporaryGroups()) {
		actionBar.hidden = true;
		actionBar.replaceChildren();
		syncCanvasLiteAttackPanel(context);
		return;
	}

	const hasSelectedMinionTokens =
		context.selectedMinions.length > 0 || context.selectedOutOfCombatMinionTokenCount > 0;
	const groupAttackDiagnostics = getGroupAttackAvailabilityDiagnostics(context);

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

	if (activeGroupAttackSession) {
		const stillSelected = context.attackableGroupSummaries.some(
			(summary) => summary.groupId === activeGroupAttackSession?.context.groupId,
		);
		if (!stillSelected || !shouldUseCanvasLiteTemporaryGroups()) {
			hideGroupAttackPanel();
		}
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
		canAttackGroups: context.canAttackGroups,
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
		attackableGroups: context.attackableGroupSummaries.map((summary) => ({
			groupId: summary.groupId,
			label: summary.label,
			selectedCount: summary.selectedCount,
			totalCount: summary.totalCount,
			aliveCount: summary.aliveCount,
		})),
		groupAttackDiagnostics,
	});

	if (!context.canAttackGroups && context.selectedGroupedMinions.length > 0) {
		logTokenUi('Group attack unavailable for current selection', {
			selectedGroupedMinions: context.selectedGroupedMinions.length,
			selectedGroupIds: context.selectedGroupIds,
			groupAttackDiagnostics,
		});
	}

	(globalThis as Record<string, unknown>).__nimbleMinionGroupActionBarContext = {
		selectedTokenCount: context.selectedTokenCount,
		selectedMinions: context.selectedMinions.length,
		selectedGroupedMinions: context.selectedGroupedMinions.length,
		selectedUngroupedAliveMinionCountForActions:
			context.selectedUngroupedAliveMinionCountForActions,
		selectedGroupIds: context.selectedGroupIds,
		canCreateGroup: context.canCreateGroup,
		canAddToGroup: context.canAddToGroup,
		canAttackGroups: context.canAttackGroups,
		canRemoveFromGroup: context.canRemoveFromGroup,
		canDissolveGroups: context.canDissolveGroups,
		groupAttackDiagnostics,
	};

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
		context.canAttackGroups ||
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

	if (activeGroupAttackSession && !minionGroupAttackPanelElement?.hidden) {
		renderGroupAttackPanel();
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
	let didMutateGrouping = false;

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
			didMutateGrouping = true;
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
			didMutateGrouping = true;
			break;
		}
		case 'attack': {
			if (!context.canAttackGroups) return;
			openGroupAttackPanel(context, action.groupId ?? CANVAS_LITE_SELECTION_ATTACK_GROUP_ID);
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
			didMutateGrouping = true;
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
			didMutateGrouping = true;
			break;
		}
	}

	if (didMutateGrouping) {
		clearTokenSelection();
		scheduleActionBarRefresh();
	}
}

async function handleActionSelection(action: ActionRequest): Promise<void> {
	if (action.kind === 'attack') {
		try {
			await performGroupAction(action);
		} catch (error) {
			console.error('[Nimble][MinionGrouping][TokenUI] Group attack panel failed to open', {
				groupId: action.groupId ?? null,
				error,
			});
			ui.notifications?.error('Could not open group attack panel. See console for details.');
		}
		return;
	}

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
		case 'attack':
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
	stopGroupAttackPanelDragTracking();
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
	if (minionGroupAttackPanelElement?.parentElement) {
		minionGroupAttackPanelElement.parentElement.removeChild(minionGroupAttackPanelElement);
	}
	minionGroupActionBarElement = null;
	minionGroupAttackPanelElement = null;
	didRegisterMinionGroupTokenActions = false;
	isExecutingAction = false;
	refreshScheduled = false;
	activeGroupAttackSession = null;
	activeGroupAttackMembers = [];
	activeGroupAttackWarnings = [];
	activeGroupAttackLabel = null;
	groupAttackPanelPosition = null;
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
		if (actionBarPosition && minionGroupActionBarElement && !minionGroupActionBarElement.hidden) {
			const rect = minionGroupActionBarElement.getBoundingClientRect();
			actionBarPosition = clampActionBarPositionWithinViewport(
				actionBarPosition.left,
				actionBarPosition.top,
				rect,
			);
			applyActionBarLayout();
			saveStoredActionBarPosition(actionBarPosition);
		}
		if (
			groupAttackPanelPosition &&
			minionGroupAttackPanelElement &&
			!minionGroupAttackPanelElement.hidden
		) {
			setGroupAttackPanelPosition(groupAttackPanelPosition);
		}
		if (activeGroupAttackSession && !minionGroupAttackPanelElement?.hidden) {
			renderGroupAttackPanel();
		}
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
