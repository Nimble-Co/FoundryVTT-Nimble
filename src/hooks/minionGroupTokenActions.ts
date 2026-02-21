import { isCombatantDead } from '../utils/isCombatantDead.js';
import { NimbleTokenDocument } from '../documents/token/tokenDocument.js';
import {
	getMinionGroupId,
	getMinionGroupLabel,
	getMinionGroupSummaries,
	isMinionCombatant,
} from '../utils/minionGrouping.js';
import {
	MINION_GROUPING_MODE_NCS,
	shouldUseNcsTemporaryGroups,
} from '../utils/minionGroupingModes.js';
import {
	createMinionGroupAttackSelectionState,
	deriveDefaultMemberActionSelection,
	rememberMemberActionSelection,
	type MinionGroupAttackOption,
	type MinionGroupAttackSessionContext,
	type MinionGroupAttackSelectionState,
} from '../utils/minionGroupAttackSession.js';

const MINION_GROUP_ACTION_BAR_ID = 'nimble-minion-group-actions';
const NCSW_PANEL_ID = 'nimble-minion-group-attack-panel';
const MINION_GROUP_TOKEN_UI_DEBUG_ENABLED_KEY = 'NIMBLE_ENABLE_GROUP_TOKEN_UI_LOGS';
const MINION_GROUP_TOKEN_UI_DEBUG_DISABLED_KEY = 'NIMBLE_DISABLE_GROUP_TOKEN_UI_LOGS';
const MINION_GROUP_ACTION_BAR_SCALE_STORAGE_KEY = 'nimble.minionGroupActionBar.scale';
const MINION_GROUP_ACTION_BAR_POSITION_STORAGE_KEY = 'nimble.minionGroupActionBar.position';
const MINION_GROUP_ACTION_BAR_DEFAULT_SCALE = 2;
const MINION_GROUP_ACTION_BAR_MIN_SCALE = 2;
const MINION_GROUP_ACTION_BAR_MAX_SCALE = 3;
const MINION_GROUP_ACTION_BAR_VIEWPORT_MARGIN_PX = 8;
const NCSW_PANEL_VIEWPORT_MARGIN_PX = 8;
const NCSW_PANEL_MIN_WIDTH_REM = 20;
const NCSW_PANEL_MAX_TARGETS_PER_ROW = 4;
const ALLOW_GROUPING_OUTSIDE_COMBAT_SETTING_KEY = 'allowMinionGroupingOutsideCombat';
const NCS_SELECTION_ATTACK_GROUP_ID = '__nimbleNcsSelectionAttackGroup';
const NCS_SELECTION_MONSTER_ATTACK_SCOPE_ID = '__nimbleNcsSelectionMonsterAttack';
const MINION_GROUP_I18N_PREFIX = 'NIMBLE.minionGroupActions';
const NCSW_I18N_PREFIX = 'NIMBLE.nimbleCombatSystemWindow';

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
let activeNonMinionAttackMembers: GroupAttackMemberView[] = [];
let activeNonMinionAttackSelectionsByMemberId: Map<string, string | null> = new Map();
let activeGroupAttackWarnings: string[] = [];
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
let groupAttackTargetPopoverElement: HTMLDivElement | null = null;
let groupAttackTargetPopoverRefreshInterval: ReturnType<typeof setInterval> | null = null;
let groupAttackActionDescriptionPopoverElement: HTMLDivElement | null = null;
let groupAttackImagePopoverElement: HTMLDivElement | null = null;
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
		targetTokenIds?: string[];
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
	selectedAliveNonMinionMonsters: Combatant.Implementation[];
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
	memberImage: string;
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
	name?: string;
	items?: { contents?: MonsterFeatureActionItemLike[] } | MonsterFeatureActionItemLike[];
	activateItem?: (id: string, options?: Record<string, unknown>) => Promise<ChatMessage | null>;
}

function localizeByKey(key: string): string {
	return game.i18n.localize(key as never);
}

function formatByKey(key: string, data: Record<string, string | number>): string {
	const localizedData: Record<string, string> = Object.fromEntries(
		Object.entries(data).map(([entryKey, entryValue]) => [entryKey, String(entryValue)]),
	);
	return game.i18n.format(key as never, localizedData);
}

function localizeMinionGroupAction(key: string): string {
	return localizeByKey(`${MINION_GROUP_I18N_PREFIX}.${key}`);
}

function formatMinionGroupAction(key: string, data: Record<string, string | number>): string {
	return formatByKey(`${MINION_GROUP_I18N_PREFIX}.${key}`, data);
}

function localizeNcsw(key: string): string {
	return localizeByKey(`${NCSW_I18N_PREFIX}.${key}`);
}

function formatNcsw(key: string, data: Record<string, string | number>): string {
	return formatByKey(`${NCSW_I18N_PREFIX}.${key}`, data);
}

function isTokenUiDebugEnabled(): boolean {
	const globals = globalThis as Record<string, unknown>;
	return (
		Boolean(game.user?.isGM) &&
		globals[MINION_GROUP_TOKEN_UI_DEBUG_ENABLED_KEY] === true &&
		globals[MINION_GROUP_TOKEN_UI_DEBUG_DISABLED_KEY] !== true
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

	const selectedNonPlayerCombatants = selectedCombatants.filter(
		(combatant) => combatant.type !== 'character',
	);
	const selectedMinions = selectedNonPlayerCombatants.filter((combatant) =>
		isMinionCombatant(combatant),
	);
	const selectedAliveNonMinionMonsters = selectedNonPlayerCombatants.filter(
		(combatant) => !isMinionCombatant(combatant) && !isCombatantDead(combatant),
	);
	const selectedInCombatNonMinionCount = Math.max(
		0,
		selectedNonPlayerCombatants.length - selectedMinions.length,
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
	const ncsSelectedAliveMinionIds = [
		...new Set(
			selectedAliveMinions
				.map((combatant) => combatant.id)
				.filter((combatantId): combatantId is string => typeof combatantId === 'string'),
		),
	];
	const attackableGroupSummaries =
		ncsSelectedAliveMinionIds.length >= 1
			? [
					{
						groupId: NCS_SELECTION_ATTACK_GROUP_ID,
						label: null,
						selectedCount: ncsSelectedAliveMinionIds.length,
						totalCount: ncsSelectedAliveMinionIds.length,
						aliveCount: ncsSelectedAliveMinionIds.length,
						selectedCombatantIds: ncsSelectedAliveMinionIds,
						isPartialSelection: false,
						isFullSelection: true,
					},
				]
			: [];

	const canCreateGroup =
		selectedUngroupedAliveMinionCountForActions >= 2 && selectedGroupedMinions.length === 0;
	const canAddToGroup =
		addableGroupSummaries.length > 0 && selectedUngroupedAliveMinionCountForActions > 0;
	const canRemoveFromGroup = removableGroupSummaries.length > 0;
	const canDissolveGroups = dissolvableGroupSummaries.length > 0;
	const canAttackGroups = Boolean(combat) && attackableGroupSummaries.length > 0;

	return {
		combat,
		allowGroupingOutsideCombat,
		selectedTokenCount,
		selectedCombatants,
		selectedAliveNonMinionMonsters,
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
		return localizeMinionGroupAction('hints.selectMoreMinions');
	}

	if (!hasInCombatMinions && hasAnyNonMinions) {
		return localizeMinionGroupAction('hints.noMinionsSelected');
	}

	if (hasInCombatMinions) {
		return localizeMinionGroupAction('hints.selectMoreMinions');
	}

	if (context.selectedTokenCount > 0) {
		return localizeMinionGroupAction('hints.noMinionsSelected');
	}

	if (!context.combat) {
		return localizeMinionGroupAction('hints.selectMoreMinions');
	}

	return null;
}

function getGroupAttackAvailabilityDiagnostics(context: SelectionContext): {
	available: boolean;
	reasons: string[];
} {
	const reasons: string[] = [];
	if (!context.combat) reasons.push('noCombatForScene');
	if (context.attackableGroupSummaries.length === 0) reasons.push('noAttackableSelection');

	return {
		available: context.canAttackGroups,
		reasons,
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

	const normalizeFormulaForDisplay = (formula: string): string | null => {
		const normalized = formula.replace(/\s+/g, ' ').trim();
		if (!normalized) return null;

		// Prefer the first alternate when formulas include free-text separators (e.g. "1d10, OR 2d6").
		const firstSegment =
			normalized
				.split(/\s*(?:\||,|;|\bor\b)\s*/i)
				.map((segment) => segment.trim())
				.find((segment) => segment.length > 0) ?? normalized;

		const diceMatch = firstSegment.match(/\b\d*d\d+(?:\s*[+-]\s*\d+)?\b/i);
		if (!diceMatch) return firstSegment;
		return diceMatch[0].replace(/\s+/g, '');
	};

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
				.map((formula) => normalizeFormulaForDisplay(formula))
				.filter((formula): formula is string => Boolean(formula)),
		),
	];

	if (formulas.length === 0) return null;
	return formulas.join(' + ');
}

function normalizeDescriptionToPlainText(value: unknown): string | null {
	if (typeof value !== 'string') return null;
	const normalized = value.trim();
	if (!normalized) return null;

	const htmlWrapper = document.createElement('div');
	htmlWrapper.innerHTML = normalized;
	const text = htmlWrapper.textContent?.replace(/\s+/g, ' ').trim() ?? '';
	return text.length > 0 ? text : null;
}

function getActionDescriptionLabel(item: MonsterFeatureActionItemLike): string | null {
	const descriptionCandidates: unknown[] = [
		foundry.utils.getProperty(item, 'system.description'),
		foundry.utils.getProperty(item, 'system.description.value'),
		foundry.utils.getProperty(item, 'system.activation.description'),
		foundry.utils.getProperty(item, 'system.activation.description.value'),
		foundry.utils.getProperty(item, 'system.details.description'),
		foundry.utils.getProperty(item, 'system.details.description.value'),
	];

	for (const candidate of descriptionCandidates) {
		const normalized = normalizeDescriptionToPlainText(candidate);
		if (normalized) return normalized;
	}

	return null;
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
				description: getActionDescriptionLabel(item),
				unsupportedReasons,
			};
		})
		.filter((option) => option.actionId.length > 0)
		.sort((left, right) =>
			left.label.localeCompare(right.label, undefined, { sensitivity: 'base' }),
		);
}

function getCurrentTargetSummary(): {
	targetTokenId: string | null;
	targetTokenIds: string[];
	targetName: string | null;
} {
	const selectedTargets = Array.from(game.user?.targets ?? []);
	const targetTokenIds = [
		...new Set(
			selectedTargets
				.map((target) => (target?.id ?? target?.document?.id ?? '').trim())
				.filter((tokenId): tokenId is string => tokenId.length > 0),
		),
	];
	const targetTokenId = targetTokenIds[0] ?? null;

	if (targetTokenIds.length !== 1) {
		return { targetTokenId, targetTokenIds, targetName: null };
	}

	const [target] = selectedTargets;
	const targetName =
		target?.name?.trim() ||
		target?.document?.name?.trim() ||
		target?.document?.actor?.name?.trim() ||
		'Target';

	return {
		targetTokenId,
		targetTokenIds,
		targetName,
	};
}

interface TargetTokenView {
	token: Token;
	tokenId: string;
	name: string;
	image: string;
	isTargeted: boolean;
	hpCurrent: number | null;
	hpMax: number | null;
	wounds: number;
}

interface CombatantPreviewStats {
	tokenName: string;
	hpCurrent: number | null;
	hpMax: number | null;
	hpPercent: number;
	isBloodied: boolean;
}

function getTargetTokenVitalStats(token: Token): {
	hpCurrent: number | null;
	hpMax: number | null;
	wounds: number;
} {
	const actor = token.actor ?? token.document?.actor ?? null;
	if (!actor) {
		return {
			hpCurrent: null,
			hpMax: null,
			wounds: 0,
		};
	}
	const hpCurrentRaw = Number(
		foundry.utils.getProperty(actor, 'system.attributes.hp.value') as number | null,
	);
	const hpMaxRaw = Number(
		foundry.utils.getProperty(actor, 'system.attributes.hp.max') as number | null,
	);
	const woundsRaw = Number(
		foundry.utils.getProperty(actor, 'system.attributes.wounds.value') as number | null,
	);

	const hpCurrent = Number.isFinite(hpCurrentRaw) ? hpCurrentRaw : null;
	const hpMax = Number.isFinite(hpMaxRaw) && hpMaxRaw > 0 ? hpMaxRaw : null;
	const wounds = Number.isFinite(woundsRaw) ? Math.max(0, Math.floor(woundsRaw)) : 0;

	return { hpCurrent, hpMax, wounds };
}

function getCombatantPreviewStats(
	combatantId: string,
	fallbackName: string,
): CombatantPreviewStats {
	const combat = getCombatForCurrentScene();
	const combatant = combat?.combatants.get(combatantId) ?? null;
	const tokenName =
		combatant?.name?.trim() || combatant?.token?.name?.trim() || fallbackName || 'Monster';
	const actor = (combatant?.actor as ActorWithActionItems | null) ?? null;
	const actorData = actor ?? {};
	const hpCurrentRaw = Number(
		foundry.utils.getProperty(actorData, 'system.attributes.hp.value') as number | null,
	);
	const hpMaxRaw = Number(
		foundry.utils.getProperty(actorData, 'system.attributes.hp.max') as number | null,
	);
	const hpCurrent = Number.isFinite(hpCurrentRaw) ? hpCurrentRaw : null;
	const hpMax = Number.isFinite(hpMaxRaw) && hpMaxRaw > 0 ? hpMaxRaw : null;
	const hpPercent =
		hpMax && hpCurrent !== null
			? Math.max(0, Math.min(100, Math.round((hpCurrent / hpMax) * 100)))
			: 0;
	const isBloodied = Boolean(hpMax && hpCurrent !== null && hpCurrent <= hpMax / 2);

	return {
		tokenName,
		hpCurrent,
		hpMax,
		hpPercent,
		isBloodied,
	};
}

function getCombatantRowImage(combatant: Combatant.Implementation): string {
	const tokenTextureSource = (combatant.token as unknown as { texture?: { src?: string } } | null)
		?.texture?.src;
	if (typeof tokenTextureSource === 'string' && tokenTextureSource.trim().length > 0) {
		return tokenTextureSource.trim();
	}

	const combatantImage = (combatant as unknown as { img?: string }).img;
	if (typeof combatantImage === 'string' && combatantImage.trim().length > 0) {
		return combatantImage.trim();
	}

	const actorImage = (combatant.actor as unknown as { img?: string } | null)?.img;
	if (typeof actorImage === 'string' && actorImage.trim().length > 0) {
		return actorImage.trim();
	}

	return 'icons/svg/mystery-man.svg';
}

function getAvailablePlayerTargetTokens(): TargetTokenView[] {
	const controlledTokens = canvas?.tokens?.controlled ?? [];
	const targetedTokens = Array.from(game.user?.targets ?? []);
	const candidateTokensById = new Map<string, Token>();
	for (const tokenCandidate of [...controlledTokens, ...targetedTokens]) {
		const token = tokenCandidate as Token;
		const tokenId = (token?.id ?? token?.document?.id ?? '').trim();
		if (!tokenId) continue;
		if (!candidateTokensById.has(tokenId)) {
			candidateTokensById.set(tokenId, token);
		}
	}
	const selectedTargetIds = new Set(
		Array.from(game.user?.targets ?? [])
			.map((target) => (target?.id ?? target?.document?.id ?? '').trim())
			.filter((tokenId): tokenId is string => tokenId.length > 0),
	);

	const rows: TargetTokenView[] = [];
	for (const token of candidateTokensById.values()) {
		const actorType = (token.actor?.type ?? token.document?.actor?.type ?? '').trim().toLowerCase();
		if (actorType !== 'character') continue;
		const tokenId = (token.id ?? token.document?.id ?? '').trim();
		if (!tokenId) continue;

		const image =
			(token.document?.texture?.src ?? token.actor?.img ?? '').trim() ||
			'icons/svg/mystery-man.svg';
		const name =
			token.document?.name?.trim() ||
			token.name?.trim() ||
			token.actor?.name?.trim() ||
			localizeNcsw('targets.playerFallback');
		const vitalStats = getTargetTokenVitalStats(token);

		rows.push({
			token,
			tokenId,
			name,
			image,
			isTargeted: selectedTargetIds.has(tokenId),
			hpCurrent: vitalStats.hpCurrent,
			hpMax: vitalStats.hpMax,
			wounds: vitalStats.wounds,
		});
	}

	return rows;
}

function toggleTargetTokenFromPanel(token: Token, targeted: boolean): void {
	if (!game.user) return;
	token.setTarget(targeted, {
		user: game.user,
		releaseOthers: false,
		groupSelection: true,
	});
}

function clearAllUserSelectedTargetsFromNcsw(): void {
	if (!game.user) return;
	const currentTargets = Array.from(game.user.targets ?? []);
	for (const target of currentTargets) {
		target.setTarget(false, {
			user: game.user,
			releaseOthers: false,
			groupSelection: true,
		});
	}
}

function getRootFontSizePx(): number {
	const rootElement = document.documentElement;
	if (!rootElement) return 16;
	const parsed = Number.parseFloat(globalThis.getComputedStyle(rootElement).fontSize);
	return Number.isFinite(parsed) && parsed > 0 ? parsed : 16;
}

function parseCssPixels(value: string | null | undefined): number {
	if (!value) return 0;
	const parsed = Number.parseFloat(value);
	return Number.isFinite(parsed) ? parsed : 0;
}

function getElementHorizontalGapPx(element: HTMLElement): number {
	const styles = globalThis.getComputedStyle(element);
	const columnGap = parseCssPixels(styles.columnGap);
	if (columnGap > 0) return columnGap;
	return parseCssPixels(styles.gap);
}

function measureTargetListWidthPx(targetList: HTMLElement): number {
	const tokenButtons = [...targetList.children].filter(
		(child): child is HTMLButtonElement =>
			child instanceof HTMLButtonElement &&
			child.classList.contains('nimble-minion-group-attack-panel__target-token'),
	);
	const measuredElements =
		tokenButtons.length > 0
			? tokenButtons.slice(0, Math.min(NCSW_PANEL_MAX_TARGETS_PER_ROW, tokenButtons.length))
			: [...targetList.children].filter(
					(child): child is HTMLElement => child instanceof HTMLElement,
				);
	if (measuredElements.length === 0) return 0;
	const gapPx = getElementHorizontalGapPx(targetList);
	const childrenWidthPx = measuredElements.reduce(
		(total, child) => total + child.getBoundingClientRect().width,
		0,
	);
	return childrenWidthPx + gapPx * Math.max(0, measuredElements.length - 1);
}

function applyGroupAttackPanelWidth(options: {
	panel: HTMLDivElement;
	targetRow: HTMLDivElement;
	targetLabel: HTMLSpanElement;
	targetList: HTMLDivElement;
}): void {
	const remPx = getRootFontSizePx();
	const minWidthPx = NCSW_PANEL_MIN_WIDTH_REM * remPx;
	const panelStyles = globalThis.getComputedStyle(options.panel);
	const panelPaddingWidthPx =
		parseCssPixels(panelStyles.paddingLeft) + parseCssPixels(panelStyles.paddingRight);
	const targetRowStyles = globalThis.getComputedStyle(options.targetRow);
	const targetRowPaddingWidthPx =
		parseCssPixels(targetRowStyles.paddingLeft) + parseCssPixels(targetRowStyles.paddingRight);
	const targetRowGapPx = getElementHorizontalGapPx(options.targetRow);
	const targetLabelWidthPx = options.targetLabel.getBoundingClientRect().width;
	const targetListWidthPx = measureTargetListWidthPx(options.targetList);
	const targetPreferredWidthPx =
		panelPaddingWidthPx +
		targetRowPaddingWidthPx +
		targetLabelWidthPx +
		targetRowGapPx +
		targetListWidthPx +
		4;
	const desiredWidthPx = Math.max(minWidthPx, targetPreferredWidthPx);
	const viewportMaxWidthPx = Math.max(
		minWidthPx,
		window.innerWidth - NCSW_PANEL_VIEWPORT_MARGIN_PX * 2,
	);
	const nextWidthPx = Math.min(viewportMaxWidthPx, desiredWidthPx);
	options.panel.style.width = `${Math.round(nextWidthPx)}px`;
}

function getGroupAttackTargetPopoverElement(): HTMLDivElement {
	if (groupAttackTargetPopoverElement && document.body.contains(groupAttackTargetPopoverElement)) {
		return groupAttackTargetPopoverElement;
	}

	const element = document.createElement('div');
	element.className =
		'nimble-minion-group-attack-panel__target-tooltip nimble-minion-group-attack-panel__target-tooltip--floating';
	element.hidden = true;
	document.body.appendChild(element);
	groupAttackTargetPopoverElement = element;
	return element;
}

function clearGroupAttackTargetPopoverRefreshInterval(): void {
	if (!groupAttackTargetPopoverRefreshInterval) return;
	clearInterval(groupAttackTargetPopoverRefreshInterval);
	groupAttackTargetPopoverRefreshInterval = null;
}

function hideGroupAttackTargetPopover(): void {
	clearGroupAttackTargetPopoverRefreshInterval();
	if (!groupAttackTargetPopoverElement) return;
	groupAttackTargetPopoverElement.hidden = true;
	groupAttackTargetPopoverElement.replaceChildren();
}

function positionGroupAttackTargetPopover(anchor: HTMLElement, popover: HTMLDivElement): void {
	const margin = 8;
	const gap = 6;
	const anchorRect = anchor.getBoundingClientRect();
	const popoverRect = popover.getBoundingClientRect();

	let left = anchorRect.left + anchorRect.width / 2 - popoverRect.width / 2;
	let top = anchorRect.top - popoverRect.height - gap;

	if (top < margin) {
		top = Math.min(window.innerHeight - popoverRect.height - margin, anchorRect.bottom + gap);
	}

	left = Math.max(margin, Math.min(window.innerWidth - popoverRect.width - margin, left));
	top = Math.max(margin, Math.min(window.innerHeight - popoverRect.height - margin, top));

	popover.style.left = `${Math.round(left)}px`;
	popover.style.top = `${Math.round(top)}px`;
}

function getLiveTargetPopoverState(targetToken: TargetTokenView): TargetTokenView {
	const selectedTargetIds = new Set(
		Array.from(game.user?.targets ?? [])
			.map((target) => (target?.id ?? target?.document?.id ?? '').trim())
			.filter((tokenId): tokenId is string => tokenId.length > 0),
	);
	const vitalStats = getTargetTokenVitalStats(targetToken.token);
	return {
		...targetToken,
		isTargeted: selectedTargetIds.has(targetToken.tokenId),
		hpCurrent: vitalStats.hpCurrent,
		hpMax: vitalStats.hpMax,
		wounds: vitalStats.wounds,
	};
}

function renderGroupAttackTargetPopoverContent(
	popover: HTMLDivElement,
	targetToken: TargetTokenView,
): void {
	popover.replaceChildren();

	const tooltipHead = document.createElement('div');
	tooltipHead.className = 'nimble-minion-group-attack-panel__target-tooltip-head';

	const tooltipStateIcon = document.createElement('i');
	tooltipStateIcon.className = `nimble-minion-group-attack-panel__target-state-icon fa-solid fa-crosshairs ${
		targetToken.isTargeted
			? 'nimble-minion-group-attack-panel__target-state-icon--active'
			: 'nimble-minion-group-attack-panel__target-state-icon--inactive'
	}`;
	tooltipHead.append(tooltipStateIcon);

	const tooltipName = document.createElement('span');
	tooltipName.className = 'nimble-minion-group-attack-panel__target-tooltip-name';
	tooltipName.textContent = targetToken.name;
	tooltipHead.append(tooltipName);
	popover.append(tooltipHead);

	const tooltipMeta = document.createElement('div');
	tooltipMeta.className = 'nimble-minion-group-attack-panel__target-tooltip-meta';

	const hpBar = document.createElement('div');
	hpBar.className = 'nimble-minion-group-attack-panel__target-tooltip-hp';
	const hpCurrent = targetToken.hpCurrent ?? 0;
	const hpMax = targetToken.hpMax ?? 0;
	const hpPercent =
		hpMax > 0 ? Math.max(0, Math.min(100, Math.round((hpCurrent / hpMax) * 100))) : 0;
	hpBar.style.setProperty('--nimble-target-tooltip-hp-percent', `${hpPercent}%`);
	if (hpMax > 0 && hpCurrent <= hpMax / 2) {
		hpBar.classList.add('nimble-minion-group-attack-panel__target-tooltip-hp--bloodied');
	}

	const hpValue = document.createElement('span');
	hpValue.className = 'nimble-minion-group-attack-panel__target-tooltip-hp-value';
	hpValue.textContent =
		hpMax > 0 ? `${Math.max(0, Math.floor(hpCurrent))}/${Math.floor(hpMax)}` : '-/-';
	hpBar.append(hpValue);
	tooltipMeta.append(hpBar);

	const wounds = document.createElement('div');
	wounds.className = 'nimble-minion-group-attack-panel__target-tooltip-wound';
	const woundsIcon = document.createElement('i');
	woundsIcon.className = 'fa-solid fa-droplet';
	const woundsValue = document.createElement('span');
	woundsValue.className = 'nimble-minion-group-attack-panel__target-tooltip-wound-value';
	woundsValue.textContent = String(targetToken.wounds);
	wounds.append(woundsIcon, woundsValue);
	tooltipMeta.append(wounds);
	popover.append(tooltipMeta);
}

function showGroupAttackTargetPopover(anchor: HTMLElement, targetToken: TargetTokenView): void {
	clearGroupAttackTargetPopoverRefreshInterval();
	const popover = getGroupAttackTargetPopoverElement();

	const updatePopover = () => {
		if (!document.body.contains(anchor)) {
			hideGroupAttackTargetPopover();
			return;
		}
		const liveState = getLiveTargetPopoverState(targetToken);
		renderGroupAttackTargetPopoverContent(popover, liveState);
		popover.hidden = false;
		positionGroupAttackTargetPopover(anchor, popover);
	};

	updatePopover();
	groupAttackTargetPopoverRefreshInterval = setInterval(updatePopover, 200);
}

function getGroupAttackActionDescriptionPopoverElement(): HTMLDivElement {
	if (
		groupAttackActionDescriptionPopoverElement &&
		document.body.contains(groupAttackActionDescriptionPopoverElement)
	) {
		return groupAttackActionDescriptionPopoverElement;
	}

	const element = document.createElement('div');
	element.className = 'nimble-minion-group-attack-panel__action-tooltip';
	element.hidden = true;
	document.body.appendChild(element);
	groupAttackActionDescriptionPopoverElement = element;
	return element;
}

function hideGroupAttackActionDescriptionPopover(): void {
	if (!groupAttackActionDescriptionPopoverElement) return;
	groupAttackActionDescriptionPopoverElement.hidden = true;
	groupAttackActionDescriptionPopoverElement.textContent = '';
}

function showGroupAttackActionDescriptionPopover(anchor: HTMLElement, description: string): void {
	const popover = getGroupAttackActionDescriptionPopoverElement();
	popover.textContent = description;
	popover.hidden = false;
	const margin = 8;
	const gap = 6;
	const anchorRect = anchor.getBoundingClientRect();
	const popoverRect = popover.getBoundingClientRect();
	let left = anchorRect.left + anchorRect.width / 2 - popoverRect.width / 2;
	let top = anchorRect.top - popoverRect.height - gap;
	if (top < margin) {
		top = Math.min(window.innerHeight - popoverRect.height - margin, anchorRect.bottom + gap);
	}
	left = Math.max(margin, Math.min(window.innerWidth - popoverRect.width - margin, left));
	top = Math.max(margin, Math.min(window.innerHeight - popoverRect.height - margin, top));
	popover.style.left = `${Math.round(left)}px`;
	popover.style.top = `${Math.round(top)}px`;
}

function getGroupAttackImagePopoverElement(): HTMLDivElement {
	if (groupAttackImagePopoverElement && document.body.contains(groupAttackImagePopoverElement)) {
		return groupAttackImagePopoverElement;
	}

	const element = document.createElement('div');
	element.className = 'nimble-minion-group-attack-panel__image-popover';
	element.hidden = true;
	document.body.appendChild(element);
	groupAttackImagePopoverElement = element;
	return element;
}

function hideGroupAttackImagePopover(): void {
	if (!groupAttackImagePopoverElement) return;
	groupAttackImagePopoverElement.hidden = true;
	groupAttackImagePopoverElement.replaceChildren();
}

function showGroupAttackImagePopover(options: {
	anchor: HTMLElement;
	imageSource: string;
	imageAlt: string;
	combatantId: string;
	fallbackName: string;
	baseImageSizePx: number;
}): void {
	const panel = getGroupAttackPanelElement();
	const popover = getGroupAttackImagePopoverElement();
	popover.replaceChildren();

	const previewStats = getCombatantPreviewStats(options.combatantId, options.fallbackName);

	const name = document.createElement('div');
	name.className = 'nimble-minion-group-attack-panel__image-popover-name';
	name.textContent = previewStats.tokenName;
	popover.append(name);

	const image = document.createElement('img');
	image.className = 'nimble-minion-group-attack-panel__image-popover-image';
	image.src = options.imageSource;
	image.alt = options.imageAlt;
	popover.append(image);

	const hpBar = document.createElement('div');
	hpBar.className = 'nimble-minion-group-attack-panel__image-popover-hp';
	hpBar.style.setProperty('--nimble-image-popover-hp-percent', `${previewStats.hpPercent}%`);
	if (previewStats.isBloodied) {
		hpBar.classList.add('nimble-minion-group-attack-panel__image-popover-hp--bloodied');
	}
	const hpValue = document.createElement('span');
	hpValue.className = 'nimble-minion-group-attack-panel__image-popover-hp-value';
	hpValue.textContent =
		previewStats.hpMax && previewStats.hpCurrent !== null
			? `${Math.max(0, Math.floor(previewStats.hpCurrent))}/${Math.floor(previewStats.hpMax)}`
			: '-/-';
	hpBar.append(hpValue);
	popover.append(hpBar);

	popover.hidden = false;
	const margin = 8;
	const gap = 12;
	const panelRect = panel.getBoundingClientRect();
	const anchorRect = options.anchor.getBoundingClientRect();
	const imageSize = Math.max(56, Math.round(options.baseImageSizePx * 5));
	popover.style.width = `${imageSize}px`;
	popover.style.setProperty('--nimble-image-popover-size', `${imageSize}px`);
	const popoverRect = popover.getBoundingClientRect();

	let left = panelRect.left - popoverRect.width - gap;
	let top = anchorRect.top + anchorRect.height / 2 - popoverRect.height / 2;

	left = Math.max(margin, left);
	top = Math.max(margin, Math.min(window.innerHeight - popoverRect.height - margin, top));

	popover.style.left = `${Math.round(left)}px`;
	popover.style.top = `${Math.round(top)}px`;
}

function appendButtonWithOptionalTargetTooltip(
	container: HTMLElement,
	button: HTMLButtonElement,
	showTooltip: boolean,
): void {
	if (!showTooltip) {
		container.append(button);
		return;
	}

	const wrapper = document.createElement('span');
	wrapper.className = 'nimble-minion-group-attack-panel__button-tooltip-wrapper';
	wrapper.title = localizeNcsw('targets.selectTargetTooltip');
	wrapper.append(button);
	container.append(wrapper);
}

function getActionDescriptionForSelection(
	actionOptions: MinionGroupAttackOption[],
	selectedActionId: string | null | undefined,
): string | null {
	const actionId = selectedActionId?.trim() ?? '';
	if (!actionId) return null;
	const matchedAction = actionOptions.find((option) => option.actionId === actionId);
	const description = matchedAction?.description?.trim() ?? '';
	return description.length > 0 ? description : null;
}

function bindActionSelectDescriptionPopover(options: {
	select: HTMLSelectElement;
	getDescription: () => string | null;
}): void {
	const showTooltip = () => {
		const description = options.getDescription();
		if (!description) {
			hideGroupAttackActionDescriptionPopover();
			return;
		}
		showGroupAttackActionDescriptionPopover(options.select, description);
	};
	options.select.addEventListener('mouseenter', showTooltip);
	options.select.addEventListener('focus', showTooltip);
	options.select.addEventListener('mouseleave', hideGroupAttackActionDescriptionPopover);
	options.select.addEventListener('blur', hideGroupAttackActionDescriptionPopover);
	options.select.addEventListener('pointerdown', hideGroupAttackActionDescriptionPopover);
}

function getGroupAttackPanelElement(): HTMLDivElement {
	if (minionGroupAttackPanelElement && document.body.contains(minionGroupAttackPanelElement)) {
		return minionGroupAttackPanelElement;
	}

	const element = document.createElement('div');
	element.id = NCSW_PANEL_ID;
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
		NCSW_PANEL_VIEWPORT_MARGIN_PX,
		window.innerWidth - rect.width - NCSW_PANEL_VIEWPORT_MARGIN_PX,
	);
	const maxTop = Math.max(
		NCSW_PANEL_VIEWPORT_MARGIN_PX,
		window.innerHeight - rect.height - NCSW_PANEL_VIEWPORT_MARGIN_PX,
	);

	return {
		left: Math.round(Math.max(NCSW_PANEL_VIEWPORT_MARGIN_PX, Math.min(maxLeft, left))),
		top: Math.round(Math.max(NCSW_PANEL_VIEWPORT_MARGIN_PX, Math.min(maxTop, top))),
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

function hideGroupAttackPanel(options: { clearTargets?: boolean } = {}): void {
	if (minionGroupAttackPanelElement) {
		minionGroupAttackPanelElement.hidden = true;
		minionGroupAttackPanelElement.replaceChildren();
	}
	if (options.clearTargets ?? true) {
		clearAllUserSelectedTargetsFromNcsw();
	}
	hideGroupAttackTargetPopover();
	hideGroupAttackActionDescriptionPopover();
	hideGroupAttackImagePopover();
	stopGroupAttackPanelDragTracking();
	activeGroupAttackSession = null;
	activeGroupAttackMembers = [];
	activeNonMinionAttackMembers = [];
	activeNonMinionAttackSelectionsByMemberId = new Map();
	activeGroupAttackWarnings = [];
}

function getGroupAttackMembers(
	combat: CombatWithGrouping,
	groupId: string,
	context: SelectionContext,
): Array<{ combatant: Combatant.Implementation; member: GroupAttackMemberView }> {
	if (groupId === NCS_SELECTION_ATTACK_GROUP_ID) {
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
					memberImage: getCombatantRowImage(combatant),
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
				memberImage: getCombatantRowImage(combatant),
				actorType,
				actionsRemaining: Number.isFinite(actionsRemaining) ? Math.max(0, actionsRemaining) : 0,
				actionOptions,
			},
		});
	}

	return rows;
}

function getSelectedNonMinionAttackMembers(
	context: SelectionContext,
): Array<{ combatant: Combatant.Implementation; member: GroupAttackMemberView }> {
	const rows: Array<{ combatant: Combatant.Implementation; member: GroupAttackMemberView }> = [];
	for (const combatant of context.selectedAliveNonMinionMonsters) {
		if (!combatant.id) continue;

		const actionsRemaining = Number(
			(combatant.system as unknown as { actions?: { base?: { current?: unknown } } }).actions?.base
				?.current ?? 0,
		);
		const actor = (combatant.actor as unknown as ActorWithActionItems | null) ?? null;
		const actorType = actor?.type?.trim()?.toLowerCase() || 'npc';
		const actionOptions = buildGroupAttackActionOptions(actor);

		rows.push({
			combatant,
			member: {
				combatantId: combatant.id,
				combatantName: combatant.name?.trim() || combatant.token?.name || 'Monster',
				memberImage: getCombatantRowImage(combatant),
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

function getNonMinionActionSelectValueForMember(memberCombatantId: string): string {
	return activeNonMinionAttackSelectionsByMemberId.get(memberCombatantId) ?? '';
}

function setNonMinionActionSelectValueForMember(
	memberCombatantId: string,
	actionId: string | null,
): void {
	if (!activeNonMinionAttackMembers.some((member) => member.combatantId === memberCombatantId)) {
		return;
	}
	activeNonMinionAttackSelectionsByMemberId.set(memberCombatantId, actionId ?? '');
}

function getSelectedActionRollFormulaForMember(member: GroupAttackMemberView): string {
	const selectedActionId = getActionSelectValueForMember(member.combatantId);
	if (!selectedActionId) return '-';
	const selectedOption = member.actionOptions.find(
		(option) => option.actionId === selectedActionId,
	);
	return selectedOption?.rollFormula?.trim() || '-';
}

function getSelectedActionRollFormulaForNonMinionMember(member: GroupAttackMemberView): string {
	const selectedActionId = getNonMinionActionSelectValueForMember(member.combatantId);
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

function buildNonMinionSelectionSync(
	context: MinionGroupAttackSessionContext,
	memberRows: Array<{ member: GroupAttackMemberView }>,
	previousSelectionsByMemberId: Map<string, string | null>,
): { nextMembers: GroupAttackMemberView[]; nextSelectionsByMemberId: Map<string, string | null> } {
	const nextSelectionsByMemberId = new Map<string, string | null>();
	const nextMembers = memberRows.map((row) => row.member);

	for (const member of nextMembers) {
		const memberCombatantId = member.combatantId;
		const existingSelection = previousSelectionsByMemberId.get(memberCombatantId) ?? null;
		const hasExistingSelection =
			typeof existingSelection === 'string' &&
			existingSelection.length > 0 &&
			member.actionOptions.some((option) => option.actionId === existingSelection);
		const defaultSelection = deriveDefaultMemberActionSelection(
			{
				combatantId: memberCombatantId,
				actorType: member.actorType,
				actionOptions: member.actionOptions,
			},
			context,
			rememberedGroupAttackSelectionsByActorType,
		);
		const selectedActionId = hasExistingSelection ? existingSelection : defaultSelection;
		nextSelectionsByMemberId.set(memberCombatantId, selectedActionId ?? '');
	}

	return { nextMembers, nextSelectionsByMemberId };
}

function buildAttackActionButtonLabel(endTurn: boolean): string {
	return endTurn ? localizeNcsw('buttons.rollEndTurn') : localizeNcsw('buttons.roll');
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
				? localizeNcsw('warnings.reasons.noActionSelected')
				: skippedMember.reason === 'noActionsRemaining'
					? localizeNcsw('warnings.reasons.noActionsRemaining')
					: skippedMember.reason === 'actionNotFound'
						? localizeNcsw('warnings.reasons.actionNotFound')
						: skippedMember.reason === 'actorCannotActivate'
							? localizeNcsw('warnings.reasons.actorCannotActivate')
							: skippedMember.reason === 'activationFailed'
								? localizeNcsw('warnings.reasons.activationFailed')
								: skippedMember.reason;
		warnings.push(
			formatNcsw('warnings.memberReason', {
				memberCombatantId: skippedMember.combatantId,
				reason: reasonLabel,
			}),
		);
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
	const minionSession = activeGroupAttackSession;
	const hasMinionSection = Boolean(minionSession) && activeGroupAttackMembers.length > 0;
	const hasNonMinionSection = activeNonMinionAttackMembers.length > 0;
	if (!hasMinionSection && !hasNonMinionSection) {
		hideGroupAttackPanel();
		return;
	}

	const { targetTokenIds } = getCurrentTargetSummary();
	const hasAnyTarget = targetTokenIds.length > 0;
	const availableTargetTokens = getAvailablePlayerTargetTokens();
	const hasRollableMinionMembers = activeGroupAttackMembers.some((member) => {
		if (member.actionsRemaining < 1) return false;
		const selectedActionId = getActionSelectValueForMember(member.combatantId);
		return selectedActionId.length > 0;
	});

	panel.hidden = false;
	hideGroupAttackTargetPopover();
	hideGroupAttackActionDescriptionPopover();
	hideGroupAttackImagePopover();
	panel.replaceChildren();
	panel.style.removeProperty('width');

	const header = document.createElement('div');
	header.className = 'nimble-minion-group-attack-panel__header';
	header.title = localizeNcsw('tooltips.dragToMove');
	header.addEventListener('pointerdown', handleGroupAttackPanelDragStart);
	const logo = document.createElement('img');
	logo.className = 'nimble-minion-group-attack-panel__logo';
	logo.alt = localizeNcsw('logo.alt');
	logo.draggable = false;
	logo.src = 'systems/nimble/assets/logos/NimbleLogos.png';
	logo.addEventListener('error', () => {
		if (!logo.src.endsWith('/NimbleLogoRaw.avif')) {
			logo.src = 'systems/nimble/assets/logos/NimbleLogoRaw.avif';
		}
	});
	const title = document.createElement('h3');
	title.className = 'nimble-minion-group-attack-panel__title';
	title.textContent = localizeNcsw('title');
	header.append(logo, title);
	panel.append(header);

	const targetRow = document.createElement('div');
	targetRow.className = 'nimble-minion-group-attack-panel__target';
	const targetLabel = document.createElement('span');
	targetLabel.className = 'nimble-minion-group-attack-panel__target-label';
	const targetLabelText = document.createElement('span');
	targetLabelText.className = 'nimble-minion-group-attack-panel__target-label-text';
	targetLabelText.textContent = localizeNcsw('targets.label');
	const targetStatusIcon = document.createElement('i');
	targetStatusIcon.className = `nimble-minion-group-attack-panel__target-label-icon fa-solid fa-crosshairs ${
		hasAnyTarget
			? 'nimble-minion-group-attack-panel__target-label-icon--active'
			: 'nimble-minion-group-attack-panel__target-label-icon--inactive'
	}`;
	targetLabel.append(targetLabelText, targetStatusIcon);
	targetRow.append(targetLabel);

	const targetList = document.createElement('div');
	targetList.className = 'nimble-minion-group-attack-panel__target-list';

	if (availableTargetTokens.length === 0) {
		const hint = document.createElement('span');
		hint.className = 'nimble-minion-group-attack-panel__target-hint';
		hint.textContent = localizeNcsw('targets.hint');
		targetList.append(hint);
	} else {
		for (const targetToken of availableTargetTokens) {
			const targetButton = document.createElement('button');
			targetButton.type = 'button';
			targetButton.className = 'nimble-minion-group-attack-panel__target-token';
			if (!targetToken.isTargeted) {
				targetButton.classList.add('nimble-minion-group-attack-panel__target-token--inactive');
			}
			targetButton.ariaLabel = targetToken.isTargeted
				? formatNcsw('targets.untargetAria', { name: targetToken.name })
				: formatNcsw('targets.targetAria', { name: targetToken.name });

			const image = document.createElement('img');
			image.className = 'nimble-minion-group-attack-panel__target-token-image';
			image.src = targetToken.image;
			image.alt = targetToken.name;
			targetButton.append(image);

			targetButton.addEventListener('mouseenter', () => {
				showGroupAttackTargetPopover(targetButton, targetToken);
			});
			targetButton.addEventListener('mouseleave', () => {
				hideGroupAttackTargetPopover();
			});
			targetButton.addEventListener('focus', () => {
				showGroupAttackTargetPopover(targetButton, targetToken);
			});
			targetButton.addEventListener('blur', () => {
				hideGroupAttackTargetPopover();
			});
			targetButton.addEventListener('pointerdown', () => {
				hideGroupAttackTargetPopover();
			});

			targetButton.addEventListener('click', () => {
				toggleTargetTokenFromPanel(targetToken.token, !targetToken.isTargeted);
				scheduleActionBarRefresh('ncsw-target-toggle');
			});

			targetList.append(targetButton);
		}
	}
	targetRow.append(targetList);
	panel.append(targetRow);

	if (hasNonMinionSection) {
		const nonMinionTitle = document.createElement('div');
		nonMinionTitle.className = 'nimble-minion-group-attack-panel__section-title';
		const nonMinionTitleText = document.createElement('span');
		nonMinionTitleText.className = 'nimble-minion-group-attack-panel__section-title-text';
		nonMinionTitleText.textContent = localizeNcsw('sections.monsters');
		const nonMinionTitleIcons = document.createElement('span');
		nonMinionTitleIcons.className = 'nimble-minion-group-attack-panel__section-title-icons';
		const nonMinionIcon = document.createElement('i');
		nonMinionIcon.className = 'nimble-minion-group-attack-panel__section-icon fa-solid fa-dragon';
		nonMinionTitleIcons.append(nonMinionIcon);
		nonMinionTitle.append(nonMinionTitleText, nonMinionTitleIcons);
		panel.append(nonMinionTitle);

		const nonMinionTable = document.createElement('table');
		nonMinionTable.className =
			'nimble-minion-group-attack-panel__table nimble-minion-group-attack-panel__table--monsters';
		const nonMinionBody = document.createElement('tbody');

		for (const member of activeNonMinionAttackMembers) {
			const row = document.createElement('tr');
			row.className =
				'nimble-minion-group-attack-panel__row nimble-minion-group-attack-panel__row--monster';
			const hasNoActionsRemaining = member.actionsRemaining < 1;
			if (hasNoActionsRemaining) {
				row.classList.add('nimble-minion-group-attack-panel__row--inactive');
			}

			const memberCell = document.createElement('td');
			memberCell.className = 'nimble-minion-group-attack-panel__member';
			const memberContent = document.createElement('div');
			memberContent.className = 'nimble-minion-group-attack-panel__member-content';
			const memberImage = document.createElement('img');
			memberImage.className = 'nimble-minion-group-attack-panel__member-image';
			memberImage.src = member.memberImage;
			memberImage.alt = member.combatantName;
			const memberName = document.createElement('span');
			memberName.className = 'nimble-minion-group-attack-panel__member-name';
			memberName.textContent = member.combatantName;
			const showMemberPreview = (anchor: HTMLElement) => {
				showGroupAttackImagePopover({
					anchor,
					imageSource: member.memberImage,
					imageAlt: member.combatantName,
					combatantId: member.combatantId,
					fallbackName: member.combatantName,
					baseImageSizePx: memberImage.getBoundingClientRect().width || 28,
				});
			};
			memberImage.addEventListener('mouseenter', () => showMemberPreview(memberImage));
			memberName.addEventListener('mouseenter', () => showMemberPreview(memberName));
			memberContent.addEventListener('mouseleave', hideGroupAttackImagePopover);
			memberContent.addEventListener('pointerdown', hideGroupAttackImagePopover);
			memberContent.append(memberImage, memberName);
			memberCell.append(memberContent);

			const actionCell = document.createElement('td');
			actionCell.className = 'nimble-minion-group-attack-panel__action';
			const select = document.createElement('select');
			select.className = 'nimble-minion-group-attack-panel__select';
			select.disabled = member.actionOptions.length === 0 || member.actionsRemaining < 1;
			select.dataset.memberCombatantId = member.combatantId;

			const placeholder = document.createElement('option');
			placeholder.value = '';
			placeholder.textContent =
				member.actionsRemaining < 1
					? localizeNcsw('actions.noActionsLeft')
					: localizeNcsw('actions.selectAction');
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

			select.value = getNonMinionActionSelectValueForMember(member.combatantId);
			bindActionSelectDescriptionPopover({
				select,
				getDescription: () => getActionDescriptionForSelection(member.actionOptions, select.value),
			});
			select.addEventListener('change', (event) => {
				const target = event.currentTarget as HTMLSelectElement;
				const nextActionId = target.value.trim();
				setNonMinionActionSelectValueForMember(
					member.combatantId,
					nextActionId.length > 0 ? nextActionId : null,
				);
				renderGroupAttackPanel();
			});

			const diceCell = document.createElement('td');
			diceCell.className = 'nimble-minion-group-attack-panel__dice';
			diceCell.textContent = getSelectedActionRollFormulaForNonMinionMember(member);

			const controls = document.createElement('div');
			controls.className =
				'nimble-minion-group-attack-panel__inline-buttons nimble-minion-group-attack-panel__inline-buttons--monster-row';

			const selectedActionId = getNonMinionActionSelectValueForMember(member.combatantId);
			const canRollMonster =
				hasAnyTarget &&
				!isExecutingAction &&
				member.actionsRemaining > 0 &&
				selectedActionId.trim().length > 0 &&
				member.actionOptions.some((option) => option.actionId === selectedActionId);
			const missingTarget = !hasAnyTarget;

			const rollButton = document.createElement('button');
			rollButton.type = 'button';
			rollButton.className =
				'nimble-minion-group-attack-panel__button nimble-minion-group-attack-panel__button--positive';
			rollButton.textContent = buildAttackActionButtonLabel(false);
			rollButton.disabled = !canRollMonster;
			rollButton.addEventListener('click', () => {
				void executeNonMinionAttackRoll(member.combatantId, false);
			});
			appendButtonWithOptionalTargetTooltip(controls, rollButton, missingTarget);

			const rollEndTurnButton = document.createElement('button');
			rollEndTurnButton.type = 'button';
			rollEndTurnButton.className =
				'nimble-minion-group-attack-panel__button nimble-minion-group-attack-panel__button--positive';
			rollEndTurnButton.textContent = buildAttackActionButtonLabel(true);
			rollEndTurnButton.disabled = !canRollMonster;
			rollEndTurnButton.addEventListener('click', () => {
				void executeNonMinionAttackRoll(member.combatantId, true);
			});
			appendButtonWithOptionalTargetTooltip(controls, rollEndTurnButton, missingTarget);

			actionCell.append(select);
			row.append(memberCell, actionCell, diceCell);
			nonMinionBody.append(row);

			const controlsRow = document.createElement('tr');
			controlsRow.className =
				'nimble-minion-group-attack-panel__row nimble-minion-group-attack-panel__row--monster-controls';
			if (hasNoActionsRemaining) {
				controlsRow.classList.add('nimble-minion-group-attack-panel__row--inactive');
			}
			const controlsCell = document.createElement('td');
			controlsCell.className = 'nimble-minion-group-attack-panel__monster-controls-cell';
			controlsCell.colSpan = 3;
			controlsCell.append(controls);
			controlsRow.append(controlsCell);
			nonMinionBody.append(controlsRow);
		}

		nonMinionTable.append(nonMinionBody);
		panel.append(nonMinionTable);
	}

	if (hasMinionSection) {
		const minionTitle = document.createElement('div');
		minionTitle.className = 'nimble-minion-group-attack-panel__section-title';
		const minionTitleText = document.createElement('span');
		minionTitleText.className = 'nimble-minion-group-attack-panel__section-title-text';
		minionTitleText.textContent = localizeNcsw('sections.minions');
		const minionTitleIcons = document.createElement('span');
		minionTitleIcons.className = 'nimble-minion-group-attack-panel__section-title-icons';
		const minionIcon = document.createElement('i');
		minionIcon.className = 'nimble-minion-group-attack-panel__section-icon fa-solid fa-dragon';
		minionTitleIcons.append(minionIcon);
		minionTitle.append(minionTitleText, minionTitleIcons);
		panel.append(minionTitle);

		const table = document.createElement('table');
		table.className = 'nimble-minion-group-attack-panel__table';
		const body = document.createElement('tbody');

		for (const member of activeGroupAttackMembers) {
			const row = document.createElement('tr');
			row.className = 'nimble-minion-group-attack-panel__row';
			if (member.actionsRemaining < 1) {
				row.classList.add('nimble-minion-group-attack-panel__row--inactive');
			}

			const memberCell = document.createElement('td');
			memberCell.className = 'nimble-minion-group-attack-panel__member';
			const memberContent = document.createElement('div');
			memberContent.className = 'nimble-minion-group-attack-panel__member-content';
			const memberImage = document.createElement('img');
			memberImage.className = 'nimble-minion-group-attack-panel__member-image';
			memberImage.src = member.memberImage;
			memberImage.alt = member.combatantName;
			const memberName = document.createElement('span');
			memberName.className = 'nimble-minion-group-attack-panel__member-name';
			memberName.textContent = member.combatantName;
			const showMemberPreview = (anchor: HTMLElement) => {
				showGroupAttackImagePopover({
					anchor,
					imageSource: member.memberImage,
					imageAlt: member.combatantName,
					combatantId: member.combatantId,
					fallbackName: member.combatantName,
					baseImageSizePx: memberImage.getBoundingClientRect().width || 28,
				});
			};
			memberImage.addEventListener('mouseenter', () => showMemberPreview(memberImage));
			memberName.addEventListener('mouseenter', () => showMemberPreview(memberName));
			memberContent.addEventListener('mouseleave', hideGroupAttackImagePopover);
			memberContent.addEventListener('pointerdown', hideGroupAttackImagePopover);
			memberContent.append(memberImage, memberName);
			memberCell.append(memberContent);

			const actionCell = document.createElement('td');
			actionCell.className = 'nimble-minion-group-attack-panel__action';
			const select = document.createElement('select');
			select.className = 'nimble-minion-group-attack-panel__select';
			select.disabled = member.actionOptions.length === 0 || member.actionsRemaining < 1;
			select.dataset.memberCombatantId = member.combatantId;

			const placeholder = document.createElement('option');
			placeholder.value = '';
			placeholder.textContent =
				member.actionsRemaining < 1
					? localizeNcsw('actions.noActionsLeft')
					: localizeNcsw('actions.selectAction');
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
			bindActionSelectDescriptionPopover({
				select,
				getDescription: () => getActionDescriptionForSelection(member.actionOptions, select.value),
			});
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
	}

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
	if (hasMinionSection) {
		const missingTarget = !hasAnyTarget;
		const rollButton = document.createElement('button');
		rollButton.type = 'button';
		rollButton.className =
			'nimble-minion-group-attack-panel__button nimble-minion-group-attack-panel__button--positive';
		rollButton.textContent = buildAttackActionButtonLabel(false);
		rollButton.disabled = !hasAnyTarget || !hasRollableMinionMembers || isExecutingAction;
		rollButton.addEventListener('click', () => {
			void executeGroupAttackRoll(false);
		});
		appendButtonWithOptionalTargetTooltip(buttons, rollButton, missingTarget);

		const rollEndTurnButton = document.createElement('button');
		rollEndTurnButton.type = 'button';
		rollEndTurnButton.className =
			'nimble-minion-group-attack-panel__button nimble-minion-group-attack-panel__button--positive';
		rollEndTurnButton.textContent = buildAttackActionButtonLabel(true);
		rollEndTurnButton.disabled = !hasAnyTarget || !hasRollableMinionMembers || isExecutingAction;
		rollEndTurnButton.addEventListener('click', () => {
			void executeGroupAttackRoll(true);
		});
		appendButtonWithOptionalTargetTooltip(buttons, rollEndTurnButton, missingTarget);
	}

	const closeButton = document.createElement('button');
	closeButton.type = 'button';
	closeButton.className =
		'nimble-minion-group-attack-panel__button nimble-minion-group-attack-panel__button--negative';
	closeButton.textContent = localizeNcsw('buttons.close');
	closeButton.disabled = isExecutingAction;
	closeButton.addEventListener('click', () => {
		hideGroupAttackPanel();
	});
	buttons.append(closeButton);

	panel.append(buttons);
	applyGroupAttackPanelWidth({
		panel,
		targetRow,
		targetLabel,
		targetList,
	});

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

			if (left + panelRect.width > window.innerWidth - NCSW_PANEL_VIEWPORT_MARGIN_PX) {
				left = Math.max(NCSW_PANEL_VIEWPORT_MARGIN_PX, actionBarRect.left - panelRect.width - 12);
			}
			if (top + panelRect.height > window.innerHeight - NCSW_PANEL_VIEWPORT_MARGIN_PX) {
				top = Math.max(
					NCSW_PANEL_VIEWPORT_MARGIN_PX,
					window.innerHeight - panelRect.height - NCSW_PANEL_VIEWPORT_MARGIN_PX,
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
		ui.notifications?.warn(localizeNcsw('notifications.noActiveCombatForGroupAttack'));
		return;
	}
	if (!combat.started) {
		await combat.startCombat();
	}

	const targetSummary = getCurrentTargetSummary();
	if (targetSummary.targetTokenIds.length === 0 || !targetSummary.targetTokenId) {
		ui.notifications?.warn(localizeNcsw('notifications.selectTargetBeforeGroupAttack'));
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
			targetTokenIds: targetSummary.targetTokenIds,
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
			ui.notifications?.warn(localizeNcsw('notifications.noGroupAttacksRolled'));
		}
		if (endTurn && !result.endTurnApplied) {
			activeGroupAttackWarnings = [
				...activeGroupAttackWarnings,
				localizeNcsw('warnings.endTurnNotApplied'),
			];
		}

		renderGroupAttackPanel();
		scheduleActionBarRefresh('group-attack-roll-end');
	} catch (error) {
		console.error('[Nimble][MinionGrouping][TokenUI] Group attack roll failed', {
			groupId: session.context.groupId,
			error,
		});
		ui.notifications?.error(localizeNcsw('notifications.groupAttackFailed'));
	} finally {
		isExecutingAction = false;
		scheduleActionBarRefresh('group-attack-roll-finalize');
	}
}

async function executeNonMinionAttackRoll(
	memberCombatantId: string,
	endTurn: boolean,
): Promise<void> {
	if (isExecutingAction) return;

	const combat = getCombatForCurrentScene();
	if (!combat) {
		ui.notifications?.warn(localizeNcsw('notifications.noActiveCombatForMonsterAttack'));
		return;
	}
	if (!combat.started) {
		await combat.startCombat();
	}

	const member = activeNonMinionAttackMembers.find(
		(candidate) => candidate.combatantId === memberCombatantId,
	);
	if (!member) return;

	const selectedActionId = getNonMinionActionSelectValueForMember(memberCombatantId).trim();
	if (!selectedActionId) {
		ui.notifications?.warn(
			formatNcsw('notifications.selectActionBeforeRoll', { name: member.combatantName }),
		);
		return;
	}

	const selectedAction = member.actionOptions.find(
		(actionOption) => actionOption.actionId === selectedActionId,
	);
	if (!selectedAction) {
		ui.notifications?.warn(
			formatNcsw('notifications.actionUnavailableForMonster', { name: member.combatantName }),
		);
		return;
	}

	const combatant = combat.combatants.get(memberCombatantId) ?? null;
	if (!combatant) {
		ui.notifications?.warn(
			formatNcsw('notifications.monsterNoLongerInCombat', { name: member.combatantName }),
		);
		return;
	}

	if (isCombatantDead(combatant)) {
		ui.notifications?.warn(
			formatNcsw('notifications.monsterDefeatedCannotAct', { name: member.combatantName }),
		);
		return;
	}

	const actionsRemaining = Number(
		(combatant.system as unknown as { actions?: { base?: { current?: unknown } } }).actions?.base
			?.current ?? 0,
	);
	if (!Number.isFinite(actionsRemaining) || actionsRemaining < 1) {
		ui.notifications?.warn(
			formatNcsw('notifications.monsterNoActionsLeft', { name: member.combatantName }),
		);
		return;
	}

	const actor = (combatant.actor as unknown as ActorWithActionItems | null) ?? null;
	if (!actor?.activateItem) {
		ui.notifications?.warn(
			formatNcsw('notifications.monsterCannotActivateActions', { name: member.combatantName }),
		);
		return;
	}

	isExecutingAction = true;
	scheduleActionBarRefresh('monster-attack-roll-start');
	try {
		await actor.activateItem(selectedActionId, { fastForward: true });

		const latestCombatant = combat.combatants.get(memberCombatantId) ?? combatant;
		const latestActions = Number(
			(foundry.utils.getProperty(latestCombatant, 'system.actions.base.current') as
				| number
				| null) ?? actionsRemaining,
		);
		if (Number.isFinite(latestActions) && latestActions > 0) {
			const actionUpdate: Record<string, unknown> = {
				_id: memberCombatantId,
				'system.actions.base.current': Math.max(0, latestActions - 1),
			};
			await combat.updateEmbeddedDocuments('Combatant', [actionUpdate]);
		}

		const rememberContext: MinionGroupAttackSessionContext = {
			combatId: combat.id ?? '',
			groupId: NCS_SELECTION_MONSTER_ATTACK_SCOPE_ID,
			memberCombatantIds: activeNonMinionAttackMembers.map(
				(activeMember) => activeMember.combatantId,
			),
			targetTokenId: getCurrentTargetSummary().targetTokenId,
			groupingMode: MINION_GROUPING_MODE_NCS,
			isTemporaryGroup: true,
		};
		rememberMemberActionSelection(
			rememberedGroupAttackSelectionsByActorType,
			rememberContext,
			member.actorType,
			selectedActionId,
		);

		if (endTurn) {
			const activeCombatantId = combat.combatant?.id ?? null;
			if (activeCombatantId === memberCombatantId) {
				await combat.nextTurn();
			}
		}

		scheduleActionBarRefresh('monster-attack-roll-end');
	} catch (error) {
		console.error('[Nimble][MinionGrouping][TokenUI] Monster attack roll failed', {
			memberCombatantId,
			selectedActionId,
			error,
		});
		ui.notifications?.error(localizeNcsw('notifications.monsterAttackFailed'));
	} finally {
		isExecutingAction = false;
		scheduleActionBarRefresh('monster-attack-roll-finalize');
	}
}

function openGroupAttackPanel(context: SelectionContext, groupId: string): void {
	const combat = context.combat;
	if (!combat || !groupId) return;

	const selectedGroup = context.attackableGroupSummaries.find(
		(summary) => summary.groupId === groupId,
	);
	if (!selectedGroup) return;

	const memberRows = getGroupAttackMembers(combat, groupId, context);
	if (memberRows.length === 0) {
		ui.notifications?.warn(localizeNcsw('notifications.selectedGroupHasNoAliveMinions'));
		return;
	}

	const sessionContext: MinionGroupAttackSessionContext = {
		combatId: combat.id ?? '',
		groupId,
		memberCombatantIds: memberRows.map((row) => row.member.combatantId),
		targetTokenId: getCurrentTargetSummary().targetTokenId,
		groupingMode: MINION_GROUPING_MODE_NCS,
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
	renderGroupAttackPanel();
}

function syncNcswPanel(context: SelectionContext): void {
	const canUsePanel =
		Boolean(game.user?.isGM) &&
		Boolean(canvas?.ready) &&
		context.selectedTokenCount > 0 &&
		Boolean(context.combat);
	if (!canUsePanel || !context.combat) {
		hideGroupAttackPanel();
		return;
	}

	const nonMinionRows = getSelectedNonMinionAttackMembers(context);
	const nonMinionSyncContext: MinionGroupAttackSessionContext = {
		combatId: context.combat.id ?? '',
		groupId: NCS_SELECTION_MONSTER_ATTACK_SCOPE_ID,
		memberCombatantIds: nonMinionRows.map((row) => row.member.combatantId),
		targetTokenId: getCurrentTargetSummary().targetTokenId,
		groupingMode: MINION_GROUPING_MODE_NCS,
		isTemporaryGroup: true,
	};
	const syncedNonMinionRows = buildNonMinionSelectionSync(
		nonMinionSyncContext,
		nonMinionRows,
		activeNonMinionAttackSelectionsByMemberId,
	);
	activeNonMinionAttackMembers = syncedNonMinionRows.nextMembers;
	activeNonMinionAttackSelectionsByMemberId = syncedNonMinionRows.nextSelectionsByMemberId;

	const selectedGroup = context.attackableGroupSummaries.find(
		(summary) => summary.groupId === NCS_SELECTION_ATTACK_GROUP_ID,
	);
	const minionMemberRows = selectedGroup
		? getGroupAttackMembers(context.combat, NCS_SELECTION_ATTACK_GROUP_ID, context)
		: [];
	const hasMinionSession = minionMemberRows.length >= 1;
	if (hasMinionSession) {
		const sessionContext: MinionGroupAttackSessionContext = {
			combatId: context.combat.id ?? '',
			groupId: NCS_SELECTION_ATTACK_GROUP_ID,
			memberCombatantIds: minionMemberRows.map((row) => row.member.combatantId),
			targetTokenId: getCurrentTargetSummary().targetTokenId,
			groupingMode: MINION_GROUPING_MODE_NCS,
			isTemporaryGroup: true,
		};
		const syncedSession = buildSessionSyncForMembers(
			sessionContext,
			minionMemberRows,
			activeGroupAttackSession,
		);
		activeGroupAttackSession = syncedSession.nextSession;
		activeGroupAttackMembers = syncedSession.nextMembers;
	} else {
		activeGroupAttackSession = null;
		activeGroupAttackMembers = [];
	}
	activeGroupAttackWarnings = [];

	if (activeNonMinionAttackMembers.length === 0 && !hasMinionSession) {
		hideGroupAttackPanel();
		return;
	}

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
			const isSelectionAttackGroup = groupSummary.groupId === NCS_SELECTION_ATTACK_GROUP_ID;
			const groupLabel = formatGroupDisplayLabel(groupSummary.label);
			descriptors.push({
				kind: 'attack',
				groupId: isSelectionAttackGroup ? undefined : groupSummary.groupId,
				groupLabel: isSelectionAttackGroup ? undefined : groupLabel,
				compactLabel: isSelectionAttackGroup ? String(groupSummary.selectedCount) : groupLabel,
				tooltip: isSelectionAttackGroup
					? formatMinionGroupAction('tooltips.openAttackForSelected', {
							count: groupSummary.selectedCount,
						})
					: formatMinionGroupAction('tooltips.openGroupAttack', {
							groupLabel,
						}),
			});
		}
	}

	if (context.canCreateGroup) {
		const groupCount = context.selectedUngroupedAliveMinionCountForActions;
		descriptors.push({
			kind: 'create',
			compactLabel: String(groupCount),
			tooltip: formatMinionGroupAction('tooltips.groupMinions', { count: groupCount }),
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
				tooltip: formatMinionGroupAction('tooltips.addToGroup', { count: groupCount, groupLabel }),
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
			tooltip: formatMinionGroupAction('tooltips.removeFromGroup', {
				count: groupSummary.selectedCount,
				groupLabel,
			}),
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
			tooltip: formatMinionGroupAction('tooltips.dissolveGroup', { groupLabel }),
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
	handle.title = localizeMinionGroupAction('tooltips.dragCornerToResize');
	handle.addEventListener('pointerdown', (event) => handleResizeHandlePointerDown(event, corner));
	return handle;
}

function renderActionBar(context: SelectionContext): void {
	const actionBar = ensureActionBarElement();
	if (shouldUseNcsTemporaryGroups()) {
		actionBar.hidden = true;
		actionBar.replaceChildren();
		syncNcswPanel(context);
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
		if (!stillSelected || !shouldUseNcsTemporaryGroups()) {
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
	dragHandle.title = localizeMinionGroupAction('tooltips.dragToMove');
	dragHandle.addEventListener('pointerdown', handleDragHandlePointerDown);
	const headerTitle = document.createElement('span');
	headerTitle.className = 'nimble-minion-group-actions__title';
	headerTitle.textContent = localizeMinionGroupAction('title');
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
		busyBadge.title = localizeMinionGroupAction('working');
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
			openGroupAttackPanel(context, action.groupId ?? NCS_SELECTION_ATTACK_GROUP_ID);
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
			ui.notifications?.error(localizeNcsw('notifications.couldNotOpenPanel'));
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
		ui.notifications?.error(localizeMinionGroupAction('notifications.groupingActionFailed'));
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
	if (groupAttackTargetPopoverElement?.parentElement) {
		groupAttackTargetPopoverElement.parentElement.removeChild(groupAttackTargetPopoverElement);
	}
	if (groupAttackActionDescriptionPopoverElement?.parentElement) {
		groupAttackActionDescriptionPopoverElement.parentElement.removeChild(
			groupAttackActionDescriptionPopoverElement,
		);
	}
	if (groupAttackImagePopoverElement?.parentElement) {
		groupAttackImagePopoverElement.parentElement.removeChild(groupAttackImagePopoverElement);
	}
	clearGroupAttackTargetPopoverRefreshInterval();
	minionGroupActionBarElement = null;
	minionGroupAttackPanelElement = null;
	groupAttackTargetPopoverElement = null;
	groupAttackActionDescriptionPopoverElement = null;
	groupAttackImagePopoverElement = null;
	didRegisterMinionGroupTokenActions = false;
	isExecutingAction = false;
	refreshScheduled = false;
	activeGroupAttackSession = null;
	activeGroupAttackMembers = [];
	activeGroupAttackWarnings = [];
	groupAttackPanelPosition = null;
}

export default function registerMinionGroupTokenActions(): void {
	if (didRegisterMinionGroupTokenActions) return;
	didRegisterMinionGroupTokenActions = true;
	(globalThis as Record<string, unknown>).__nimbleMinionGroupTokenActionsRegistered = true;
	logTokenUi('registerMinionGroupTokenActions invoked');
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
