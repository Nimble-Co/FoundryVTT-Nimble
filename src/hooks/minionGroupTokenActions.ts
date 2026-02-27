import { isCombatantDead } from '../utils/isCombatantDead.js';
import {
	getEffectiveMinionGroupLeader,
	getMinionGroupSummaries,
	isMinionCombatant,
	isMinionGroupTemporary,
} from '../utils/minionGrouping.js';
import {
	createMinionGroupAttackSelectionState,
	deriveDefaultMemberActionSelection,
	rememberMemberActionSelection,
	type MinionGroupAttackOption,
	type MinionGroupAttackSessionContext,
	type MinionGroupAttackSelectionState,
} from '../utils/minionGroupAttackSession.js';
import {
	flattenActivationEffects,
	getUnsupportedActivationEffectTypes,
} from '../utils/activationEffects.js';
import { getCombatantImage } from '../utils/combatantImage.js';

const NCSW_PANEL_ID = 'nimble-minion-group-attack-panel';
const MINION_GROUP_TOKEN_UI_DEBUG_ENABLED_KEY = 'NIMBLE_ENABLE_GROUP_TOKEN_UI_LOGS';
const MINION_GROUP_TOKEN_UI_DEBUG_DISABLED_KEY = 'NIMBLE_DISABLE_GROUP_TOKEN_UI_LOGS';
const NCSW_PANEL_VIEWPORT_MARGIN_PX = 8;
// Temporary NCSW UI overrides for fast revert.
const NCSW_TEMP_HIDE_DELETE_COMBATANT_BUTTON = true;
const NCSW_TEMP_SHOW_SELECTED_ACTION_TOOLTIP_ON_DICE = true;
const NCSW_PANEL_TARGET_CHIP_SIZE_REM = 4.2;
const NCSW_PANEL_TARGET_CHIP_GAP_REM = 0.3;
const NCSW_PANEL_TARGETS_PER_ROW = 4;
const NCSW_PANEL_TARGET_LABEL_WIDTH_REM = 4;
const NCSW_PANEL_TARGET_ROW_GAP_REM = 0.34;
const NCSW_PANEL_TARGET_ROW_HORIZONTAL_PADDING_REM = 0.52;
const NCSW_PANEL_LOCKED_WIDTH_REM =
	NCSW_PANEL_TARGET_LABEL_WIDTH_REM +
	NCSW_PANEL_TARGET_ROW_GAP_REM +
	NCSW_PANEL_TARGET_CHIP_SIZE_REM * NCSW_PANEL_TARGETS_PER_ROW +
	NCSW_PANEL_TARGET_CHIP_GAP_REM * (NCSW_PANEL_TARGETS_PER_ROW - 1) +
	NCSW_PANEL_TARGET_ROW_HORIZONTAL_PADDING_REM;
const NCSW_PANEL_MIN_WIDTH_REM = NCSW_PANEL_LOCKED_WIDTH_REM;
const NCSW_LOGO_PATH = '/systems/nimble/ncsw/logos/NimbleLogos.png';
const NCSW_I18N_PREFIX = 'NIMBLE.nimbleCombatSystemWindow';
const NCS_AW_WINDOW_ID = 'nimble-minion-group-action-window';
const NCS_AW_SECTION_LIMIT_BEFORE_SCROLL = 6;
const NCS_AW_REFRESH_DEBOUNCE_MS = 100;

export type NcswSidebarViewMode = 'combatTracker' | 'ncs';

let didRegisterMinionGroupTokenActions = false;
let refreshScheduled = false;
let isExecutingAction = false;
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
let actionWindowElement: HTMLDivElement | null = null;
let actionWindowPointerMoveHandler: ((event: PointerEvent) => void) | null = null;
let actionWindowRefreshHandle: ReturnType<typeof setTimeout> | null = null;
let pendingActionWindowContext: SelectionContext | null = null;
let actionWindowLastPointerPosition: { x: number; y: number } | null = null;
let actionWindowLastSelectionSignature = '';
let actionWindowSuppressedSelectionSignature: string | null = null;
const actionWindowDraftSelectionsBySectionKey = new Map<string, string | null>();
const rememberedGroupAttackSelectionsByActorType = new Map<string, string>();
const expandedMemberCombatantIds = new Set<string>();
let ncswDockHostElement: HTMLElement | null = null;
let ncswSidebarViewMode: NcswSidebarViewMode = 'combatTracker';

type HookRegistration = { hook: string; id: number };
let hookIds: HookRegistration[] = [];

type NcswMapSelectorType = 'players' | 'monsters' | 'minions';
const ncswMapSelectorState: Record<NcswMapSelectorType, boolean> = {
	players: true,
	monsters: true,
	minions: true,
};
const ncswTokenSelectionBypassTokenIds = new Set<string>();

type CombatWithGrouping = Combat & {
	performMinionGroupAttack?: (params: {
		memberCombatantIds: string[];
		targetTokenIds?: string[];
		selections: Array<{ memberCombatantId: string; actionId: string | null }>;
		endTurn?: boolean;
	}) => Promise<{
		targetTokenId: string;
		rolledCombatantIds: string[];
		skippedMembers: Array<{ combatantId: string; reason: string }>;
		unsupportedSelectionWarnings: string[];
		endTurnApplied: boolean;
	}>;
};
type CombatWithGroupAttack = CombatWithGrouping & {
	performMinionGroupAttack: NonNullable<CombatWithGrouping['performMinionGroupAttack']>;
};

interface SelectionContext {
	combat: CombatWithGrouping | null;
	allAliveNonMinionMonsters: Combatant.Implementation[];
	allAliveMinionCombatantIds: string[];
	selectedAliveNonMinionMonsterIds: string[];
	selectedAliveMinionCombatantIds: string[];
}

interface GroupAttackMemberView {
	combatantId: string;
	combatantName: string;
	memberImage: string;
	tokenId: string | null;
	stackSize: number;
	stackMemberCombatantIds: string[];
	isSelected: boolean;
	isDefeated: boolean;
	canToggleSelection: boolean;
	canPanToToken: boolean;
	canOpenSheet: boolean;
	canPingToken: boolean;
	canMarkDefeated: boolean;
	canDeleteCombatant: boolean;
	actorType: string;
	actionsRemaining: number;
	actionOptions: MinionGroupAttackOption[];
}

interface GroupAttackSessionSyncResult {
	nextSession: MinionGroupAttackSelectionState;
	nextMembers: GroupAttackMemberView[];
}

interface MemberAccordionData {
	actions: Array<{
		actionId: string;
		label: string;
		description: string;
		image: string;
		isSelected: boolean;
	}>;
}

type ActionWindowMemberType = 'monster' | 'minion';

interface ActionWindowMemberRef {
	combatantId: string;
	memberType: ActionWindowMemberType;
}

interface ActionWindowOptionView {
	actionId: string;
	label: string;
	description: string | null;
}

interface ActionWindowSectionView {
	sectionKey: string;
	sectionName: string;
	memberType: ActionWindowMemberType;
	memberRefs: ActionWindowMemberRef[];
	options: ActionWindowOptionView[];
}

interface ActionWindowSectionAccumulator {
	sectionKey: string;
	sectionName: string;
	memberType: ActionWindowMemberType;
	memberRefs: ActionWindowMemberRef[];
	optionsById: Map<string, ActionWindowOptionView>;
}

interface MonsterFeatureActionItemLike {
	id?: string;
	name?: string;
	img?: string;
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
	testUserPermission?: (user: User | null | undefined, permission: string) => boolean;
	sheet?: { render: (force?: boolean) => unknown };
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

function isNcswSidebarModeActive(): boolean {
	return ncswSidebarViewMode === 'ncs';
}

function isNcswDockedRendering(): boolean {
	return isNcswSidebarModeActive() && Boolean(ncswDockHostElement);
}

function getGroupAttackPanelMountRoot(): HTMLElement {
	if (isNcswDockedRendering() && ncswDockHostElement) {
		return ncswDockHostElement;
	}
	return document.body;
}

function syncGroupAttackPanelMountRoot(): void {
	if (!minionGroupAttackPanelElement) return;
	const mountRoot = getGroupAttackPanelMountRoot();
	if (minionGroupAttackPanelElement.parentElement !== mountRoot) {
		mountRoot.append(minionGroupAttackPanelElement);
	}
	minionGroupAttackPanelElement.classList.toggle(
		'nimble-minion-group-attack-panel--docked',
		isNcswDockedRendering(),
	);
}

export function getNcswSidebarViewMode(): NcswSidebarViewMode {
	return ncswSidebarViewMode;
}

export function setNcswSidebarViewMode(mode: NcswSidebarViewMode): void {
	if (ncswSidebarViewMode === mode) return;
	ncswSidebarViewMode = mode;
	hideActionWindow({ clearDraft: true });
	syncGroupAttackPanelMountRoot();
	if (didRegisterMinionGroupTokenActions) {
		scheduleActionBarRefresh('setNcswSidebarViewMode');
	}
}

export function setNcswDockHostElement(host: HTMLElement | null): void {
	if (ncswDockHostElement === host) return;
	ncswDockHostElement = host;
	syncGroupAttackPanelMountRoot();
	if (didRegisterMinionGroupTokenActions) {
		scheduleActionBarRefresh('setNcswDockHostElement');
	}
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

function buildCombatantsByTokenId(params: {
	combat: CombatWithGrouping | null;
	sceneId: string | null | undefined;
}): Map<string, Combatant.Implementation> {
	const combatantsByTokenId = new Map<string, Combatant.Implementation>();
	if (!params.combat || !params.sceneId) return combatantsByTokenId;

	for (const combatant of params.combat.combatants.contents) {
		if (getCombatantSceneId(combatant) !== params.sceneId) continue;
		const tokenId = combatant.tokenId?.trim() ?? '';
		if (!tokenId || combatantsByTokenId.has(tokenId)) continue;
		combatantsByTokenId.set(tokenId, combatant);
	}
	return combatantsByTokenId;
}

function getCombatantsForCurrentScene(combat: CombatWithGrouping | null): Combatant.Implementation[] {
	const sceneId = canvas.scene?.id;
	if (!combat || !sceneId) return [];
	return combat.combatants.contents.filter((combatant) => getCombatantSceneId(combatant) === sceneId);
}

function getActorTypeFromToken(token: Token): string {
	return (token.actor?.type ?? token.document?.actor?.type ?? '').trim().toLowerCase();
}

function getCombatantForToken(token: Token): Combatant.Implementation | null {
	const combat = getCombatForCurrentScene();
	if (!combat) return null;
	const tokenId = getTargetTokenId(token);
	if (!tokenId) return null;
	const sceneId = canvas.scene?.id;
	return (
		combat.combatants.contents.find(
			(combatant) =>
				getCombatantSceneId(combatant) === sceneId && (combatant.tokenId?.trim() ?? '') === tokenId,
		) ?? null
	);
}

function resolveMapTokenSelectionType(token: Token): NcswMapSelectorType {
	const actorType = getActorTypeFromToken(token);
	if (actorType === 'character') return 'players';
	if (actorType === 'minion') return 'minions';

	const combatant = getCombatantForToken(token);
	if (combatant?.type === 'character') return 'players';
	if (combatant && isMinionCombatant(combatant)) return 'minions';
	return 'monsters';
}

function isMapTokenSelectionAllowed(token: Token): boolean {
	const selectorType = resolveMapTokenSelectionType(token);
	return ncswMapSelectorState[selectorType];
}

function markNcswTokenSelectionBypass(token: Token | null | undefined): void {
	const tokenId = token ? getTargetTokenId(token) : '';
	if (!tokenId) return;
	ncswTokenSelectionBypassTokenIds.add(tokenId);
	setTimeout(() => {
		ncswTokenSelectionBypassTokenIds.delete(tokenId);
	}, 0);
}

function consumeNcswTokenSelectionBypass(token: Token | null | undefined): boolean {
	const tokenId = token ? getTargetTokenId(token) : '';
	if (!tokenId || !ncswTokenSelectionBypassTokenIds.has(tokenId)) return false;
	ncswTokenSelectionBypassTokenIds.delete(tokenId);
	return true;
}

function controlTokenFromPanel(
	token: Token,
	options: { releaseOthers?: boolean } = { releaseOthers: false },
): void {
	markNcswTokenSelectionBypass(token);
	token.control(options);
}

function enforceMapTokenSelectionFilter(): void {
	const controlledTokens = [...((canvas?.tokens?.controlled ?? []) as Token[])];
	for (const controlledToken of controlledTokens) {
		if (consumeNcswTokenSelectionBypass(controlledToken)) continue;
		if (isMapTokenSelectionAllowed(controlledToken)) continue;
		controlledToken.release();
	}
}

function resolveTokenFromControlHookPayload(tokenLike: unknown): Token | null {
	const directToken = tokenLike as Token | null;
	if (
		directToken &&
		typeof directToken.control === 'function' &&
		typeof directToken.release === 'function'
	) {
		return directToken;
	}

	const tokenObject = (tokenLike as { object?: Token | null } | null)?.object ?? null;
	if (!tokenObject) return null;
	if (typeof tokenObject.control !== 'function' || typeof tokenObject.release !== 'function') return null;
	return tokenObject;
}

function handleControlTokenHook(tokenLike: unknown, controlledLike: unknown): void {
	const token = resolveTokenFromControlHookPayload(tokenLike);
	if (!token) {
		scheduleActionBarRefresh('controlToken');
		return;
	}

	const isControlled = controlledLike === true;
	if (!isControlled) {
		scheduleActionBarRefresh('controlToken-release');
		return;
	}

	if (consumeNcswTokenSelectionBypass(token)) {
		scheduleActionBarRefresh('controlToken-ncsw-bypass');
		return;
	}

	if (!isMapTokenSelectionAllowed(token)) {
		token.release();
		scheduleActionBarRefresh('controlToken-filtered');
		return;
	}

	scheduleActionBarRefresh('controlToken');
}

function getSelectedActionWindowMemberRefs(): ActionWindowMemberRef[] {
	const refs: ActionWindowMemberRef[] = [];

	for (const member of activeNonMinionAttackMembers) {
		if (!member.isSelected) continue;
		if (member.actionsRemaining < 1) continue;
		refs.push({ combatantId: member.combatantId, memberType: 'monster' });
	}

	for (const member of activeGroupAttackMembers) {
		if (!member.isSelected) continue;
		if (member.actionsRemaining < 1) continue;
		refs.push({ combatantId: member.combatantId, memberType: 'minion' });
	}

	return refs;
}

function getMemberViewForActionWindowRef(ref: ActionWindowMemberRef): GroupAttackMemberView | null {
	if (ref.memberType === 'monster') {
		return activeNonMinionAttackMembers.find((member) => member.combatantId === ref.combatantId) ?? null;
	}
	return activeGroupAttackMembers.find((member) => member.combatantId === ref.combatantId) ?? null;
}

function getSupportedActionOptionsForMember(member: GroupAttackMemberView): ActionWindowOptionView[] {
	return member.actionOptions
		.filter((option) => option.unsupportedReasons.length < 1)
		.map((option) => ({
			actionId: option.actionId,
			label: option.label,
			description: option.description ?? null,
		}));
}

function buildActionWindowSectionIdentity(
	ref: ActionWindowMemberRef,
	member: GroupAttackMemberView,
): { sectionKey: string; sectionName: string } {
	const combatant = resolveCombatantForPanelRow(ref.combatantId);
	const actorId = combatant?.actor?.id?.trim() ?? '';
	const actorName =
		combatant?.actor?.name?.trim() ?? combatant?.name?.trim() ?? member.combatantName.trim();
	const fallbackName = actorName.length > 0 ? actorName : member.combatantName;
	const fallbackKey = fallbackName.trim().toLowerCase();
	return {
		sectionKey: actorId ? `${ref.memberType}:${actorId}` : `${ref.memberType}:${fallbackKey}`,
		sectionName: fallbackName,
	};
}

function intersectActionWindowOptions(
	existing: Map<string, ActionWindowOptionView>,
	nextOptions: ActionWindowOptionView[],
): void {
	const nextIds = new Set(nextOptions.map((option) => option.actionId));
	for (const existingId of [...existing.keys()]) {
		if (nextIds.has(existingId)) continue;
		existing.delete(existingId);
	}
}

function buildActionWindowSections(): ActionWindowSectionView[] {
	const sectionMap = new Map<string, ActionWindowSectionAccumulator>();
	for (const ref of getSelectedActionWindowMemberRefs()) {
		const member = getMemberViewForActionWindowRef(ref);
		if (!member) continue;

		const supportedOptions = getSupportedActionOptionsForMember(member);
		if (supportedOptions.length < 1) continue;

		const sectionIdentity = buildActionWindowSectionIdentity(ref, member);
		const existingSection = sectionMap.get(sectionIdentity.sectionKey);
		if (!existingSection) {
			sectionMap.set(sectionIdentity.sectionKey, {
				sectionKey: sectionIdentity.sectionKey,
				sectionName: sectionIdentity.sectionName,
				memberType: ref.memberType,
				memberRefs: [{ combatantId: ref.combatantId, memberType: ref.memberType }],
				optionsById: new Map(
					supportedOptions.map((option) => [option.actionId, option] as const),
				),
			});
			continue;
		}

		existingSection.memberRefs.push({ combatantId: ref.combatantId, memberType: ref.memberType });
		intersectActionWindowOptions(existingSection.optionsById, supportedOptions);
	}

	return [...sectionMap.values()]
		.map((section) => ({
			sectionKey: section.sectionKey,
			sectionName: section.sectionName,
			memberType: section.memberType,
			memberRefs: section.memberRefs,
			options: [...section.optionsById.values()].sort((left, right) =>
				left.label.localeCompare(right.label, undefined, { sensitivity: 'base' }),
			),
		}))
		.filter((section) => section.options.length > 1)
		.sort((left, right) => left.sectionName.localeCompare(right.sectionName, undefined, { sensitivity: 'base' }));
}

function getCurrentSelectedActionIdForMemberRef(ref: ActionWindowMemberRef): string {
	return ref.memberType === 'monster'
		? getNonMinionActionSelectValueForMember(ref.combatantId)
		: getActionSelectValueForMember(ref.combatantId);
}

function resolveInitialDraftSelectionForSection(section: ActionWindowSectionView): string | null {
	const validActionIds = new Set(section.options.map((option) => option.actionId));
	const selectedActionIds = new Set(
		section.memberRefs
			.map((ref) => getCurrentSelectedActionIdForMemberRef(ref).trim())
			.filter((actionId) => actionId.length > 0 && validActionIds.has(actionId)),
	);
	if (selectedActionIds.size !== 1) return null;
	return selectedActionIds.values().next().value ?? null;
}

function syncActionWindowDraftSelections(sections: ActionWindowSectionView[]): void {
	const availableSectionKeys = new Set(sections.map((section) => section.sectionKey));
	for (const sectionKey of [...actionWindowDraftSelectionsBySectionKey.keys()]) {
		if (availableSectionKeys.has(sectionKey)) continue;
		actionWindowDraftSelectionsBySectionKey.delete(sectionKey);
	}

	for (const section of sections) {
		const validActionIds = new Set(section.options.map((option) => option.actionId));
		const existingDraft = actionWindowDraftSelectionsBySectionKey.get(section.sectionKey) ?? null;
		if (existingDraft && validActionIds.has(existingDraft)) continue;
		const initialDraft = resolveInitialDraftSelectionForSection(section);
		actionWindowDraftSelectionsBySectionKey.set(section.sectionKey, initialDraft);
	}
}

function getActionWindowSelectionSignature(context: SelectionContext): string {
	const selectedTokenIds = [...new Set(
		[...activeNonMinionAttackMembers, ...activeGroupAttackMembers]
			.filter((member) => member.isSelected)
			.map((member) => member.tokenId?.trim() ?? '')
			.filter((tokenId) => tokenId.length > 0),
	)].sort();
	return `${context.combat?.id ?? 'none'}:${selectedTokenIds.join('|')}`;
}

function getActionWindowElement(): HTMLDivElement {
	if (actionWindowElement && document.body.contains(actionWindowElement)) {
		return actionWindowElement;
	}

	const element = document.createElement('div');
	element.id = NCS_AW_WINDOW_ID;
	element.className = 'nimble-minion-group-action-window';
	element.hidden = true;
	document.body.append(element);
	actionWindowElement = element;
	return element;
}

function clearActionWindowRefreshHandle(): void {
	if (!actionWindowRefreshHandle) return;
	clearTimeout(actionWindowRefreshHandle);
	actionWindowRefreshHandle = null;
}

function hideActionWindow(options: { clearDraft?: boolean } = {}): void {
	clearActionWindowRefreshHandle();
	pendingActionWindowContext = null;
	if (actionWindowElement) {
		actionWindowElement.hidden = true;
		actionWindowElement.replaceChildren();
	}
	if (options.clearDraft ?? false) {
		actionWindowDraftSelectionsBySectionKey.clear();
	}
}

function positionActionWindowNearCursor(element: HTMLDivElement): void {
	const margin = NCSW_PANEL_VIEWPORT_MARGIN_PX;
	const gap = 8;
	const rect = element.getBoundingClientRect();
	const panel = minionGroupAttackPanelElement;

	if (panel && !panel.hidden && panel.isConnected) {
		const panelRect = panel.getBoundingClientRect();
		let left = panelRect.right + gap;
		let top = panelRect.top;
		if (left + rect.width + margin > window.innerWidth) {
			left = panelRect.left - rect.width - gap;
		}
		left = Math.max(margin, Math.min(window.innerWidth - rect.width - margin, left));
		top = Math.max(margin, Math.min(window.innerHeight - rect.height - margin, top));
		element.style.left = `${Math.round(left)}px`;
		element.style.top = `${Math.round(top)}px`;
		return;
	}

	const offset = 14;
	const cursorX = actionWindowLastPointerPosition?.x ?? Math.round(window.innerWidth / 2);
	const cursorY = actionWindowLastPointerPosition?.y ?? Math.round(window.innerHeight / 2);
	let left = cursorX + offset;
	let top = cursorY + offset;
	if (left + rect.width + margin > window.innerWidth) {
		left = cursorX - rect.width - offset;
	}
	if (top + rect.height + margin > window.innerHeight) {
		top = cursorY - rect.height - offset;
	}
	left = Math.max(margin, Math.min(window.innerWidth - rect.width - margin, left));
	top = Math.max(margin, Math.min(window.innerHeight - rect.height - margin, top));
	element.style.left = `${Math.round(left)}px`;
	element.style.top = `${Math.round(top)}px`;
}

function setActionWindowDraftSelection(sectionKey: string, actionId: string): void {
	actionWindowDraftSelectionsBySectionKey.set(sectionKey, actionId);
	renderActionWindow(buildActionWindowSections(), { reposition: false });
}

function applyActionWindowSelectionsAtDoneTime(): void {
	const sections = buildActionWindowSections();
	for (const section of sections) {
		const draftSelection = actionWindowDraftSelectionsBySectionKey.get(section.sectionKey)?.trim() ?? '';
		if (!draftSelection) continue;
		if (!section.options.some((option) => option.actionId === draftSelection)) continue;

		for (const memberRef of section.memberRefs) {
			if (memberRef.memberType === 'monster') {
				setNonMinionActionSelectValueForMember(memberRef.combatantId, draftSelection);
				continue;
			}
			setActionSelectValueForMember(memberRef.combatantId, draftSelection);
		}
	}
}

function closeActionWindowForCurrentSelection(options: { clearDraft?: boolean } = {}): void {
	actionWindowSuppressedSelectionSignature = actionWindowLastSelectionSignature;
	hideActionWindow({ clearDraft: options.clearDraft ?? true });
}

function buildActionWindowSectionHeader(section: ActionWindowSectionView): string {
	return `${section.sectionName} (${section.memberRefs.length})`;
}

function renderActionWindow(
	sections: ActionWindowSectionView[],
	options: { reposition: boolean },
): void {
	const element = getActionWindowElement();
	element.replaceChildren();
	element.hidden = false;
	element.style.setProperty('--nimble-ncs-aw-section-max', String(NCS_AW_SECTION_LIMIT_BEFORE_SCROLL));

	const title = document.createElement('h4');
	title.className = 'nimble-minion-group-action-window__title';
	title.textContent = localizeNcsw('actionWindow.title');

	const sectionList = document.createElement('div');
	sectionList.className = 'nimble-minion-group-action-window__sections';

	for (const section of sections) {
		const sectionElement = document.createElement('section');
		sectionElement.className = 'nimble-minion-group-action-window__section';

		const sectionHeader = document.createElement('h5');
		sectionHeader.className = 'nimble-minion-group-action-window__section-title';
		sectionHeader.textContent = buildActionWindowSectionHeader(section);

		const sectionOptions = document.createElement('div');
		sectionOptions.className = 'nimble-minion-group-action-window__section-options';
		const selectedActionId = actionWindowDraftSelectionsBySectionKey.get(section.sectionKey) ?? null;
		for (const option of section.options) {
			const optionRow = document.createElement('div');
			optionRow.className = 'nimble-minion-group-action-window__option-row';

			const toggleButton = document.createElement('button');
			toggleButton.type = 'button';
			toggleButton.className = 'nimble-minion-group-action-window__option-toggle';
			const isSelected = selectedActionId === option.actionId;
			if (isSelected) {
				toggleButton.classList.add('nimble-minion-group-action-window__option-toggle--active');
			}
			toggleButton.ariaPressed = isSelected ? 'true' : 'false';
			toggleButton.title = option.label;
			toggleButton.ariaLabel = formatNcsw('actionWindow.selectActionAria', {
				action: option.label,
				name: section.sectionName,
			});
			toggleButton.textContent = option.label;
			toggleButton.addEventListener('click', (event) => {
				event.preventDefault();
				event.stopPropagation();
				setActionWindowDraftSelection(section.sectionKey, option.actionId);
			});

			const optionContent = document.createElement('span');
			optionContent.className = 'nimble-minion-group-action-window__option-content';

			const optionDescription = document.createElement('span');
			optionDescription.className = 'nimble-minion-group-action-window__option-description';
			optionDescription.textContent =
				option.description?.trim() ?? localizeNcsw('actionWindow.noDescription');

			optionContent.append(optionDescription);
			optionRow.append(toggleButton, optionContent);
			sectionOptions.append(optionRow);
		}

		sectionElement.append(sectionHeader, sectionOptions);
		sectionList.append(sectionElement);
	}

	const actionButtons = document.createElement('div');
	actionButtons.className = 'nimble-minion-group-action-window__buttons';

	const doneButton = document.createElement('button');
	doneButton.type = 'button';
	doneButton.className =
		'nimble-minion-group-action-window__button nimble-minion-group-action-window__button--positive';
	doneButton.textContent = localizeNcsw('buttons.done');
	doneButton.disabled = isExecutingAction;
	doneButton.addEventListener('click', (event) => {
		event.preventDefault();
		event.stopPropagation();
		applyActionWindowSelectionsAtDoneTime();
		closeActionWindowForCurrentSelection({ clearDraft: true });
		renderGroupAttackPanel();
		scheduleActionBarRefresh('action-window-done');
	});

	const closeButton = document.createElement('button');
	closeButton.type = 'button';
	closeButton.className =
		'nimble-minion-group-action-window__button nimble-minion-group-action-window__button--negative';
	closeButton.textContent = localizeNcsw('buttons.close');
	closeButton.disabled = isExecutingAction;
	closeButton.addEventListener('click', (event) => {
		event.preventDefault();
		event.stopPropagation();
		closeActionWindowForCurrentSelection({ clearDraft: true });
		scheduleActionBarRefresh('action-window-close');
	});

	actionButtons.append(doneButton, closeButton);
	element.append(title, sectionList, actionButtons);

	queueMicrotask(() => {
		if (!options.reposition) return;
		positionActionWindowNearCursor(element);
	});
}

function syncActionWindow(context: SelectionContext | null): void {
	if (!context || !canUseNcswPanel(context) || !context.combat) {
		actionWindowSuppressedSelectionSignature = null;
		actionWindowLastSelectionSignature = '';
		hideActionWindow({ clearDraft: true });
		return;
	}

	const selectionSignature = getActionWindowSelectionSignature(context);
	const selectionChanged = selectionSignature !== actionWindowLastSelectionSignature;
	actionWindowLastSelectionSignature = selectionSignature;
	if (selectionChanged && actionWindowSuppressedSelectionSignature !== selectionSignature) {
		actionWindowSuppressedSelectionSignature = null;
	}

	const sections = buildActionWindowSections();
	syncActionWindowDraftSelections(sections);
	if (sections.length < 1) {
		hideActionWindow({ clearDraft: true });
		return;
	}

	if (actionWindowSuppressedSelectionSignature === selectionSignature) {
		hideActionWindow({ clearDraft: false });
		return;
	}

	renderActionWindow(sections, {
		reposition: selectionChanged || actionWindowElement?.hidden !== false,
	});
}

function scheduleActionWindowRefresh(context: SelectionContext | null): void {
	pendingActionWindowContext = context;
	clearActionWindowRefreshHandle();
	actionWindowRefreshHandle = setTimeout(() => {
		actionWindowRefreshHandle = null;
		const nextContext = pendingActionWindowContext;
		pendingActionWindowContext = null;
		syncActionWindow(nextContext);
	}, NCS_AW_REFRESH_DEBOUNCE_MS);
}

function resolveSelectedCombatants(
	selectedTokens: Token[],
	combatantsByTokenId: ReadonlyMap<string, Combatant.Implementation>,
): Combatant.Implementation[] {
	const selectedCombatants: Combatant.Implementation[] = [];
	const seenCombatantIds = new Set<string>();
	for (const token of selectedTokens) {
		const tokenId = (token.document?.id ?? token.id ?? '').trim();
		if (!tokenId) continue;

		const combatant = combatantsByTokenId.get(tokenId);
		const combatantId = combatant?.id ?? '';
		if (!combatant || !combatantId || seenCombatantIds.has(combatantId)) continue;
		seenCombatantIds.add(combatantId);
		selectedCombatants.push(combatant);
	}
	return selectedCombatants;
}

function resolveNonPlayerCombatants(combatants: Combatant.Implementation[]): Combatant.Implementation[] {
	return combatants.filter((combatant) => combatant.type !== 'character');
}

function resolveSelectedAliveNonPlayerCombatants(
	selectedCombatants: Combatant.Implementation[],
): Combatant.Implementation[] {
	return selectedCombatants.filter(
		(combatant) => combatant.type !== 'character' && !isCombatantDead(combatant),
	);
}

function resolveAliveNonMinionMonsters(
	nonPlayerCombatants: Combatant.Implementation[],
): Combatant.Implementation[] {
	return nonPlayerCombatants.filter(
		(combatant) => !isMinionCombatant(combatant) && !isCombatantDead(combatant),
	);
}

function resolveAliveMinionCombatantIds(nonPlayerCombatants: Combatant.Implementation[]): string[] {
	const alphabeticalAliveMinions = nonPlayerCombatants
		.filter((combatant) => isMinionCombatant(combatant) && !isCombatantDead(combatant))
		.sort((left, right) =>
			compareNamesAlphabetically(getCombatantDisplayName(left), getCombatantDisplayName(right)),
		);

	return [
		...new Set(
			alphabeticalAliveMinions
				.map((combatant) => combatant.id)
				.filter((combatantId): combatantId is string => typeof combatantId === 'string'),
		),
	];
}

function resolveSelectedAliveNonMinionMonsterIds(
	selectedAliveNonPlayerCombatants: Combatant.Implementation[],
): string[] {
	return [
		...new Set(
			selectedAliveNonPlayerCombatants
				.filter((combatant) => {
					const actorType = (combatant.actor?.type ?? '').trim().toLowerCase();
					const combatantType = (combatant.type ?? '').trim().toLowerCase();
					return actorType !== 'minion' && combatantType !== 'minion';
				})
				.map((combatant) => combatant.id)
				.filter((combatantId): combatantId is string => typeof combatantId === 'string'),
		),
	];
}

function resolveSelectedAliveMinionCombatantIds(
	selectedAliveNonPlayerCombatants: Combatant.Implementation[],
): string[] {
	return [
		...new Set(
			selectedAliveNonPlayerCombatants
				.filter((combatant) => isMinionCombatant(combatant))
				.map((combatant) => combatant.id)
				.filter((combatantId): combatantId is string => typeof combatantId === 'string'),
		),
	];
}

function buildSelectionContext(): SelectionContext {
	const combat = getCombatForCurrentScene();
	const sceneNonPlayerCombatants = resolveNonPlayerCombatants(getCombatantsForCurrentScene(combat));
	const selectedTokens = (canvas?.tokens?.controlled ?? []) as Token[];
	const combatantsByTokenId = buildCombatantsByTokenId({
		combat,
		sceneId: canvas.scene?.id,
	});
	const selectedCombatants = resolveSelectedCombatants(selectedTokens, combatantsByTokenId);
	const selectedAliveNonPlayerCombatants =
		resolveSelectedAliveNonPlayerCombatants(selectedCombatants);

	return {
		combat,
		allAliveNonMinionMonsters: resolveAliveNonMinionMonsters(sceneNonPlayerCombatants),
		allAliveMinionCombatantIds: resolveAliveMinionCombatantIds(sceneNonPlayerCombatants),
		selectedAliveNonMinionMonsterIds: resolveSelectedAliveNonMinionMonsterIds(
			selectedAliveNonPlayerCombatants,
		),
		selectedAliveMinionCombatantIds: resolveSelectedAliveMinionCombatantIds(
			selectedAliveNonPlayerCombatants,
		),
	};
}

function normalizeDiceFaceArtifacts(formula: string): string {
	return formula.replace(/\b(\d*)d([0-9oO|Il]+)\b/g, (_match, rawCount, rawFaces) => {
		const countValue = String(rawCount ?? '').replace(/[^0-9]/g, '');
		const facesValue = String(rawFaces ?? '')
			.replace(/[oO]/g, '0')
			.replace(/[^0-9]/g, '');
		const normalizedCount = countValue.length > 0 ? countValue : '1';
		const normalizedFaces = facesValue.length > 0 ? facesValue : '0';
		return `${normalizedCount}d${normalizedFaces}`;
	});
}

function getUnsupportedActionEffectTypes(item: MonsterFeatureActionItemLike): string[] {
	return getUnsupportedActivationEffectTypes(item.system?.activation?.effects);
}

function getActionRollFormulaLabel(item: MonsterFeatureActionItemLike): string | null {
	const effects = item.system?.activation?.effects;
	const flattened = flattenActivationEffects(effects);
	if (flattened.length === 0) return null;

	const normalizeFormulaForDisplay = (formula: string): string | null => {
		const normalized = normalizeDiceFaceArtifacts(formula.replace(/\s+/g, ' ').trim());
		if (!normalized) return null;

		// Prefer the first alternate when formulas include free-text separators (e.g. "1d10, OR 2d6").
		const firstSegment =
			normalized
				.split(/\s*(?:,|;|\bor\b)\s*/i)
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

function getMemberSelectedActionId(member: GroupAttackMemberView): string {
	const isMonsterMember = activeNonMinionAttackMembers.some(
		(candidate) => candidate.combatantId === member.combatantId,
	);
	return isMonsterMember
		? getNonMinionActionSelectValueForMember(member.combatantId)
		: getActionSelectValueForMember(member.combatantId);
}

function setMemberSelectedActionId(member: GroupAttackMemberView, actionId: string | null): void {
	const isMonsterMember = activeNonMinionAttackMembers.some(
		(candidate) => candidate.combatantId === member.combatantId,
	);
	if (isMonsterMember) {
		setNonMinionActionSelectValueForMember(member.combatantId, actionId);
		return;
	}
	setActionSelectValueForMember(member.combatantId, actionId);
}

function getActionImageForItem(item: MonsterFeatureActionItemLike | null | undefined): string {
	if (!item || typeof item !== 'object') return 'icons/svg/d20-grey.svg';
	const imagePath =
		(foundry.utils.getProperty(item, 'img') as string | null | undefined)?.trim() ?? '';
	if (imagePath.length > 0) return imagePath;
	return 'icons/svg/d20-grey.svg';
}

function buildMemberAccordionData(member: GroupAttackMemberView): MemberAccordionData {
	const combatant = resolveCombatantForPanelRow(member.combatantId);
	const actor = (combatant?.actor as ActorWithActionItems | null) ?? null;
	const actionItemsById = new Map(
		getActorActionItems(actor).map((item) => [item.id ?? '', item] as const),
	);
	const selectedActionId = getMemberSelectedActionId(member).trim();
	const actions = member.actionOptions.map((actionOption) => {
		const sourceItem = actionItemsById.get(actionOption.actionId) ?? null;
		return {
			actionId: actionOption.actionId,
			label: actionOption.label,
			description:
				actionOption.description?.trim() ?? localizeNcsw('actionWindow.noDescription'),
			image: getActionImageForItem(sourceItem),
			isSelected: actionOption.actionId === selectedActionId,
		};
	});

	return {
		actions,
	};
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

function getCurrentUserTargetTokens(): Token[] {
	return Array.from(game.user?.targets ?? []) as Token[];
}

function getTargetTokenId(target: Token): string {
	return (target?.id ?? target?.document?.id ?? '').trim();
}

function getUniqueTargetTokenIds(targets: Token[]): string[] {
	return [
		...new Set(targets.map((target) => getTargetTokenId(target)).filter((tokenId) => tokenId)),
	];
}

function resolveSingleTargetName(target: Token | undefined): string {
	const nameCandidates = [target?.name, target?.document?.name, target?.document?.actor?.name];
	for (const candidate of nameCandidates) {
		const normalized = candidate?.trim() ?? '';
		if (normalized) return normalized;
	}
	return 'Target';
}

function getCurrentTargetSummary(): {
	targetTokenId: string | null;
	targetTokenIds: string[];
	targetName: string | null;
} {
	const selectedTargets = getCurrentUserTargetTokens();
	const targetTokenIds = getUniqueTargetTokenIds(selectedTargets);
	const targetTokenId = targetTokenIds[0] ?? null;

	if (targetTokenIds.length !== 1) {
		return { targetTokenId, targetTokenIds, targetName: null };
	}

	return {
		targetTokenId,
		targetTokenIds,
		targetName: resolveSingleTargetName(selectedTargets[0]),
	};
}

interface TargetTokenView {
	combatantId: string;
	token: Token | null;
	tokenId: string;
	name: string;
	image: string;
	isTargeted: boolean;
	isSelected: boolean;
	canToggleTarget: boolean;
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

function getTargetCombatantVitalStats(combatant: Combatant.Implementation): {
	hpCurrent: number | null;
	hpMax: number | null;
	wounds: number;
} {
	const actor = combatant.actor ?? null;
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

function resolveCombatantPreviewName(
	combatant: Combatant.Implementation | null,
	fallbackName: string,
): string {
	return combatant?.name?.trim() || combatant?.token?.name?.trim() || fallbackName || 'Monster';
}

function resolveActorHpStats(actor: ActorWithActionItems | null): {
	hpCurrent: number | null;
	hpMax: number | null;
	hpPercent: number;
	isBloodied: boolean;
} {
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
		hpCurrent,
		hpMax,
		hpPercent,
		isBloodied,
	};
}

function getCombatantPreviewStats(
	combatantId: string,
	fallbackName: string,
): CombatantPreviewStats {
	const combat = getCombatForCurrentScene();
	const combatant = combat?.combatants.get(combatantId) ?? null;
	const tokenName = resolveCombatantPreviewName(combatant, fallbackName);
	const actor = (combatant?.actor as ActorWithActionItems | null) ?? null;
	const hpStats = resolveActorHpStats(actor);

	return {
		tokenName,
		hpCurrent: hpStats.hpCurrent,
		hpMax: hpStats.hpMax,
		hpPercent: hpStats.hpPercent,
		isBloodied: hpStats.isBloodied,
	};
}

function getCombatantRowImage(combatant: Combatant.Implementation): string {
	return (
		getCombatantImage(combatant, {
			includeActorImage: true,
			fallback: 'icons/svg/mystery-man.svg',
		}) ?? 'icons/svg/mystery-man.svg'
	);
}

function getCombatantTokenObject(combatant: Combatant.Implementation | null | undefined): Token | null {
	if (!combatant) return null;
	if (combatant.token?.object) return combatant.token.object as Token;
	const tokenId = combatant.tokenId?.trim() ?? '';
	if (!tokenId) return null;
	const canvasToken = canvas.tokens?.get(tokenId) as Token | null | undefined;
	return canvasToken ?? null;
}

function resolveTargetCombatantImage(
	combatant: Combatant.Implementation,
	token: Token | null,
): string {
	return (
		(
			token?.document?.texture?.src ??
			(foundry.utils.getProperty(combatant, 'token.texture.src') as string | null) ??
			combatant.img ??
			combatant.actor?.img ??
			''
		).trim() || 'icons/svg/mystery-man.svg'
	);
}

function resolveTargetCombatantName(
	combatant: Combatant.Implementation,
	token: Token | null,
): string {
	return (
		token?.document?.name?.trim() ||
		token?.name?.trim() ||
		combatant.token?.name?.trim() ||
		combatant.name?.trim() ||
		combatant.actor?.name?.trim() ||
		localizeNcsw('targets.playerFallback')
	);
}

function buildTargetTokenView(
	combatant: Combatant.Implementation,
	selectedTargetIds: ReadonlySet<string>,
	selectedControlledTokenIds: ReadonlySet<string>,
): TargetTokenView | null {
	if (combatant.type !== 'character') return null;
	const token = getCombatantTokenObject(combatant);
	const tokenId = token ? getTargetTokenId(token) : (combatant.tokenId?.trim() ?? '');
	if (!tokenId) return null;

	const vitalStats = getTargetCombatantVitalStats(combatant);
	return {
		combatantId: combatant.id ?? '',
		token,
		tokenId,
		name: resolveTargetCombatantName(combatant, token),
		image: resolveTargetCombatantImage(combatant, token),
		isTargeted: selectedTargetIds.has(tokenId),
		isSelected: selectedControlledTokenIds.has(tokenId),
		canToggleTarget: token !== null,
		hpCurrent: vitalStats.hpCurrent,
		hpMax: vitalStats.hpMax,
		wounds: vitalStats.wounds,
	};
}

function getAvailablePlayerTargetTokens(): TargetTokenView[] {
	const combat = getCombatForCurrentScene();
	const selectedControlledTokenIds = new Set(
		((canvas?.tokens?.controlled ?? []) as Token[])
			.map((token) => getTargetTokenId(token))
			.filter((tokenId) => tokenId.length > 0),
	);
	const selectedTargetIds = new Set(getUniqueTargetTokenIds(getCurrentUserTargetTokens()));
	return getCombatantsForCurrentScene(combat)
		.map((combatant) => buildTargetTokenView(combatant, selectedTargetIds, selectedControlledTokenIds))
		.filter((row): row is TargetTokenView => row !== null)
		.sort((left, right) => left.name.localeCompare(right.name, undefined, { sensitivity: 'base' }));
}

function toggleTargetTokenFromPanel(targetToken: TargetTokenView, targeted: boolean): void {
	if (!game.user) return;
	if (!targetToken.token) return;
	targetToken.token.setTarget(targeted, {
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

function clearControlledTokensForCombatantIds(combatantIds: string[]): void {
	const seenTokenIds = new Set<string>();
	for (const combatantId of combatantIds) {
		const normalizedCombatantId = combatantId?.trim() ?? '';
		if (!normalizedCombatantId) continue;

		const combatant = resolveCombatantForPanelRow(normalizedCombatantId);
		if (!combatant) continue;

		const token = getCombatantTokenObject(combatant);
		if (!token) continue;

		const tokenId = getTargetTokenId(token);
		if (!tokenId || seenTokenIds.has(tokenId)) continue;
		seenTokenIds.add(tokenId);

		if (!token.controlled) continue;
		token.release();
	}
}

function getRootFontSizePx(): number {
	const rootElement = document.documentElement;
	if (!rootElement) return 16;
	const parsed = Number.parseFloat(globalThis.getComputedStyle(rootElement).fontSize);
	return Number.isFinite(parsed) && parsed > 0 ? parsed : 16;
}

function applyGroupAttackPanelWidth(options: {
	panel: HTMLDivElement;
	targetRow: HTMLDivElement;
	targetLabel: HTMLSpanElement;
	targetList: HTMLDivElement;
}): void {
	const remPx = getRootFontSizePx();
	const desiredWidthPx = NCSW_PANEL_LOCKED_WIDTH_REM * remPx;
	const minWidthPx = NCSW_PANEL_MIN_WIDTH_REM * remPx;
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
	const selectedControlledTokenIds = new Set(
		((canvas?.tokens?.controlled ?? []) as Token[])
			.map((token) => getTargetTokenId(token))
			.filter((tokenId) => tokenId.length > 0),
	);
	const liveCombatant = resolveCombatantForPanelRow(targetToken.combatantId);
	const liveToken = getCombatantTokenObject(liveCombatant) ?? targetToken.token;
	const vitalStats = liveCombatant
		? getTargetCombatantVitalStats(liveCombatant)
		: {
				hpCurrent: targetToken.hpCurrent,
				hpMax: targetToken.hpMax,
				wounds: targetToken.wounds,
			};
	return {
		...targetToken,
		token: liveToken,
		isTargeted: selectedTargetIds.has(targetToken.tokenId),
		isSelected: selectedControlledTokenIds.has(targetToken.tokenId),
		canToggleTarget: liveToken !== null,
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
	if (minionGroupAttackPanelElement && minionGroupAttackPanelElement.isConnected) {
		syncGroupAttackPanelMountRoot();
		return minionGroupAttackPanelElement;
	}

	const element = document.createElement('div');
	element.id = NCSW_PANEL_ID;
	element.className = 'nimble-minion-group-attack-panel';
	element.hidden = true;
	getGroupAttackPanelMountRoot().appendChild(element);
	minionGroupAttackPanelElement = element;
	syncGroupAttackPanelMountRoot();
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
	if (isNcswDockedRendering()) {
		groupAttackPanelPosition = null;
		panel.style.removeProperty('left');
		panel.style.removeProperty('top');
		panel.style.removeProperty('transform');
		return;
	}
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
	if (isNcswDockedRendering()) return;
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
	hideActionWindow({ clearDraft: true });
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

function getCombatantActionsRemaining(combatant: Combatant.Implementation): number {
	const actionsRemainingRaw = Number(
		(combatant.system as unknown as { actions?: { base?: { current?: unknown } } }).actions?.base
			?.current ?? 0,
	);
	return Number.isFinite(actionsRemainingRaw) ? Math.max(0, actionsRemainingRaw) : 0;
}

function buildAttackMemberViewFromCombatant(
	combatant: Combatant.Implementation,
	defaults: { actorType: string; name: string },
	selectedCombatantIds: ReadonlySet<string>,
): GroupAttackMemberView | null {
	const combatantId = combatant.id ?? '';
	if (!combatantId) return null;

	const actor = (combatant.actor as unknown as ActorWithActionItems | null) ?? null;
	const token = getCombatantTokenObject(combatant);
	const tokenId = token ? getTargetTokenId(token) : (combatant.tokenId?.trim() ?? '');
	const hasObserverPermission = combatant.actor?.testUserPermission(game.user, 'OBSERVER') ?? false;
	const canControlToken = Boolean(token?.isVisible);
	const canGmManageCombatant = Boolean(game.user?.isGM);
	return {
		combatantId,
		combatantName: combatant.name?.trim() || combatant.token?.name || defaults.name,
		memberImage: getCombatantRowImage(combatant),
		tokenId: tokenId || null,
		stackSize: 1,
		stackMemberCombatantIds: [combatantId],
		isSelected: selectedCombatantIds.has(combatantId),
		isDefeated: combatant.defeated === true,
		canToggleSelection: canControlToken,
		canPanToToken: hasObserverPermission && Boolean(token),
		canOpenSheet: hasObserverPermission,
		canPingToken: hasObserverPermission && Boolean(token),
		canMarkDefeated: canGmManageCombatant,
		canDeleteCombatant: canGmManageCombatant,
		actorType: actor?.type?.trim()?.toLowerCase() || defaults.actorType,
		actionsRemaining: getCombatantActionsRemaining(combatant),
		actionOptions: buildGroupAttackActionOptions(actor),
	};
}

function buildAttackMemberRow(
	combatant: Combatant.Implementation,
	defaults: { actorType: string; name: string },
	selectedCombatantIds: ReadonlySet<string>,
): { combatant: Combatant.Implementation; member: GroupAttackMemberView } | null {
	const member = buildAttackMemberViewFromCombatant(combatant, defaults, selectedCombatantIds);
	return member ? { combatant, member } : null;
}

function compareNamesAlphabetically(left: string, right: string): number {
	return left.localeCompare(right, undefined, { sensitivity: 'base' });
}

function compareMemberViewsForPanelOrder(
	left: GroupAttackMemberView,
	right: GroupAttackMemberView,
): number {
	const leftHasEndedTurn = left.actionsRemaining < 1;
	const rightHasEndedTurn = right.actionsRemaining < 1;
	if (leftHasEndedTurn !== rightHasEndedTurn) {
		return leftHasEndedTurn ? 1 : -1;
	}

	const nameComparison = compareNamesAlphabetically(left.combatantName, right.combatantName);
	if (nameComparison !== 0) return nameComparison;

	return left.combatantId.localeCompare(right.combatantId, undefined, {
		sensitivity: 'base',
	});
}

function getCombatantDisplayName(combatant: Combatant.Implementation): string {
	return (
		combatant.name?.trim() ??
		combatant.token?.name?.trim() ??
		combatant.actor?.name?.trim() ??
		''
	);
}

function resolveTemporaryMinionStackData(combat: CombatWithGrouping): {
	hiddenMemberIds: Set<string>;
	memberIdsByLeaderId: Map<string, string[]>;
} {
	const hiddenMemberIds = new Set<string>();
	const memberIdsByLeaderId = new Map<string, string[]>();
	const minionGroupSummaries = getMinionGroupSummaries(combat.combatants.contents);

	for (const summary of minionGroupSummaries.values()) {
		const isTemporaryGroup = summary.members.some((member) => isMinionGroupTemporary(member));
		if (!isTemporaryGroup) continue;

		const leader =
			getEffectiveMinionGroupLeader(summary, { aliveOnly: true }) ??
			getEffectiveMinionGroupLeader(summary);
		if (!leader?.id) continue;

		const memberIds = summary.aliveMembers
			.map((member) => member.id)
			.filter((memberId): memberId is string => typeof memberId === 'string' && memberId.length > 0);
		if (memberIds.length < 2) continue;

		memberIdsByLeaderId.set(leader.id, memberIds);
		for (const memberId of memberIds) {
			if (memberId === leader.id) continue;
			hiddenMemberIds.add(memberId);
		}
	}

	return { hiddenMemberIds, memberIdsByLeaderId };
}

function applyTemporaryStackDataToMinionRow(params: {
	row: { combatant: Combatant.Implementation; member: GroupAttackMemberView };
	selectedCombatantIds: ReadonlySet<string>;
	memberIdsByLeaderId: ReadonlyMap<string, string[]>;
}): void {
	const rowCombatantId = params.row.combatant.id ?? '';
	if (!rowCombatantId) return;

	const stackMemberIds = params.memberIdsByLeaderId.get(rowCombatantId);
	if (!stackMemberIds || stackMemberIds.length < 2) return;

	params.row.member.stackSize = stackMemberIds.length;
	params.row.member.stackMemberCombatantIds = stackMemberIds;
	params.row.member.isSelected = stackMemberIds.every((memberId) =>
		params.selectedCombatantIds.has(memberId),
	);
	const actorName = params.row.combatant.actor?.name?.trim() ?? '';
	if (actorName.length > 0) {
		params.row.member.combatantName = actorName;
	}
}

function resolveGroupAttackMinionCombatant(
	combat: CombatWithGrouping,
	combatantId: string,
): Combatant.Implementation | null {
	const combatant = combat.combatants.get(combatantId) ?? null;
	if (!combatant || isCombatantDead(combatant) || !isMinionCombatant(combatant)) return null;
	return combatant;
}

function getGroupAttackMembers(
	combat: CombatWithGrouping,
	context: SelectionContext,
): Array<{ combatant: Combatant.Implementation; member: GroupAttackMemberView }> {
	const selectedCombatantIds = new Set(context.selectedAliveMinionCombatantIds);
	const temporaryStackData = resolveTemporaryMinionStackData(combat);
	const rows: Array<{ combatant: Combatant.Implementation; member: GroupAttackMemberView }> = [];
	for (const combatantId of context.allAliveMinionCombatantIds) {
		if (temporaryStackData.hiddenMemberIds.has(combatantId)) continue;

		const combatant = resolveGroupAttackMinionCombatant(combat, combatantId);
		if (!combatant) continue;

		const row = buildAttackMemberRow(combatant, {
			actorType: 'minion',
			name: 'Minion',
		}, selectedCombatantIds);
		if (!row) continue;

		applyTemporaryStackDataToMinionRow({
			row,
			selectedCombatantIds,
			memberIdsByLeaderId: temporaryStackData.memberIdsByLeaderId,
		});
		rows.push(row);
	}
	return rows.sort((left, right) => compareMemberViewsForPanelOrder(left.member, right.member));
}

function getNonMinionAttackMembers(
	context: SelectionContext,
): Array<{ combatant: Combatant.Implementation; member: GroupAttackMemberView }> {
	const selectedCombatantIds = new Set(context.selectedAliveNonMinionMonsterIds);
	const rows: Array<{ combatant: Combatant.Implementation; member: GroupAttackMemberView }> = [];
	for (const combatant of context.allAliveNonMinionMonsters) {
		const row = buildAttackMemberRow(combatant, {
			actorType: 'npc',
			name: 'Monster',
		}, selectedCombatantIds);
		if (row) rows.push(row);
	}
	return rows.sort((left, right) => compareMemberViewsForPanelOrder(left.member, right.member));
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

function setActionSelectValueForMemberStack(
	member: GroupAttackMemberView,
	actionId: string | null,
): void {
	const memberCombatantIds = member.stackMemberCombatantIds.length > 0
		? member.stackMemberCombatantIds
		: [member.combatantId];
	for (const memberCombatantId of memberCombatantIds) {
		setActionSelectValueForMember(memberCombatantId, actionId);
	}
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

function getSelectedActionLabelForMember(member: GroupAttackMemberView): string {
	const selectedActionId = getActionSelectValueForMember(member.combatantId);
	if (!selectedActionId) return '';
	const selectedOption = member.actionOptions.find(
		(option) => option.actionId === selectedActionId,
	);
	return selectedOption?.label?.trim() ?? '';
}

function getSelectedActionRollFormulaForNonMinionMember(member: GroupAttackMemberView): string {
	const selectedActionId = getNonMinionActionSelectValueForMember(member.combatantId);
	if (!selectedActionId) return '-';
	const selectedOption = member.actionOptions.find(
		(option) => option.actionId === selectedActionId,
	);
	return selectedOption?.rollFormula?.trim() || '-';
}

function getSelectedActionLabelForNonMinionMember(member: GroupAttackMemberView): string {
	const selectedActionId = getNonMinionActionSelectValueForMember(member.combatantId);
	if (!selectedActionId) return '';
	const selectedOption = member.actionOptions.find(
		(option) => option.actionId === selectedActionId,
	);
	return selectedOption?.label?.trim() ?? '';
}

function setDiceCellActionTooltip(element: HTMLElement, actionLabel: string): void {
	if (!NCSW_TEMP_SHOW_SELECTED_ACTION_TOOLTIP_ON_DICE) return;
	const nextLabel = actionLabel.trim();
	if (nextLabel.length < 1) {
		element.removeAttribute('title');
		return;
	}
	element.title = nextLabel;
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

function appendMonsterRollButtonIcon(button: HTMLButtonElement, endTurn: boolean): void {
	const content = document.createElement('span');
	content.className = endTurn
		? 'nimble-minion-group-attack-panel__button-content nimble-minion-group-attack-panel__button-content--roll-end-turn'
		: 'nimble-minion-group-attack-panel__button-content';

	const rollIcon = document.createElement('i');
	rollIcon.className = 'nimble-minion-group-attack-panel__button-icon fa-solid fa-dice';
	content.append(rollIcon);

	if (endTurn) {
		const plus = document.createElement('span');
		plus.className = 'nimble-minion-group-attack-panel__button-icon-plus';
		plus.textContent = '+';
		const endTurnIcon = document.createElement('i');
		endTurnIcon.className = 'nimble-minion-group-attack-panel__button-icon fa-solid fa-check';
		content.append(plus, endTurnIcon);
	}

	button.append(content);
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

function resetGroupAttackPanelForRender(panel: HTMLDivElement): void {
	panel.hidden = false;
	hideGroupAttackTargetPopover();
	hideGroupAttackActionDescriptionPopover();
	hideGroupAttackImagePopover();
	panel.replaceChildren();
	panel.style.removeProperty('width');
}

function renderGroupAttackPanelHeader(panel: HTMLDivElement): void {
	const header = document.createElement('div');
	header.className = 'nimble-minion-group-attack-panel__header';
	if (!isNcswDockedRendering()) {
		header.title = localizeNcsw('tooltips.dragToMove');
		header.addEventListener('pointerdown', handleGroupAttackPanelDragStart);
	} else {
		header.classList.add('nimble-minion-group-attack-panel__header--docked');
	}

	const logo = document.createElement('img');
	logo.className = 'nimble-minion-group-attack-panel__logo';
	logo.alt = localizeNcsw('logo.alt');
	logo.draggable = false;
	logo.src = NCSW_LOGO_PATH;
	logo.addEventListener('error', () => {
		logo.remove();
	});

	const title = document.createElement('h3');
	title.className = 'nimble-minion-group-attack-panel__title';
	title.textContent = localizeNcsw('title');

	header.append(logo, title);
	panel.append(header);
}

function toggleNcswMapSelector(selectorType: NcswMapSelectorType): void {
	ncswMapSelectorState[selectorType] = !ncswMapSelectorState[selectorType];
	enforceMapTokenSelectionFilter();
	scheduleActionBarRefresh(`selector-toggle-${selectorType}`);
}

function renderNcswMapSelectorOverlay(panel: HTMLDivElement): void {
	const selector = document.createElement('div');
	selector.className = 'nimble-minion-group-attack-panel__selector';

	const selectorTitle = document.createElement('span');
	selectorTitle.className = 'nimble-minion-group-attack-panel__selector-title';
	selectorTitle.textContent = localizeNcsw('selector.title');

	const selectorButtons = document.createElement('span');
	selectorButtons.className = 'nimble-minion-group-attack-panel__selector-buttons';

	const selectorItems: Array<{ key: NcswMapSelectorType; iconClass: string }> = [
		{ key: 'players', iconClass: 'fa-solid fa-user' },
		{ key: 'monsters', iconClass: 'fa-solid fa-dragon' },
		{ key: 'minions', iconClass: 'fa-solid fa-users' },
	];
	for (const selectorItem of selectorItems) {
		const button = document.createElement('button');
		button.type = 'button';
		button.className = 'nimble-minion-group-attack-panel__selector-button';
		if (ncswMapSelectorState[selectorItem.key]) {
			button.classList.add('nimble-minion-group-attack-panel__selector-button--active');
		} else {
			button.classList.add('nimble-minion-group-attack-panel__selector-button--inactive');
		}

		const tooltipLabel = localizeNcsw(`selector.${selectorItem.key}`);
		button.ariaLabel = tooltipLabel;
		button.title = tooltipLabel;
		button.addEventListener('pointerdown', (event) => {
			event.preventDefault();
			event.stopPropagation();
		});
		button.addEventListener('click', (event) => {
			event.preventDefault();
			event.stopPropagation();
			toggleNcswMapSelector(selectorItem.key);
			renderGroupAttackPanel();
		});

		const icon = document.createElement('i');
		icon.className = `nimble-minion-group-attack-panel__selector-button-icon ${selectorItem.iconClass}`;
		button.append(icon);
		selectorButtons.append(button);
	}

	selector.append(selectorTitle, selectorButtons);
	panel.append(selector);
}

function renderGroupAttackTargetSection(params: {
	panel: HTMLDivElement;
	hasAnyTarget: boolean;
	availableTargetTokens: TargetTokenView[];
}): { targetRow: HTMLDivElement; targetLabel: HTMLSpanElement; targetList: HTMLDivElement } {
	const targetRow = document.createElement('div');
	targetRow.className = 'nimble-minion-group-attack-panel__target';

	const targetLabel = document.createElement('span');
	targetLabel.className = 'nimble-minion-group-attack-panel__target-label';

	const targetLabelText = document.createElement('span');
	targetLabelText.className = 'nimble-minion-group-attack-panel__target-label-text';
	targetLabelText.textContent = localizeNcsw('targets.label');

	const targetStatusIcon = document.createElement('i');
	targetStatusIcon.className = `nimble-minion-group-attack-panel__target-label-icon fa-solid fa-crosshairs ${
		params.hasAnyTarget
			? 'nimble-minion-group-attack-panel__target-label-icon--active'
			: 'nimble-minion-group-attack-panel__target-label-icon--inactive'
	}`;
	targetLabel.append(targetLabelText, targetStatusIcon);
	targetRow.append(targetLabel);

	const targetList = document.createElement('div');
	targetList.className = 'nimble-minion-group-attack-panel__target-list';

	if (params.availableTargetTokens.length === 0) {
		const hint = document.createElement('span');
		hint.className = 'nimble-minion-group-attack-panel__target-hint';
		hint.textContent = localizeNcsw('targets.hint');
		targetList.append(hint);
	} else {
		for (const targetToken of params.availableTargetTokens) {
			const targetButton = document.createElement('button');
			targetButton.type = 'button';
			targetButton.className = 'nimble-minion-group-attack-panel__target-token';
			if (targetToken.isSelected) {
				targetButton.classList.add('nimble-minion-group-attack-panel__target-token--selected');
			}
			if (!targetToken.isTargeted) {
				targetButton.classList.add('nimble-minion-group-attack-panel__target-token--inactive');
			}
			if (!targetToken.canToggleTarget) {
				targetButton.disabled = true;
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
				toggleTargetTokenFromPanel(targetToken, !targetToken.isTargeted);
				scheduleActionBarRefresh('ncsw-target-toggle');
			});

			targetList.append(targetButton);
		}
	}

	targetRow.append(targetList);
	params.panel.append(targetRow);
	return { targetRow, targetLabel, targetList };
}

function appendGroupAttackSectionTitle(panel: HTMLDivElement, key: 'monsters' | 'minions'): void {
	const sectionTitle = document.createElement('div');
	sectionTitle.className = 'nimble-minion-group-attack-panel__section-title';

	const sectionTitleText = document.createElement('span');
	sectionTitleText.className = 'nimble-minion-group-attack-panel__section-title-text';
	sectionTitleText.textContent = localizeNcsw(`sections.${key}`);

	const sectionTitleIcons = document.createElement('span');
	sectionTitleIcons.className = 'nimble-minion-group-attack-panel__section-title-icons';

	const sectionIcon = document.createElement('i');
	sectionIcon.className = 'nimble-minion-group-attack-panel__section-icon fa-solid fa-dragon';
	sectionTitleIcons.append(sectionIcon);
	sectionTitle.append(sectionTitleText, sectionTitleIcons);
	panel.append(sectionTitle);
}

function resolveCombatantForPanelRow(combatantId: string): Combatant.Implementation | null {
	const combat = getCombatForCurrentScene();
	if (!combat) return null;
	const combatant = combat.combatants.get(combatantId) ?? null;
	if (!combatant) return null;
	const sceneId = canvas.scene?.id;
	if (sceneId && getCombatantSceneId(combatant) !== sceneId) return null;
	return combatant;
}

function toggleCombatantSelectionFromPanel(member: GroupAttackMemberView): void {
	const combatantIds = member.stackMemberCombatantIds.length > 0
		? member.stackMemberCombatantIds
		: [member.combatantId];
	const seenTokenIds = new Set<string>();
	const tokens: Token[] = [];
	for (const combatantId of combatantIds) {
		const combatant = resolveCombatantForPanelRow(combatantId);
		if (!combatant) continue;
		const token = getCombatantTokenObject(combatant);
		if (!token || !token.isVisible) continue;
		const tokenId = getTargetTokenId(token);
		if (!tokenId || seenTokenIds.has(tokenId)) continue;
		seenTokenIds.add(tokenId);
		tokens.push(token);
	}
	if (tokens.length < 1) return;

	const shouldReleaseSelection = tokens.every((token) => token.controlled);
	for (const token of tokens) {
		if (shouldReleaseSelection) {
			token.release();
			continue;
		}
		controlTokenFromPanel(token, { releaseOthers: false });
	}
	scheduleActionBarRefresh('ncsw-member-toggle-selection');
}

async function openCombatantSheetFromPanel(combatantId: string): Promise<void> {
	const combatant = resolveCombatantForPanelRow(combatantId);
	if (!combatant) return;
	const actor = combatant.actor;
	if (!actor?.testUserPermission(game.user, 'OBSERVER')) return;
	actor.sheet?.render(true);
}

async function panToCombatantFromPanel(combatantId: string): Promise<void> {
	const combatant = resolveCombatantForPanelRow(combatantId);
	if (!combatant) return;
	if (!combatant.actor?.testUserPermission(game.user, 'OBSERVER')) return;
	const token = getCombatantTokenObject(combatant);
	if (!token) return;
	controlTokenFromPanel(token, { releaseOthers: true });
	await canvas.animatePan(token.center);
}

async function pingCombatantTokenFromPanel(combatantId: string): Promise<void> {
	const combatant = resolveCombatantForPanelRow(combatantId);
	if (!combatant) return;
	if (!canvas?.ready || combatant.sceneId !== canvas?.scene?.id) return;
	if (!combatant.actor?.testUserPermission(game.user, 'OBSERVER')) return;

	const token = getCombatantTokenObject(combatant);
	if (!token?.visible) {
		ui.notifications?.warn(game.i18n.localize('COMBAT.WarnNonVisibleToken'));
		return;
	}

	await canvas.ping(token.center);
}

async function toggleCombatantDefeatedFromPanel(combatantId: string): Promise<void> {
	if (!game.user?.isGM) return;
	const combatant = resolveCombatantForPanelRow(combatantId);
	if (!combatant) return;

	const nextDefeated = !combatant.defeated;
	const maxActions = Number(foundry.utils.getProperty(combatant, 'system.actions.base.max') ?? 0);
	const updates: Record<string, unknown> = {
		defeated: nextDefeated,
	};
	if (Number.isFinite(maxActions) && maxActions >= 0) {
		updates['system.actions.base.current'] = nextDefeated ? 0 : maxActions;
	}
	await combatant.update(updates);

	const defeatedId = CONFIG.specialStatusEffects.DEFEATED;
	await combatant.actor?.toggleStatusEffect(defeatedId, {
		overlay: true,
		active: nextDefeated,
	});
}

async function deleteCombatantFromPanel(combatantId: string): Promise<void> {
	if (!game.user?.isGM) return;
	const combatant = resolveCombatantForPanelRow(combatantId);
	if (!combatant?.id) return;

	const parentCombat = combatant.parent as Combat | null;
	const combatantDoc = parentCombat?.combatants?.get(combatant.id);
	await combatantDoc?.delete();
}

function pruneExpandedMemberAccordions(): void {
	const validCombatantIds = new Set(
		[...activeNonMinionAttackMembers, ...activeGroupAttackMembers].map((member) => member.combatantId),
	);
	for (const combatantId of Array.from(expandedMemberCombatantIds)) {
		if (!validCombatantIds.has(combatantId)) {
			expandedMemberCombatantIds.delete(combatantId);
		}
	}
}

function isMemberAccordionExpanded(combatantId: string): boolean {
	return expandedMemberCombatantIds.has(combatantId);
}

function isNonMinionAttackMember(combatantId: string): boolean {
	return activeNonMinionAttackMembers.some((member) => member.combatantId === combatantId);
}

function syncMonsterTokenSelectionForAccordionState(
	combatantId: string,
	isAccordionExpanded: boolean,
): void {
	if (!isNonMinionAttackMember(combatantId)) return;

	const combatant = resolveCombatantForPanelRow(combatantId);
	if (!combatant) return;

	const token = getCombatantTokenObject(combatant);
	if (!token) return;

	if (isAccordionExpanded) {
		if (!token.isVisible || token.controlled) return;
		controlTokenFromPanel(token, { releaseOthers: false });
		return;
	}

	if (token.controlled) {
		token.release();
	}
}

function toggleMemberAccordionExpanded(combatantId: string): void {
	const isAccordionExpanded = !expandedMemberCombatantIds.has(combatantId);
	if (isAccordionExpanded) {
		expandedMemberCombatantIds.add(combatantId);
	} else {
		expandedMemberCombatantIds.delete(combatantId);
	}
	syncMonsterTokenSelectionForAccordionState(combatantId, isAccordionExpanded);
	renderGroupAttackPanel();
}

function createMemberAccordionDetails(
	member: GroupAttackMemberView,
	options: { hasAnyTarget: boolean },
): HTMLDivElement {
	const accordionData = buildMemberAccordionData(member);
	const canChooseAction = member.actionsRemaining > 0;
	const canRollAction = options.hasAnyTarget && member.isSelected && member.actionsRemaining > 0;
	const missingTarget = !options.hasAnyTarget;

	const details = document.createElement('div');
	details.className = 'nimble-minion-group-attack-panel__accordion';

	const actionList = document.createElement('div');
	actionList.className = 'nimble-minion-group-attack-panel__accordion-action-list';
	actionList.style.setProperty(
		'--nimble-ncsw-accordion-action-columns',
		String(Math.min(2, Math.max(1, accordionData.actions.length))),
	);

	if (accordionData.actions.length < 1) {
		const emptyValue = document.createElement('section');
		emptyValue.className =
			'nimble-minion-group-attack-panel__accordion-action-section nimble-minion-group-attack-panel__accordion-action-section--empty';
		emptyValue.textContent = '-';
		actionList.append(emptyValue);
	} else {
		for (const action of accordionData.actions) {
			const actionSection = document.createElement('section');
			actionSection.className = 'nimble-minion-group-attack-panel__accordion-action-section';

			const actionRow = document.createElement('div');
			actionRow.className = 'nimble-minion-group-attack-panel__accordion-action-row';

			const actionImage = document.createElement('img');
			actionImage.className = 'nimble-minion-group-attack-panel__accordion-action-image';
			actionImage.src = action.image;
			actionImage.alt = action.label;

			const actionText = document.createElement('div');
			actionText.className = 'nimble-minion-group-attack-panel__accordion-action-text';

			const actionButton = document.createElement('button');
			actionButton.type = 'button';
			actionButton.className = 'nimble-minion-group-attack-panel__accordion-action-button';
			if (action.isSelected) {
				actionButton.classList.add('nimble-minion-group-attack-panel__accordion-action-button--active');
			}
			actionButton.textContent = action.label;
			actionButton.disabled = !canChooseAction;
			actionButton.addEventListener('click', (event) => {
				event.preventDefault();
				event.stopPropagation();
				setMemberSelectedActionId(member, action.actionId);
				renderGroupAttackPanel();
			});

			const actionDescription = document.createElement('span');
			actionDescription.className = 'nimble-minion-group-attack-panel__accordion-action-description';
			actionDescription.textContent = action.description;

			const actionControls = document.createElement('div');
			actionControls.className = 'nimble-minion-group-attack-panel__accordion-action-controls';

			const rollButton = document.createElement('button');
			rollButton.type = 'button';
			rollButton.className =
				'nimble-minion-group-attack-panel__button nimble-minion-group-attack-panel__button--positive nimble-minion-group-attack-panel__button--icon nimble-minion-group-attack-panel__accordion-action-roll-button';
			rollButton.ariaLabel = buildAttackActionButtonLabel(false);
			rollButton.title = buildAttackActionButtonLabel(false);
			appendMonsterRollButtonIcon(rollButton, false);
			rollButton.disabled = !canRollAction || isExecutingAction;
			rollButton.addEventListener('click', (event) => {
				event.preventDefault();
				event.stopPropagation();
				void executeAccordionMemberAttackRoll(member, action.actionId, false);
			});
			appendButtonWithOptionalTargetTooltip(actionControls, rollButton, missingTarget);

			const rollEndTurnButton = document.createElement('button');
			rollEndTurnButton.type = 'button';
			rollEndTurnButton.className =
				'nimble-minion-group-attack-panel__button nimble-minion-group-attack-panel__button--positive nimble-minion-group-attack-panel__button--icon nimble-minion-group-attack-panel__accordion-action-roll-button';
			rollEndTurnButton.ariaLabel = buildAttackActionButtonLabel(true);
			rollEndTurnButton.title = buildAttackActionButtonLabel(true);
			appendMonsterRollButtonIcon(rollEndTurnButton, true);
			rollEndTurnButton.disabled = !canRollAction || isExecutingAction;
			rollEndTurnButton.addEventListener('click', (event) => {
				event.preventDefault();
				event.stopPropagation();
				void executeAccordionMemberAttackRoll(member, action.actionId, true);
			});
			appendButtonWithOptionalTargetTooltip(actionControls, rollEndTurnButton, missingTarget);

			actionText.append(actionButton, actionDescription, actionControls);
			actionRow.append(actionImage, actionText);
			actionSection.append(actionRow);
			actionList.append(actionSection);
		}
	}

	details.append(actionList);
	return details;
}

function createGroupAttackMemberCell(member: GroupAttackMemberView): HTMLTableCellElement {
	const memberCell = document.createElement('td');
	memberCell.className = 'nimble-minion-group-attack-panel__member';
	const isExpanded = isMemberAccordionExpanded(member.combatantId);

	const memberContent = document.createElement('div');
	memberContent.className = 'nimble-minion-group-attack-panel__member-content';

	const memberImage = document.createElement('img');
	memberImage.className = 'nimble-minion-group-attack-panel__member-image';
	memberImage.src = member.memberImage;
	memberImage.alt = member.combatantName;

	const memberName = document.createElement('button');
	memberName.type = 'button';
	memberName.className = 'nimble-minion-group-attack-panel__member-name-button';
	if (member.isSelected) {
		memberName.classList.add('nimble-minion-group-attack-panel__member-name--selected');
	}
	const memberDisplayName =
		member.stackSize > 1 ? `x${member.stackSize} ${member.combatantName}` : member.combatantName;
	memberName.textContent = memberDisplayName;
	memberName.disabled = !member.canToggleSelection;
	memberName.ariaLabel = formatNcsw('buttons.toggleSelectionAria', { name: memberDisplayName });
	memberName.title = localizeNcsw('tooltips.toggleSelection');
	memberName.addEventListener('click', (event) => {
		event.preventDefault();
		event.stopPropagation();
		toggleCombatantSelectionFromPanel(member);
	});

	const memberIconButtons = document.createElement('span');
	memberIconButtons.className = 'nimble-minion-group-attack-panel__member-icon-buttons';

	const accordionToggleButton = document.createElement('button');
	accordionToggleButton.type = 'button';
	accordionToggleButton.className =
		'nimble-minion-group-attack-panel__member-icon-button nimble-minion-group-attack-panel__member-icon-button--accordion';
	if (isExpanded) {
		accordionToggleButton.classList.add('nimble-minion-group-attack-panel__member-icon-button--active');
	}
	accordionToggleButton.ariaLabel = localizeNcsw('buttons.toggleDetails');
	accordionToggleButton.title = localizeNcsw('buttons.toggleDetails');
	const accordionIcon = document.createElement('i');
	accordionIcon.className = isExpanded
		? 'nimble-minion-group-attack-panel__member-icon-button-icon fa-solid fa-chevron-up'
		: 'nimble-minion-group-attack-panel__member-icon-button-icon fa-solid fa-chevron-down';
	accordionToggleButton.append(accordionIcon);
	accordionToggleButton.addEventListener('click', (event) => {
		event.preventDefault();
		event.stopPropagation();
		toggleMemberAccordionExpanded(member.combatantId);
	});

	const panButton = document.createElement('button');
	panButton.type = 'button';
	panButton.className = 'nimble-minion-group-attack-panel__member-icon-button';
	panButton.ariaLabel = localizeNcsw('buttons.panTo');
	panButton.title = localizeNcsw('buttons.panTo');
	panButton.disabled = !member.canPanToToken;
	const panIcon = document.createElement('i');
	panIcon.className =
		'nimble-minion-group-attack-panel__member-icon-button-icon fa-solid fa-magnifying-glass-location';
	panButton.append(panIcon);
	panButton.addEventListener('click', (event) => {
		event.preventDefault();
		event.stopPropagation();
		void panToCombatantFromPanel(member.combatantId);
	});

	const openSheetButton = document.createElement('button');
	openSheetButton.type = 'button';
	openSheetButton.className = 'nimble-minion-group-attack-panel__member-icon-button';
	openSheetButton.ariaLabel = localizeNcsw('buttons.openSheet');
	openSheetButton.title = localizeNcsw('buttons.openSheet');
	openSheetButton.disabled = !member.canOpenSheet;
	const openSheetIcon = document.createElement('i');
	openSheetIcon.className =
		'nimble-minion-group-attack-panel__member-icon-button-icon fa-solid fa-expand';
	openSheetButton.append(openSheetIcon);
	openSheetButton.addEventListener('click', (event) => {
		event.preventDefault();
		event.stopPropagation();
		void openCombatantSheetFromPanel(member.combatantId);
	});

	const pingButton = document.createElement('button');
	pingButton.type = 'button';
	pingButton.className = 'nimble-minion-group-attack-panel__member-icon-button';
	pingButton.ariaLabel = localizeNcsw('buttons.pingToken');
	pingButton.title = localizeNcsw('buttons.pingToken');
	pingButton.disabled = !member.canPingToken;
	const pingIcon = document.createElement('i');
	pingIcon.className = 'nimble-minion-group-attack-panel__member-icon-button-icon fa-solid fa-bullseye';
	pingButton.append(pingIcon);
	pingButton.addEventListener('click', (event) => {
		event.preventDefault();
		event.stopPropagation();
		void pingCombatantTokenFromPanel(member.combatantId);
	});

	const markDefeatedButton = document.createElement('button');
	markDefeatedButton.type = 'button';
	markDefeatedButton.className =
		'nimble-minion-group-attack-panel__member-icon-button nimble-minion-group-attack-panel__member-icon-button--danger';
	if (member.isDefeated) {
		markDefeatedButton.classList.add('nimble-minion-group-attack-panel__member-icon-button--active');
	}
	markDefeatedButton.ariaLabel = localizeNcsw('buttons.markDefeated');
	markDefeatedButton.title = localizeNcsw('buttons.markDefeated');
	markDefeatedButton.disabled = !member.canMarkDefeated;
	const markDefeatedIcon = document.createElement('i');
	markDefeatedIcon.className =
		'nimble-minion-group-attack-panel__member-icon-button-icon fa-solid fa-skull';
	markDefeatedButton.append(markDefeatedIcon);
	markDefeatedButton.addEventListener('click', (event) => {
		event.preventDefault();
		event.stopPropagation();
		void toggleCombatantDefeatedFromPanel(member.combatantId);
	});

	memberIconButtons.append(accordionToggleButton, panButton, openSheetButton, pingButton, markDefeatedButton);
	if (!NCSW_TEMP_HIDE_DELETE_COMBATANT_BUTTON) {
		const deleteCombatantButton = document.createElement('button');
		deleteCombatantButton.type = 'button';
		deleteCombatantButton.className =
			'nimble-minion-group-attack-panel__member-icon-button nimble-minion-group-attack-panel__member-icon-button--danger';
		deleteCombatantButton.ariaLabel = localizeNcsw('buttons.deleteCombatant');
		deleteCombatantButton.title = localizeNcsw('buttons.deleteCombatant');
		deleteCombatantButton.disabled = !member.canDeleteCombatant;
		const deleteCombatantIcon = document.createElement('i');
		deleteCombatantIcon.className =
			'nimble-minion-group-attack-panel__member-icon-button-icon fa-solid fa-trash';
		deleteCombatantButton.append(deleteCombatantIcon);
		deleteCombatantButton.addEventListener('click', (event) => {
			event.preventDefault();
			event.stopPropagation();
			void deleteCombatantFromPanel(member.combatantId);
		});
		memberIconButtons.append(deleteCombatantButton);
	}

	memberContent.append(memberImage, memberName, memberIconButtons);
	memberCell.append(memberContent);
	return memberCell;
}

function buildGroupAttackActionSelect(
	member: GroupAttackMemberView,
	options: {
		selectedActionId: string;
		onChange: (actionId: string | null) => void;
	},
): HTMLSelectElement {
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

	select.value = options.selectedActionId;
	bindActionSelectDescriptionPopover({
		select,
		getDescription: () => getActionDescriptionForSelection(member.actionOptions, select.value),
	});
	select.addEventListener('change', (event) => {
		const target = event.currentTarget as HTMLSelectElement;
		const nextActionId = target.value.trim();
		options.onChange(nextActionId.length > 0 ? nextActionId : null);
		renderGroupAttackPanel();
	});

	return select;
}

function createGroupAttackTableElement(
	variantClassName: string | null = null,
): { table: HTMLTableElement; body: HTMLTableSectionElement } {
	const table = document.createElement('table');
	table.className = variantClassName
		? `nimble-minion-group-attack-panel__table ${variantClassName}`
		: 'nimble-minion-group-attack-panel__table';

	const colGroup = document.createElement('colgroup');

	const memberCol = document.createElement('col');
	memberCol.className =
		'nimble-minion-group-attack-panel__col nimble-minion-group-attack-panel__col--member';
	const actionCol = document.createElement('col');
	actionCol.className =
		'nimble-minion-group-attack-panel__col nimble-minion-group-attack-panel__col--action';
	const diceCol = document.createElement('col');
	diceCol.className =
		'nimble-minion-group-attack-panel__col nimble-minion-group-attack-panel__col--dice';
	colGroup.append(memberCol, actionCol, diceCol);
	table.append(colGroup);

	const body = document.createElement('tbody');
	table.append(body);
	return { table, body };
}

function renderGroupAttackNonMinionSection(panel: HTMLDivElement, hasAnyTarget: boolean): void {
	appendGroupAttackSectionTitle(panel, 'monsters');

	const { table: nonMinionTable, body: nonMinionBody } = createGroupAttackTableElement(
		'nimble-minion-group-attack-panel__table--monsters',
	);

	for (const member of activeNonMinionAttackMembers) {
		const row = document.createElement('tr');
		row.className =
			'nimble-minion-group-attack-panel__row nimble-minion-group-attack-panel__row--monster';
		const hasNoActionsRemaining = member.actionsRemaining < 1;
		if (hasNoActionsRemaining) {
			row.classList.add('nimble-minion-group-attack-panel__row--inactive');
		}

		const memberCell = createGroupAttackMemberCell(member);

		const actionCell = document.createElement('td');
		actionCell.className = 'nimble-minion-group-attack-panel__action';
		const select = buildGroupAttackActionSelect(member, {
			selectedActionId: getNonMinionActionSelectValueForMember(member.combatantId),
			onChange: (actionId) => {
				setNonMinionActionSelectValueForMember(member.combatantId, actionId);
			},
		});
		actionCell.append(select);

		const diceCell = document.createElement('td');
		diceCell.className = 'nimble-minion-group-attack-panel__dice';
		const selectedActionId = getNonMinionActionSelectValueForMember(member.combatantId).trim();
		const hasValidSelectedAction =
			selectedActionId.length > 0 &&
			member.actionOptions.some((option) => option.actionId === selectedActionId);
		const canRollSelectedMonsterAction =
			hasAnyTarget &&
			member.isSelected &&
			member.actionsRemaining > 0 &&
			hasValidSelectedAction &&
			!isExecutingAction;
		const missingTarget = !hasAnyTarget;

		const diceRollButton = document.createElement('button');
		diceRollButton.type = 'button';
		diceRollButton.className =
			'nimble-minion-group-attack-panel__button nimble-minion-group-attack-panel__button--positive nimble-minion-group-attack-panel__dice-roll-button';
		diceRollButton.textContent = getSelectedActionRollFormulaForNonMinionMember(member);
		diceRollButton.disabled = !canRollSelectedMonsterAction;
		setDiceCellActionTooltip(diceRollButton, getSelectedActionLabelForNonMinionMember(member));
		diceRollButton.addEventListener('click', (event) => {
			event.preventDefault();
			event.stopPropagation();
			void executeNonMinionAttackRoll(member.combatantId, true);
		});
		appendButtonWithOptionalTargetTooltip(diceCell, diceRollButton, missingTarget);

		row.append(memberCell, actionCell, diceCell);
		nonMinionBody.append(row);

		if (isMemberAccordionExpanded(member.combatantId)) {
			const accordionRow = document.createElement('tr');
			accordionRow.className = 'nimble-minion-group-attack-panel__accordion-row';
			const accordionCell = document.createElement('td');
			accordionCell.className = 'nimble-minion-group-attack-panel__accordion-cell';
			accordionCell.colSpan = 3;
			accordionCell.append(createMemberAccordionDetails(member, { hasAnyTarget }));
			accordionRow.append(accordionCell);
			nonMinionBody.append(accordionRow);
		}
	}

	panel.append(nonMinionTable);
}

function renderGroupAttackMinionSection(panel: HTMLDivElement, hasAnyTarget: boolean): void {
	appendGroupAttackSectionTitle(panel, 'minions');

	const { table, body } = createGroupAttackTableElement();

	for (const member of activeGroupAttackMembers) {
		const row = document.createElement('tr');
		row.className = 'nimble-minion-group-attack-panel__row';
		if (member.actionsRemaining < 1) {
			row.classList.add('nimble-minion-group-attack-panel__row--inactive');
		}

		const memberCell = createGroupAttackMemberCell(member);

		const actionCell = document.createElement('td');
		actionCell.className = 'nimble-minion-group-attack-panel__action';
		const select = buildGroupAttackActionSelect(member, {
			selectedActionId: getActionSelectValueForMember(member.combatantId),
			onChange: (actionId) => {
				setActionSelectValueForMemberStack(member, actionId);
			},
		});
		actionCell.append(select);

		const diceCell = document.createElement('td');
		diceCell.className = 'nimble-minion-group-attack-panel__dice';
		diceCell.textContent = getSelectedActionRollFormulaForMember(member);
		setDiceCellActionTooltip(diceCell, getSelectedActionLabelForMember(member));

		row.append(memberCell, actionCell, diceCell);
		body.append(row);

		if (isMemberAccordionExpanded(member.combatantId)) {
			const accordionRow = document.createElement('tr');
			accordionRow.className = 'nimble-minion-group-attack-panel__accordion-row';
			const accordionCell = document.createElement('td');
			accordionCell.className = 'nimble-minion-group-attack-panel__accordion-cell';
			accordionCell.colSpan = 3;
			accordionCell.append(createMemberAccordionDetails(member, { hasAnyTarget }));
			accordionRow.append(accordionCell);
			body.append(accordionRow);
		}
	}

	panel.append(table);
}

function renderGroupAttackWarningSection(panel: HTMLDivElement): void {
	if (activeGroupAttackWarnings.length === 0) return;

	const warningList = document.createElement('ul');
	warningList.className = 'nimble-minion-group-attack-panel__warnings';
	for (const warning of activeGroupAttackWarnings) {
		const item = document.createElement('li');
		item.textContent = warning;
		warningList.append(item);
	}
	panel.append(warningList);
}

function renderGroupAttackButtonSection(params: {
	panel: HTMLDivElement;
	hasMinionSection: boolean;
	hasAnyTarget: boolean;
	hasRollableMinionMembers: boolean;
}): void {
	const buttons = document.createElement('div');
	buttons.className = 'nimble-minion-group-attack-panel__buttons';

	if (params.hasMinionSection) {
		const missingTarget = !params.hasAnyTarget;

		const rollButton = document.createElement('button');
		rollButton.type = 'button';
		rollButton.className =
			'nimble-minion-group-attack-panel__button nimble-minion-group-attack-panel__button--positive';
		rollButton.textContent = buildAttackActionButtonLabel(false);
		rollButton.disabled =
			!params.hasAnyTarget || !params.hasRollableMinionMembers || isExecutingAction;
		rollButton.addEventListener('click', () => {
			void executeGroupAttackRoll(false);
		});
		appendButtonWithOptionalTargetTooltip(buttons, rollButton, missingTarget);

		const rollEndTurnButton = document.createElement('button');
		rollEndTurnButton.type = 'button';
		rollEndTurnButton.className =
			'nimble-minion-group-attack-panel__button nimble-minion-group-attack-panel__button--positive';
		rollEndTurnButton.textContent = buildAttackActionButtonLabel(true);
		rollEndTurnButton.disabled =
			!params.hasAnyTarget || !params.hasRollableMinionMembers || isExecutingAction;
		rollEndTurnButton.addEventListener('click', () => {
			void executeGroupAttackRoll(true);
		});
		appendButtonWithOptionalTargetTooltip(buttons, rollEndTurnButton, missingTarget);
	}

	if (!isNcswCombatStateEnabled(getCombatForCurrentScene())) {
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
	}

	if (buttons.childElementCount > 0) {
		params.panel.append(buttons);
	}
}

function finalizeGroupAttackPanelLayout(params: {
	panel: HTMLDivElement;
	targetRow: HTMLDivElement;
	targetLabel: HTMLSpanElement;
	targetList: HTMLDivElement;
}): void {
	if (isNcswDockedRendering()) {
		params.panel.style.removeProperty('width');
		params.panel.style.removeProperty('left');
		params.panel.style.removeProperty('top');
		params.panel.style.removeProperty('transform');
		return;
	}

	applyGroupAttackPanelWidth({
		panel: params.panel,
		targetRow: params.targetRow,
		targetLabel: params.targetLabel,
		targetList: params.targetList,
	});

	queueMicrotask(() => {
		if (groupAttackPanelPosition) {
			setGroupAttackPanelPosition(groupAttackPanelPosition);
			return;
		}
		setGroupAttackPanelPosition(null);
	});
}

function renderGroupAttackPanel(): void {
	const panel = getGroupAttackPanelElement();
	const hasMinionSection = Boolean(activeGroupAttackSession) && activeGroupAttackMembers.length > 0;
	const hasNonMinionSection = activeNonMinionAttackMembers.length > 0;

	const { targetTokenIds } = getCurrentTargetSummary();
	const hasAnyTarget = targetTokenIds.length > 0;
	const availableTargetTokens = getAvailablePlayerTargetTokens();
	const hasRollableMinionMembers = activeGroupAttackMembers.some((member) => {
		if (!member.isSelected) return false;
		if (member.actionsRemaining < 1) return false;
		const selectedActionId = getActionSelectValueForMember(member.combatantId);
		return selectedActionId.length > 0;
	});

	resetGroupAttackPanelForRender(panel);
	renderNcswMapSelectorOverlay(panel);
	renderGroupAttackPanelHeader(panel);
	const targetSection = renderGroupAttackTargetSection({
		panel,
		hasAnyTarget,
		availableTargetTokens,
	});
	if (hasNonMinionSection) {
		renderGroupAttackNonMinionSection(panel, hasAnyTarget);
	}
	if (hasMinionSection) {
		renderGroupAttackMinionSection(panel, hasAnyTarget);
	}
	renderGroupAttackWarningSection(panel);
	renderGroupAttackButtonSection({
		panel,
		hasMinionSection,
		hasAnyTarget,
		hasRollableMinionMembers,
	});
	finalizeGroupAttackPanelLayout({
		panel,
		targetRow: targetSection.targetRow,
		targetLabel: targetSection.targetLabel,
		targetList: targetSection.targetList,
	});
}

async function resolveCombatForGroupAttackRoll(): Promise<CombatWithGroupAttack | null> {
	const combat = getCombatForCurrentScene();
	if (!combat || typeof combat.performMinionGroupAttack !== 'function') {
		ui.notifications?.warn(localizeNcsw('notifications.noActiveCombatForGroupAttack'));
		return null;
	}
	if (!combat.started) {
		await combat.startCombat();
	}
	return combat as CombatWithGroupAttack;
}

function resolveGroupAttackTargetTokenIds(): string[] {
	const { targetTokenIds } = getCurrentTargetSummary();
	if (targetTokenIds.length < 1) {
		ui.notifications?.warn(localizeNcsw('notifications.selectTargetBeforeGroupAttack'));
		return [];
	}
	return targetTokenIds;
}

function buildGroupAttackRollSelections(): {
	memberCombatantIds: string[];
	selections: Array<{ memberCombatantId: string; actionId: string | null }>;
} {
	const selectedMembers = activeGroupAttackMembers.filter((member) => member.isSelected);
	const memberCombatantIds: string[] = [];
	const selections: Array<{ memberCombatantId: string; actionId: string | null }> = [];
	const seenMemberIds = new Set<string>();
	for (const member of selectedMembers) {
		const selectedActionId = getActionSelectValueForMember(member.combatantId) || null;
		const stackMemberCombatantIds = member.stackMemberCombatantIds.length > 0
			? member.stackMemberCombatantIds
			: [member.combatantId];
		for (const memberCombatantId of stackMemberCombatantIds) {
			if (!memberCombatantId || seenMemberIds.has(memberCombatantId)) continue;
			seenMemberIds.add(memberCombatantId);
			memberCombatantIds.push(memberCombatantId);
			selections.push({
				memberCombatantId,
				actionId: selectedActionId,
			});
		}
	}

	return {
		memberCombatantIds,
		selections,
	};
}

function resolveMinionAttackMember(memberCombatantId: string): GroupAttackMemberView | null {
	return activeGroupAttackMembers.find((member) => member.combatantId === memberCombatantId) ?? null;
}

async function executeSingleMinionAttackRoll(
	memberCombatantId: string,
	actionId: string,
	endTurn: boolean,
): Promise<void> {
	if (isExecutingAction) return;

	const member = resolveMinionAttackMember(memberCombatantId);
	if (!member) return;
	if (!member.isSelected) {
		ui.notifications?.warn(localizeNcsw('notifications.selectMinionsBeforeRoll'));
		return;
	}
	if (member.actionsRemaining < 1) return;
	if (!member.actionOptions.some((option) => option.actionId === actionId)) {
		ui.notifications?.warn(formatNcsw('notifications.selectActionBeforeRoll', { name: member.combatantName }));
		return;
	}

	const combat = await resolveCombatForGroupAttackRoll();
	if (!combat) return;

	const targetTokenIds = resolveGroupAttackTargetTokenIds();
	if (targetTokenIds.length < 1) return;

	const scopedMemberCombatantIds = member.stackMemberCombatantIds.length > 0
		? member.stackMemberCombatantIds
		: [memberCombatantId];
	setActionSelectValueForMemberStack(member, actionId);
	isExecutingAction = true;
	scheduleActionBarRefresh('accordion-minion-roll-start');
	try {
		const result = await combat.performMinionGroupAttack({
			memberCombatantIds: scopedMemberCombatantIds,
			targetTokenIds,
			selections: scopedMemberCombatantIds.map((scopedMemberCombatantId) => ({
				memberCombatantId: scopedMemberCombatantId,
				actionId,
			})),
			endTurn,
		});

		if (activeGroupAttackSession) {
			rememberMemberActionSelection(
				rememberedGroupAttackSelectionsByActorType,
				activeGroupAttackSession.context,
				member.actorType,
				actionId,
			);
		}

		applyGroupAttackRollResultState({ result, endTurn });
		clearControlledTokensForCombatantIds(scopedMemberCombatantIds);
		renderGroupAttackPanel();
		scheduleActionBarRefresh('accordion-minion-roll-end');
	} catch (error) {
		console.error('[Nimble][MinionGrouping][TokenUI] Accordion minion attack roll failed', {
			memberCombatantId,
			actionId,
			error,
		});
		ui.notifications?.error(localizeNcsw('notifications.groupAttackFailed'));
	} finally {
		isExecutingAction = false;
		scheduleActionBarRefresh('accordion-minion-roll-finalize');
	}
}

async function executeAccordionMemberAttackRoll(
	member: GroupAttackMemberView,
	actionId: string,
	endTurn: boolean,
): Promise<void> {
	const isMonsterMember = activeNonMinionAttackMembers.some(
		(candidate) => candidate.combatantId === member.combatantId,
	);
	if (isMonsterMember) {
		expandedMemberCombatantIds.delete(member.combatantId);
		syncMonsterTokenSelectionForAccordionState(member.combatantId, false);
		renderGroupAttackPanel();
		setNonMinionActionSelectValueForMember(member.combatantId, actionId);
		await executeNonMinionAttackRoll(member.combatantId, endTurn);
		return;
	}
	await executeSingleMinionAttackRoll(member.combatantId, actionId, endTurn);
}

function rememberCurrentGroupAttackSelections(session: MinionGroupAttackSelectionState): void {
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
}

function applyGroupAttackRollResultState(params: {
	result: {
		rolledCombatantIds: string[];
		skippedMembers: Array<{ combatantId: string; reason: string }>;
		unsupportedSelectionWarnings: string[];
		endTurnApplied: boolean;
	};
	endTurn: boolean;
}): void {
	activeGroupAttackWarnings = buildSelectionWarnings(params.result);
	if (params.result.rolledCombatantIds.length === 0) {
		ui.notifications?.warn(localizeNcsw('notifications.noGroupAttacksRolled'));
	}
	if (params.endTurn && !params.result.endTurnApplied) {
		activeGroupAttackWarnings = [
			...activeGroupAttackWarnings,
			localizeNcsw('warnings.endTurnNotApplied'),
		];
	}
}

async function executeGroupAttackRoll(endTurn: boolean): Promise<void> {
	const session = activeGroupAttackSession;
	if (!session) return;
	if (isExecutingAction) return;

	const combat = await resolveCombatForGroupAttackRoll();
	if (!combat) return;

	const targetTokenIds = resolveGroupAttackTargetTokenIds();
	if (targetTokenIds.length < 1) return;

	const { memberCombatantIds, selections } = buildGroupAttackRollSelections();
	if (memberCombatantIds.length < 1) {
		ui.notifications?.warn(localizeNcsw('notifications.selectMinionsBeforeRoll'));
		return;
	}

	isExecutingAction = true;
	scheduleActionBarRefresh('group-attack-roll-start');
	try {
		const result = await combat.performMinionGroupAttack({
			memberCombatantIds,
			targetTokenIds,
			selections,
			endTurn,
		});

		rememberCurrentGroupAttackSelections(session);
		applyGroupAttackRollResultState({ result, endTurn });
		clearControlledTokensForCombatantIds(memberCombatantIds);

		renderGroupAttackPanel();
		scheduleActionBarRefresh('group-attack-roll-end');
	} catch (error) {
		console.error('[Nimble][MinionGrouping][TokenUI] Group attack roll failed', {
			memberCombatantIds: session.context.memberCombatantIds,
			error,
		});
		ui.notifications?.error(localizeNcsw('notifications.groupAttackFailed'));
	} finally {
		isExecutingAction = false;
		scheduleActionBarRefresh('group-attack-roll-finalize');
	}
}

interface ValidatedNonMinionAttackRoll {
	combat: CombatWithGrouping;
	member: GroupAttackMemberView;
	memberCombatantId: string;
	selectedActionId: string;
	selectedAction: MinionGroupAttackOption;
	combatant: Combatant.Implementation;
	actionsRemaining: number;
	actor: ActorWithActionItems & {
		activateItem: (id: string, options?: Record<string, unknown>) => Promise<ChatMessage | null>;
	};
}

async function resolveCombatForNonMinionAttackRoll(): Promise<CombatWithGrouping | null> {
	const combat = getCombatForCurrentScene();
	if (!combat) {
		ui.notifications?.warn(localizeNcsw('notifications.noActiveCombatForMonsterAttack'));
		return null;
	}
	if (!combat.started) {
		await combat.startCombat();
	}
	return combat;
}

function resolveNonMinionAttackMember(memberCombatantId: string): GroupAttackMemberView | null {
	return (
		activeNonMinionAttackMembers.find((candidate) => candidate.combatantId === memberCombatantId) ??
		null
	);
}

function resolveNonMinionSelectedActionId(
	memberCombatantId: string,
	memberName: string,
): string | null {
	const selectedActionId = getNonMinionActionSelectValueForMember(memberCombatantId).trim();
	if (selectedActionId) return selectedActionId;
	ui.notifications?.warn(formatNcsw('notifications.selectActionBeforeRoll', { name: memberName }));
	return null;
}

function resolveNonMinionSelectedAction(
	member: GroupAttackMemberView,
	selectedActionId: string,
): MinionGroupAttackOption | null {
	const selectedAction = member.actionOptions.find(
		(actionOption) => actionOption.actionId === selectedActionId,
	);
	if (selectedAction) return selectedAction;
	ui.notifications?.warn(
		formatNcsw('notifications.actionUnavailableForMonster', { name: member.combatantName }),
	);
	return null;
}

function resolveNonMinionAttackCombatant(
	combat: CombatWithGrouping,
	memberCombatantId: string,
	memberName: string,
): Combatant.Implementation | null {
	const combatant = combat.combatants.get(memberCombatantId) ?? null;
	if (!combatant) {
		ui.notifications?.warn(
			formatNcsw('notifications.monsterNoLongerInCombat', { name: memberName }),
		);
		return null;
	}
	if (isCombatantDead(combatant)) {
		ui.notifications?.warn(
			formatNcsw('notifications.monsterDefeatedCannotAct', { name: memberName }),
		);
		return null;
	}
	return combatant;
}

function resolveNonMinionActionsRemaining(
	combatant: Combatant.Implementation,
	memberName: string,
): number | null {
	const actionsRemaining = getCombatantActionsRemaining(combatant);
	if (actionsRemaining >= 1) return actionsRemaining;
	ui.notifications?.warn(formatNcsw('notifications.monsterNoActionsLeft', { name: memberName }));
	return null;
}

function resolveNonMinionAttackActor(
	combatant: Combatant.Implementation,
	memberName: string,
): ValidatedNonMinionAttackRoll['actor'] | null {
	const actor = (combatant.actor as unknown as ActorWithActionItems | null) ?? null;
	if (actor?.activateItem) return actor as ValidatedNonMinionAttackRoll['actor'];
	ui.notifications?.warn(
		formatNcsw('notifications.monsterCannotActivateActions', { name: memberName }),
	);
	return null;
}

async function validateNonMinionAttackRoll(
	memberCombatantId: string,
): Promise<ValidatedNonMinionAttackRoll | null> {
	const combat = await resolveCombatForNonMinionAttackRoll();
	if (!combat) return null;

	const member = resolveNonMinionAttackMember(memberCombatantId);
	if (!member) return null;
	if (!member.isSelected) {
		ui.notifications?.warn(formatNcsw('notifications.selectMonsterBeforeRoll', { name: member.combatantName }));
		return null;
	}

	const selectedActionId = resolveNonMinionSelectedActionId(
		memberCombatantId,
		member.combatantName,
	);
	if (!selectedActionId) return null;

	const selectedAction = resolveNonMinionSelectedAction(member, selectedActionId);
	if (!selectedAction) return null;

	const combatant = resolveNonMinionAttackCombatant(
		combat,
		memberCombatantId,
		member.combatantName,
	);
	if (!combatant) return null;

	const actionsRemaining = resolveNonMinionActionsRemaining(combatant, member.combatantName);
	if (actionsRemaining === null) return null;

	const actor = resolveNonMinionAttackActor(combatant, member.combatantName);
	if (!actor) return null;

	return {
		combat,
		member,
		memberCombatantId,
		selectedActionId,
		selectedAction,
		combatant,
		actionsRemaining,
		actor,
	};
}

async function executeNonMinionAttackActivation(
	validatedAttack: ValidatedNonMinionAttackRoll,
): Promise<void> {
	const activationOptions: Record<string, unknown> = { fastForward: true };
	const selectedActionRollFormula = validatedAttack.selectedAction.rollFormula?.trim() ?? '';
	if (selectedActionRollFormula.length > 0 && selectedActionRollFormula !== '-') {
		activationOptions.rollFormula = selectedActionRollFormula;
	}

	await validatedAttack.actor.activateItem(validatedAttack.selectedActionId, activationOptions);

	const latestCombatant =
		validatedAttack.combat.combatants.get(validatedAttack.memberCombatantId) ??
		validatedAttack.combatant;
	const latestActions = Number(
		(foundry.utils.getProperty(latestCombatant, 'system.actions.base.current') as number | null) ??
			validatedAttack.actionsRemaining,
	);
	if (Number.isFinite(latestActions) && latestActions > 0) {
		const actionUpdate: Record<string, unknown> = {
			_id: validatedAttack.memberCombatantId,
			'system.actions.base.current': Math.max(0, latestActions - 1),
		};
		await validatedAttack.combat.updateEmbeddedDocuments('Combatant', [actionUpdate]);
	}

	const rememberContext: MinionGroupAttackSessionContext = {
		combatId: validatedAttack.combat.id ?? '',
		memberCombatantIds: activeNonMinionAttackMembers.map((member) => member.combatantId),
	};
	rememberMemberActionSelection(
		rememberedGroupAttackSelectionsByActorType,
		rememberContext,
		validatedAttack.member.actorType,
		validatedAttack.selectedActionId,
	);
}

async function maybeAdvanceTurnAfterNonMinionAttack(
	validatedAttack: ValidatedNonMinionAttackRoll,
	endTurn: boolean,
): Promise<void> {
	if (!endTurn) return;

	const activeCombatantId = validatedAttack.combat.combatant?.id ?? null;
	if (activeCombatantId !== validatedAttack.memberCombatantId) return;
	await validatedAttack.combat.nextTurn();
}

async function executeNonMinionAttackRoll(
	memberCombatantId: string,
	endTurn: boolean,
): Promise<void> {
	if (isExecutingAction) return;

	const validatedAttack = await validateNonMinionAttackRoll(memberCombatantId);
	if (!validatedAttack) return;

	isExecutingAction = true;
	scheduleActionBarRefresh('monster-attack-roll-start');
	try {
		await executeNonMinionAttackActivation(validatedAttack);
		await maybeAdvanceTurnAfterNonMinionAttack(validatedAttack, endTurn);
		clearControlledTokensForCombatantIds([validatedAttack.memberCombatantId]);
		scheduleActionBarRefresh('monster-attack-roll-end');
	} catch (error) {
		console.error('[Nimble][MinionGrouping][TokenUI] Monster attack roll failed', {
			memberCombatantId: validatedAttack.memberCombatantId,
			selectedActionId: validatedAttack.selectedActionId,
			error,
		});
		ui.notifications?.error(localizeNcsw('notifications.monsterAttackFailed'));
	} finally {
		isExecutingAction = false;
		scheduleActionBarRefresh('monster-attack-roll-finalize');
	}
}

function canUseNcswPanel(context: SelectionContext): boolean {
	return (
		Boolean(game.user?.isGM) &&
		Boolean(canvas?.ready) &&
		isNcswCombatStateEnabled(context.combat) &&
		isNcswSidebarModeActive()
	);
}

function syncNonMinionPanelState(combat: CombatWithGrouping, context: SelectionContext): void {
	const nonMinionRows = getNonMinionAttackMembers(context);
	const nonMinionSyncContext: MinionGroupAttackSessionContext = {
		combatId: combat.id ?? '',
		memberCombatantIds: nonMinionRows.map((row) => row.member.combatantId),
	};
	const syncedNonMinionRows = buildNonMinionSelectionSync(
		nonMinionSyncContext,
		nonMinionRows,
		activeNonMinionAttackSelectionsByMemberId,
	);
	activeNonMinionAttackMembers = syncedNonMinionRows.nextMembers;
	activeNonMinionAttackSelectionsByMemberId = syncedNonMinionRows.nextSelectionsByMemberId;
}

function syncMinionPanelState(combat: CombatWithGrouping, context: SelectionContext): boolean {
	const minionMemberRows =
		context.allAliveMinionCombatantIds.length >= 1 ? getGroupAttackMembers(combat, context) : [];
	const hasMinionSession = minionMemberRows.length >= 1;
	if (!hasMinionSession) {
		activeGroupAttackSession = null;
		activeGroupAttackMembers = [];
		return false;
	}

	const sessionContext: MinionGroupAttackSessionContext = {
		combatId: combat.id ?? '',
		memberCombatantIds: minionMemberRows.map((row) => row.member.combatantId),
	};
	const syncedSession = buildSessionSyncForMembers(
		sessionContext,
		minionMemberRows,
		activeGroupAttackSession,
	);
	activeGroupAttackSession = syncedSession.nextSession;
	activeGroupAttackMembers = syncedSession.nextMembers;
	return true;
}

function syncNcswPanel(context: SelectionContext): void {
	if (!canUseNcswPanel(context) || !context.combat) {
		hideGroupAttackPanel({ clearTargets: isNcswSidebarModeActive() });
		scheduleActionWindowRefresh(null);
		return;
	}

	syncNonMinionPanelState(context.combat, context);
	syncMinionPanelState(context.combat, context);
	pruneExpandedMemberAccordions();
	activeGroupAttackWarnings = [];
	renderGroupAttackPanel();
	scheduleActionWindowRefresh(context);
}

function scheduleActionBarRefresh(source = 'unknown'): void {
	if (refreshScheduled) return;
	refreshScheduled = true;
	logTokenUi('Scheduling action bar refresh', { source });

	setTimeout(() => {
		refreshScheduled = false;
		logTokenUi('Running action bar refresh', { source });
		syncNcswPanel(buildSelectionContext());
	}, 0);
}

function registerHook(event: string, callback: (...args: unknown[]) => unknown): void {
	const hookId = (
		Hooks.on as (eventName: string, cb: (...args: unknown[]) => unknown) => number
	).call(Hooks, event, callback);
	hookIds.push({ hook: event, id: hookId });
}

function isNcswCombatStateEnabled(combat: CombatWithGrouping | null | undefined): boolean {
	return Boolean(combat && (combat.active || combat.started));
}

export function unregisterMinionGroupTokenActions(): void {
	stopGroupAttackPanelDragTracking();
	if (windowResizeHandler) {
		window.removeEventListener('resize', windowResizeHandler);
		windowResizeHandler = null;
	}
	if (actionWindowPointerMoveHandler) {
		window.removeEventListener('pointermove', actionWindowPointerMoveHandler);
		actionWindowPointerMoveHandler = null;
	}
	for (const { hook, id } of hookIds) {
		Hooks.off(hook as Hooks.HookName, id);
	}
	hookIds = [];
	hideGroupAttackPanel();
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
	if (actionWindowElement?.parentElement) {
		actionWindowElement.parentElement.removeChild(actionWindowElement);
	}
	clearGroupAttackTargetPopoverRefreshInterval();
	minionGroupAttackPanelElement = null;
	groupAttackTargetPopoverElement = null;
	groupAttackActionDescriptionPopoverElement = null;
	groupAttackImagePopoverElement = null;
	actionWindowElement = null;
	didRegisterMinionGroupTokenActions = false;
	isExecutingAction = false;
	refreshScheduled = false;
	clearActionWindowRefreshHandle();
	pendingActionWindowContext = null;
	actionWindowLastPointerPosition = null;
	actionWindowLastSelectionSignature = '';
	actionWindowSuppressedSelectionSignature = null;
	actionWindowDraftSelectionsBySectionKey.clear();
	expandedMemberCombatantIds.clear();
	activeGroupAttackSession = null;
	activeGroupAttackMembers = [];
	activeGroupAttackWarnings = [];
	groupAttackPanelPosition = null;
	ncswDockHostElement = null;
	ncswSidebarViewMode = 'combatTracker';
	ncswTokenSelectionBypassTokenIds.clear();
	ncswMapSelectorState.players = true;
	ncswMapSelectorState.monsters = true;
	ncswMapSelectorState.minions = true;
}

export default function registerMinionGroupTokenActions(): void {
	if (didRegisterMinionGroupTokenActions) return;
	didRegisterMinionGroupTokenActions = true;
	(globalThis as Record<string, unknown>).__nimbleMinionGroupTokenActionsRegistered = true;
	logTokenUi('registerMinionGroupTokenActions invoked');
	hideGroupAttackPanel({ clearTargets: false });

	windowResizeHandler = () => {
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
	actionWindowPointerMoveHandler = (event) => {
		actionWindowLastPointerPosition = { x: event.clientX, y: event.clientY };
	};
	window.addEventListener('pointermove', actionWindowPointerMoveHandler, { passive: true });

	registerHook('canvasReady', () => scheduleActionBarRefresh('canvasReady'));
	registerHook('canvasTearDown', () => hideGroupAttackPanel());
	registerHook('controlToken', (token, controlled) => handleControlTokenHook(token, controlled));
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
