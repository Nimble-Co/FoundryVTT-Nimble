import {
	getNcswEnabled,
	getPersistedNcswSidebarViewMode,
	isNcswSidebarViewModeSettingRegistered,
	NCSW_ENABLED_SETTING_CHANGED_EVENT_NAME,
	type NcswSidebarViewMode,
	setPersistedNcswSidebarViewMode,
} from '../settings/ncswSettings.js';
import {
	flattenActivationEffects,
	getUnsupportedActivationEffectTypes,
} from '../utils/activationEffects.js';
import { getCombatantImage } from '../utils/combatantImage.js';
import {
	consumeCombatantAction,
	getCombatantCurrentActions,
	maybeAdvanceTurnForCombatant,
} from '../utils/combatTurnActions.js';
import { isCombatantDead } from '../utils/isCombatantDead.js';
import {
	createMinionGroupAttackSelectionState,
	deriveDefaultMemberActionSelection,
	type MinionGroupAttackOption,
	type MinionGroupAttackSelectionState,
	type MinionGroupAttackSessionContext,
	rememberMemberActionSelection,
} from '../utils/minionGroupAttackSession.js';
import { isMinionCombatant } from '../utils/minionGrouping.js';

const NCSW_PANEL_ID = 'nimble-minion-group-attack-panel';
const MINION_GROUP_TOKEN_UI_DEBUG_ENABLED_KEY = 'NIMBLE_ENABLE_GROUP_TOKEN_UI_LOGS';
const MINION_GROUP_TOKEN_UI_DEBUG_DISABLED_KEY = 'NIMBLE_DISABLE_GROUP_TOKEN_UI_LOGS';
const NCSW_PANEL_VIEWPORT_MARGIN_PX = 8;
const NCSW_PANEL_MIN_WIDTH_REM = 20;
const NCSW_PANEL_MAX_TARGETS_PER_ROW = 4;
const NCSW_I18N_PREFIX = 'NIMBLE.nimbleCombatSystemWindow';
const NCSW_SCENE_TOGGLE_TOOL_NAME = 'nimble-ncsw-toggle';
const NCSW_SCENE_TOGGLE_ICON_CLASSES = 'fa-solid fa-crosshairs';
const NCSW_SCENE_TOGGLE_DOM_OWNED_ATTRIBUTE = 'data-nimble-ncsw-owned';
const NCSW_SCENE_TOGGLE_DOM_BOUND_ATTRIBUTE = 'data-nimble-ncsw-bound';
const FONT_AWESOME_BASE_CLASSES = new Set([
	'fa',
	'fas',
	'far',
	'fab',
	'fal',
	'fat',
	'fad',
	'fa-solid',
	'fa-regular',
	'fa-brands',
	'fa-light',
	'fa-thin',
	'fa-duotone',
]);

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
let sceneControlsRefreshHandle: ReturnType<typeof setTimeout> | null = null;
let ncswSidebarViewMode: NcswSidebarViewMode = 'ncs';
let hasInitializedNcswSidebarViewMode = false;
const rememberedGroupAttackSelectionsByActorType = new Map<string, string>();

type HookRegistration = { hook: string; id: number };
let hookIds: HookRegistration[] = [];

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
	selectedTokenCount: number;
	selectedAliveNonMinionMonsters: Combatant.Implementation[];
	selectedMinionCombatantIds: string[];
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

interface SceneControlToolLike {
	name?: string;
	order?: number;
	title?: string;
	icon?: string;
	button?: boolean;
	toggle?: boolean;
	active?: boolean;
	visible?: boolean;
	onClick?: (toggled?: boolean) => void;
	onChange?: (event: Event, toggled: boolean) => void;
}

type SceneControlToolsLike = SceneControlToolLike[] | Record<string, SceneControlToolLike>;

interface SceneControlLike {
	name?: string;
	tools?: SceneControlToolsLike;
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

function toTrimmedString(value: string | null | undefined): string {
	return value?.trim() ?? '';
}

function firstNonEmptyTrimmed(values: Array<string | null | undefined>): string | null {
	for (const value of values) {
		const normalized = toTrimmedString(value);
		if (normalized.length > 0) return normalized;
	}
	return null;
}

function isTokenUiDebugEnabled(): boolean {
	const globals = globalThis as Record<string, unknown>;
	return (
		Boolean(game.user?.isGM) &&
		globals[MINION_GROUP_TOKEN_UI_DEBUG_ENABLED_KEY] === true &&
		globals[MINION_GROUP_TOKEN_UI_DEBUG_DISABLED_KEY] !== true
	);
}

function ensureNcswSidebarViewModeInitialized(): void {
	if (hasInitializedNcswSidebarViewMode) return;
	if (!isNcswSidebarViewModeSettingRegistered()) return;
	ncswSidebarViewMode = getPersistedNcswSidebarViewMode();
	hasInitializedNcswSidebarViewMode = true;
}

function logTokenUi(message: string, details: Record<string, unknown> = {}): void {
	if (!isTokenUiDebugEnabled()) return;
	console.info(`[Nimble][MinionGrouping][TokenUI] ${message}`, details);
}

function isNcswSidebarModeActive(): boolean {
	ensureNcswSidebarViewModeInitialized();
	return ncswSidebarViewMode === 'ncs';
}

export function getNcswSidebarViewMode(): NcswSidebarViewMode {
	ensureNcswSidebarViewModeInitialized();
	return ncswSidebarViewMode;
}

export function hideNcswPanel(): void {
	hideGroupAttackPanel();
}

export function setNcswSidebarViewMode(mode: NcswSidebarViewMode): void {
	ensureNcswSidebarViewModeInitialized();
	if (ncswSidebarViewMode === mode) return;
	ncswSidebarViewMode = mode;
	hasInitializedNcswSidebarViewMode = true;
	void setPersistedNcswSidebarViewMode(mode).catch((error) => {
		console.error('[Nimble][MinionGrouping][TokenUI] Failed to persist NCSW sidebar mode', {
			mode,
			error,
		});
	});
	hideGroupAttackPanel();
	if (didRegisterMinionGroupTokenActions) {
		scheduleActionBarRefresh('setNcswSidebarViewMode');
		scheduleSceneControlsRefresh('setNcswSidebarViewMode');
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

function resolveSelectedNonPlayerCombatants(
	selectedCombatants: Combatant.Implementation[],
): Combatant.Implementation[] {
	return selectedCombatants.filter((combatant) => combatant.type !== 'character');
}

function resolveSelectedAliveNonMinionMonsters(
	selectedNonPlayerCombatants: Combatant.Implementation[],
): Combatant.Implementation[] {
	return selectedNonPlayerCombatants.filter(
		(combatant) => !isMinionCombatant(combatant) && !isCombatantDead(combatant),
	);
}

function resolveSelectedMinionCombatantIds(
	selectedNonPlayerCombatants: Combatant.Implementation[],
): string[] {
	return [
		...new Set(
			selectedNonPlayerCombatants
				.filter((combatant) => isMinionCombatant(combatant) && !isCombatantDead(combatant))
				.map((combatant) => combatant.id)
				.filter((combatantId): combatantId is string => typeof combatantId === 'string'),
		),
	];
}

function buildSelectionContext(): SelectionContext {
	const combat = getCombatForCurrentScene();
	const selectedTokens = (canvas?.tokens?.controlled ?? []) as Token[];
	const selectedTokenCount = selectedTokens.length;
	const combatantsByTokenId = buildCombatantsByTokenId({
		combat,
		sceneId: canvas.scene?.id,
	});
	const selectedCombatants = resolveSelectedCombatants(selectedTokens, combatantsByTokenId);
	const selectedNonPlayerCombatants = resolveSelectedNonPlayerCombatants(selectedCombatants);

	return {
		combat,
		selectedTokenCount,
		selectedAliveNonMinionMonsters: resolveSelectedAliveNonMinionMonsters(
			selectedNonPlayerCombatants,
		),
		selectedMinionCombatantIds: resolveSelectedMinionCombatantIds(selectedNonPlayerCombatants),
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

function getSceneFriendlyAndCharacterTokens(): Token[] {
	const placeables = (canvas?.tokens?.placeables ?? []) as Token[];
	return placeables.filter((token) => isEligibleTargetToken(token));
}

function getCandidateTargetTokens(): Token[] {
	const controlledTokens = (canvas?.tokens?.controlled ?? []) as Token[];
	const candidateTokensById = new Map<string, Token>();
	for (const token of [
		...controlledTokens,
		...getCurrentUserTargetTokens(),
		...getSceneFriendlyAndCharacterTokens(),
	]) {
		const tokenId = getTargetTokenId(token);
		if (!tokenId || candidateTokensById.has(tokenId)) continue;
		candidateTokensById.set(tokenId, token);
	}
	return [...candidateTokensById.values()];
}

function isFriendlyDispositionToken(token: Token): boolean {
	// @ts-expect-error -- Token.disposition is not in the FoundryVTT type stubs but exists at runtime
	const disposition = Number(token.document?.disposition ?? token.disposition);
	return disposition === CONST.TOKEN_DISPOSITIONS.FRIENDLY;
}

function isEligibleTargetToken(token: Token): boolean {
	const actorType = (token.actor?.type ?? token.document?.actor?.type ?? '').trim().toLowerCase();
	if (actorType === 'character') return true;
	return isFriendlyDispositionToken(token);
}

function resolveTargetTokenImage(token: Token): string {
	return (
		(token.document?.texture?.src ?? token.actor?.img ?? '').trim() || 'icons/svg/mystery-man.svg'
	);
}

function resolveTargetTokenName(token: Token): string {
	return (
		token.document?.name?.trim() ||
		token.name?.trim() ||
		token.actor?.name?.trim() ||
		localizeNcsw('targets.playerFallback')
	);
}

function buildTargetTokenView(
	token: Token,
	selectedTargetIds: ReadonlySet<string>,
): TargetTokenView | null {
	if (!isEligibleTargetToken(token)) return null;
	const tokenId = getTargetTokenId(token);
	if (!tokenId) return null;

	const vitalStats = getTargetTokenVitalStats(token);
	return {
		token,
		tokenId,
		name: resolveTargetTokenName(token),
		image: resolveTargetTokenImage(token),
		isTargeted: selectedTargetIds.has(tokenId),
		hpCurrent: vitalStats.hpCurrent,
		hpMax: vitalStats.hpMax,
		wounds: vitalStats.wounds,
	};
}

function getAvailablePlayerTargetTokens(): TargetTokenView[] {
	const selectedTargetIds = new Set(getUniqueTargetTokenIds(getCurrentUserTargetTokens()));
	return getCandidateTargetTokens()
		.map((token) => buildTargetTokenView(token, selectedTargetIds))
		.filter((row): row is TargetTokenView => row !== null);
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

	const existingElement = document.getElementById(NCSW_PANEL_ID) as HTMLDivElement | null;
	if (existingElement) {
		minionGroupAttackPanelElement = existingElement;
		return existingElement;
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
	if (options.clearTargets === true) {
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
	return getCombatantCurrentActions(combatant);
}

function buildAttackMemberViewFromCombatant(
	combatant: Combatant.Implementation,
	defaults: { actorType: string; name: string },
): GroupAttackMemberView | null {
	const combatantId = combatant.id ?? '';
	if (!combatantId) return null;

	const actor = (combatant.actor as unknown as ActorWithActionItems | null) ?? null;
	return {
		combatantId,
		combatantName: combatant.name?.trim() || combatant.token?.name || defaults.name,
		memberImage: getCombatantRowImage(combatant),
		actorType: actor?.type?.trim()?.toLowerCase() || defaults.actorType,
		actionsRemaining: getCombatantActionsRemaining(combatant),
		actionOptions: buildGroupAttackActionOptions(actor),
	};
}

function buildAttackMemberRow(
	combatant: Combatant.Implementation,
	defaults: { actorType: string; name: string },
): { combatant: Combatant.Implementation; member: GroupAttackMemberView } | null {
	const member = buildAttackMemberViewFromCombatant(combatant, defaults);
	return member ? { combatant, member } : null;
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
	const rows: Array<{ combatant: Combatant.Implementation; member: GroupAttackMemberView }> = [];
	for (const combatantId of context.selectedMinionCombatantIds) {
		const combatant = resolveGroupAttackMinionCombatant(combat, combatantId);
		if (!combatant) continue;

		const row = buildAttackMemberRow(combatant, {
			actorType: 'minion',
			name: 'Minion',
		});
		if (row) rows.push(row);
	}
	return rows;
}

function getSelectedNonMinionAttackMembers(
	context: SelectionContext,
): Array<{ combatant: Combatant.Implementation; member: GroupAttackMemberView }> {
	const rows: Array<{ combatant: Combatant.Implementation; member: GroupAttackMemberView }> = [];
	for (const combatant of context.selectedAliveNonMinionMonsters) {
		const row = buildAttackMemberRow(combatant, {
			actorType: 'npc',
			name: 'Monster',
		});
		if (row) rows.push(row);
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

function resetGroupAttackPanelForRender(panel: HTMLDivElement): void {
	panel.hidden = false;
	hideGroupAttackTargetPopover();
	hideGroupAttackActionDescriptionPopover();
	hideGroupAttackImagePopover();
	panel.replaceChildren();
	panel.style.removeProperty('width');
}

function closeNcswPanel(): void {
	setNcswSidebarViewMode('combatTracker');
}

function renderGroupAttackPanelHeader(panel: HTMLDivElement): void {
	const header = document.createElement('div');
	header.className = 'nimble-minion-group-attack-panel__header';
	header.title = localizeNcsw('tooltips.dragToMove');
	header.addEventListener('pointerdown', handleGroupAttackPanelDragStart);

	const title = document.createElement('h3');
	title.className = 'nimble-minion-group-attack-panel__title';
	title.textContent = localizeNcsw('title');

	const closeButton = document.createElement('button');
	closeButton.type = 'button';
	closeButton.className = 'nimble-minion-group-attack-panel__close-button';
	closeButton.ariaLabel = localizeNcsw('buttons.close');
	closeButton.title = localizeNcsw('buttons.close');
	const closeIcon = document.createElement('i');
	closeIcon.className = 'fa-solid fa-xmark';
	closeIcon.ariaHidden = 'true';
	closeButton.append(closeIcon);
	closeButton.addEventListener('pointerdown', (event) => {
		event.stopPropagation();
	});
	closeButton.addEventListener('click', (event) => {
		event.stopPropagation();
		closeNcswPanel();
	});

	header.append(title, closeButton);
	panel.append(header);
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

function createGroupAttackMemberCell(member: GroupAttackMemberView): HTMLTableCellElement {
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

function renderGroupAttackNonMinionSection(panel: HTMLDivElement, hasAnyTarget: boolean): void {
	appendGroupAttackSectionTitle(panel, 'monsters');

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

function renderGroupAttackMinionSection(panel: HTMLDivElement): void {
	appendGroupAttackSectionTitle(panel, 'minions');

	const table = document.createElement('table');
	table.className = 'nimble-minion-group-attack-panel__table';
	const body = document.createElement('tbody');

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
				setActionSelectValueForMember(member.combatantId, actionId);
			},
		});
		actionCell.append(select);

		const diceCell = document.createElement('td');
		diceCell.className = 'nimble-minion-group-attack-panel__dice';
		diceCell.textContent = getSelectedActionRollFormulaForMember(member);

		row.append(memberCell, actionCell, diceCell);
		body.append(row);
	}

	table.append(body);
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
		if (member.actionsRemaining < 1) return false;
		const selectedActionId = getActionSelectValueForMember(member.combatantId);
		return selectedActionId.length > 0;
	});

	resetGroupAttackPanelForRender(panel);
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
		renderGroupAttackMinionSection(panel);
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

function buildGroupAttackRollSelections(): Array<{
	memberCombatantId: string;
	actionId: string | null;
}> {
	return activeGroupAttackMembers.map((member) => ({
		memberCombatantId: member.combatantId,
		actionId: getActionSelectValueForMember(member.combatantId) || null,
	}));
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

	const selections = buildGroupAttackRollSelections();

	isExecutingAction = true;
	scheduleActionBarRefresh('group-attack-roll-start');
	try {
		const result = await combat.performMinionGroupAttack({
			memberCombatantIds: session.context.memberCombatantIds,
			targetTokenIds,
			selections,
			endTurn,
		});

		rememberCurrentGroupAttackSelections(session);
		applyGroupAttackRollResultState({ result, endTurn });

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

	if (resolveNonMinionActionsRemaining(combatant, member.combatantName) === null) return null;

	const actor = resolveNonMinionAttackActor(combatant, member.combatantName);
	if (!actor) return null;

	return {
		combat,
		member,
		memberCombatantId,
		selectedActionId,
		selectedAction,
		combatant,
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
	await consumeCombatantAction({
		combat: validatedAttack.combat,
		combatantId: validatedAttack.memberCombatantId,
		fallbackCombatant: latestCombatant,
	});

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
	await maybeAdvanceTurnForCombatant({
		combat: validatedAttack.combat,
		combatantId: validatedAttack.memberCombatantId,
		endTurn,
	});
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
		getNcswEnabled() &&
		Boolean(game.user?.isGM) &&
		Boolean(canvas?.ready) &&
		isNcswCombatStateEnabled(context.combat) &&
		isNcswSidebarModeActive()
	);
}

function syncNonMinionPanelState(combat: CombatWithGrouping, context: SelectionContext): void {
	const nonMinionRows = getSelectedNonMinionAttackMembers(context);
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
		context.selectedMinionCombatantIds.length >= 1 ? getGroupAttackMembers(combat, context) : [];
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
		hideGroupAttackPanel();
		return;
	}

	syncNonMinionPanelState(context.combat, context);
	syncMinionPanelState(context.combat, context);
	activeGroupAttackWarnings = [];
	renderGroupAttackPanel();
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

function scheduleSceneControlsRefresh(source = 'unknown'): void {
	if (sceneControlsRefreshHandle) return;
	logTokenUi('Scheduling scene controls refresh', { source });
	sceneControlsRefreshHandle = setTimeout(() => {
		sceneControlsRefreshHandle = null;
		const controls = ui.controls as unknown as {
			render?: (force?: boolean) => void;
		};
		if (typeof controls.render === 'function') controls.render(true);
		setTimeout(() => syncNcswSceneToggleDomTool(), 0);
	}, 0);
}

function getCombatForNcswSceneToggleVisibility(): CombatWithGrouping | null {
	return getCombatForCurrentScene();
}

function getNcswSceneToggleTitle(isActive: boolean): string {
	return isActive ? 'Hide NCSW' : 'Show NCSW';
}

function toggleNcswSceneControl(toggled?: boolean): void {
	const shouldShowNcsw = typeof toggled === 'boolean' ? toggled : !isNcswSidebarModeActive();
	setNcswSidebarViewMode(shouldShowNcsw ? 'ncs' : 'combatTracker');
}

function buildNcswSceneToggleTool(): SceneControlToolLike {
	const isActive = isNcswSidebarModeActive();
	return {
		name: NCSW_SCENE_TOGGLE_TOOL_NAME,
		title: getNcswSceneToggleTitle(isActive),
		icon: NCSW_SCENE_TOGGLE_ICON_CLASSES,
		toggle: true,
		active: isActive,
		visible: true,
		onClick: toggleNcswSceneControl,
		onChange: (_event, toggled) => toggleNcswSceneControl(toggled),
	};
}

function isUnconstrainedMovementTool(tool: SceneControlToolLike | null | undefined): boolean {
	const toolName = (tool?.name ?? '').trim().toLowerCase();
	const toolTitle = (tool?.title ?? '').trim().toLowerCase();
	return (
		toolName.includes('unconstrained') ||
		toolTitle.includes('unconstrained') ||
		toolTitle.includes('movement')
	);
}

function getSceneControlToolsList(
	tools: SceneControlToolsLike | undefined,
): SceneControlToolLike[] {
	if (!tools) return [];
	return Array.isArray(tools) ? tools : Object.values(tools);
}

function findSceneControlForNcswToggle(sceneControls: SceneControlLike[]): SceneControlLike | null {
	const tokenControl =
		sceneControls.find((sceneControl) => {
			const controlName = (sceneControl.name ?? '').trim().toLowerCase();
			return controlName === 'token' || controlName === 'tokens';
		}) ?? null;
	if (tokenControl) return tokenControl;

	return (
		sceneControls.find((sceneControl) => {
			const tools = getSceneControlToolsList(sceneControl.tools);
			return tools.some((tool) => isUnconstrainedMovementTool(tool));
		}) ?? null
	);
}

function removeNcswSceneToggleTool(tools: SceneControlToolsLike): void {
	if (Array.isArray(tools)) {
		const existingToolIndex = tools.findIndex((tool) => tool?.name === NCSW_SCENE_TOGGLE_TOOL_NAME);
		if (existingToolIndex >= 0) tools.splice(existingToolIndex, 1);
		return;
	}

	for (const [toolKey, tool] of Object.entries(tools)) {
		if (toolKey !== NCSW_SCENE_TOGGLE_TOOL_NAME && tool?.name !== NCSW_SCENE_TOGGLE_TOOL_NAME)
			continue;
		delete tools[toolKey];
	}
}

function resolveNcswSceneToggleOrder(tools: SceneControlToolLike[]): number {
	const unconstrainedMovementTool = tools.find((tool) => isUnconstrainedMovementTool(tool));
	const unconstrainedMovementOrder =
		typeof unconstrainedMovementTool?.order === 'number' ? unconstrainedMovementTool.order : null;
	if (unconstrainedMovementOrder !== null) return unconstrainedMovementOrder + 0.1;

	const orderedTools = tools.filter((tool) => typeof tool?.order === 'number');
	if (orderedTools.length < 1) return tools.length + 1;
	return Math.max(...orderedTools.map((tool) => tool.order ?? 0)) + 1;
}

function isNcswSceneToggleVisible(): boolean {
	if (!getNcswEnabled()) return false;
	const combat = getCombatForNcswSceneToggleVisibility();
	return Boolean(game.user?.isGM) && isNcswCombatStateEnabled(combat);
}

function upsertNcswSceneToggleToolCollection(tools: SceneControlToolsLike): void {
	const toggleTool = buildNcswSceneToggleTool();
	if (Array.isArray(tools)) {
		const existingToolIndex = tools.findIndex((tool) => tool?.name === NCSW_SCENE_TOGGLE_TOOL_NAME);
		if (existingToolIndex >= 0) {
			tools[existingToolIndex] = {
				...tools[existingToolIndex],
				...toggleTool,
			};
			return;
		}

		const unconstrainedMovementIndex = tools.findIndex((tool) => isUnconstrainedMovementTool(tool));
		if (unconstrainedMovementIndex >= 0) {
			tools.splice(unconstrainedMovementIndex + 1, 0, toggleTool);
			return;
		}
		tools.push(toggleTool);
		return;
	}

	const existingEntry =
		tools[NCSW_SCENE_TOGGLE_TOOL_NAME] ??
		Object.values(tools).find((tool) => tool?.name === NCSW_SCENE_TOGGLE_TOOL_NAME) ??
		null;
	tools[NCSW_SCENE_TOGGLE_TOOL_NAME] = {
		...existingEntry,
		...toggleTool,
		order: resolveNcswSceneToggleOrder(Object.values(tools)),
	};
}

function upsertNcswSceneToggleTool(sceneControls: unknown): void {
	if (!Array.isArray(sceneControls)) return;

	const tokenControl = findSceneControlForNcswToggle(sceneControls as SceneControlLike[]);
	const tools = tokenControl?.tools;
	if (!tools) return;

	if (!isNcswSceneToggleVisible()) {
		removeNcswSceneToggleTool(tools);
		return;
	}
	upsertNcswSceneToggleToolCollection(tools);
}

function resolveSceneControlsRootElement(): HTMLElement | null {
	const controlsElement = (ui.controls as unknown as { element?: unknown })?.element;
	if (controlsElement instanceof HTMLElement) return controlsElement;
	const jqueryLikeControlsElement = controlsElement as
		| { length?: number; [index: number]: unknown }
		| undefined;
	const jqueryFirstElement = jqueryLikeControlsElement?.[0];
	if (jqueryFirstElement instanceof HTMLElement) return jqueryFirstElement;

	return (
		document.querySelector<HTMLElement>('#scene-controls') ??
		document.querySelector<HTMLElement>('#controls')
	);
}

function getSceneToolElementLabel(element: HTMLElement): string {
	const explicitLabel =
		element.dataset.tooltip ??
		element.getAttribute('aria-label') ??
		element.getAttribute('title') ??
		'';
	return explicitLabel.trim().toLowerCase();
}

function getSceneToolElementIdentifier(element: HTMLElement): string {
	return firstNonEmptyTrimmed([element.dataset.tool, element.dataset.action])?.toLowerCase() ?? '';
}

function isSceneToolListElement(element: HTMLElement): boolean {
	return element.matches('.sub-controls, .control-tools, ol, ul, #controls, #scene-controls');
}

function hasSceneToolElementMarkers(element: HTMLElement): boolean {
	if (getSceneToolElementIdentifier(element).length > 0) return true;
	if (element.matches('.control-tool, [role="button"], button, a')) return true;
	const interactiveElement = element.querySelector<HTMLElement>('button, a, [role="button"]');
	if (!interactiveElement) return false;
	if (getSceneToolElementIdentifier(interactiveElement).length > 0) return true;
	if (interactiveElement.matches('.control-tool')) return true;
	const interactiveLabel = getSceneToolElementLabel(interactiveElement);
	const hasLabel = interactiveLabel.length > 0;
	const hasIcon = interactiveElement.querySelector('i, svg') !== null;
	return hasLabel && hasIcon;
}

function resolveSceneControlDomToolSlotElement(element: HTMLElement): HTMLElement {
	const listItemSlot = (element.closest('li') as HTMLElement | null) ?? null;
	if (listItemSlot) return listItemSlot;

	const interactiveSlot =
		(element.closest(
			'button.control-tool,a.control-tool,button[data-tool],a[data-tool],button[data-action],a[data-action]',
		) as HTMLElement | null) ?? null;
	if (interactiveSlot) return interactiveSlot;

	return element;
}

function getSceneControlDomToolSlotElements(root: ParentNode): HTMLElement[] {
	if (root instanceof HTMLElement && isSceneToolListElement(root)) {
		const directChildren = [...root.children].filter(
			(child): child is HTMLElement => child instanceof HTMLElement,
		);
		const markedChildren = directChildren
			.map((child) => resolveSceneControlDomToolSlotElement(child))
			.filter((child) => hasSceneToolElementMarkers(child));
		if (markedChildren.length > 0) return markedChildren;
		return directChildren.map((child) => resolveSceneControlDomToolSlotElement(child));
	}

	const slotElements = new Set<HTMLElement>();
	const listElements = [
		...root.querySelectorAll<HTMLElement>('.sub-controls, .control-tools, ol, ul'),
	];
	for (const listElement of listElements) {
		for (const slotElement of getSceneControlDomToolSlotElements(listElement)) {
			slotElements.add(slotElement);
		}
	}
	return [...slotElements];
}

function resolveNcswDomToolInteractiveElement(toolElement: HTMLElement): HTMLElement {
	return toolElement.querySelector<HTMLElement>('button, a') ?? toolElement;
}

function isUnconstrainedMovementDomToolElement(element: HTMLElement): boolean {
	const interactiveElement = resolveNcswDomToolInteractiveElement(element);
	const toolIdentifier = firstNonEmptyTrimmed([
		getSceneToolElementIdentifier(element),
		getSceneToolElementIdentifier(interactiveElement),
	]);
	const toolLabel = firstNonEmptyTrimmed([
		getSceneToolElementLabel(element),
		getSceneToolElementLabel(interactiveElement),
	]);
	const normalizedIdentifier = toolIdentifier?.toLowerCase() ?? '';
	const normalizedLabel = toolLabel?.toLowerCase() ?? '';
	return (
		normalizedIdentifier.includes('unconstrained') ||
		normalizedIdentifier.includes('free') ||
		normalizedLabel.includes('unconstrained movement') ||
		normalizedLabel.includes('unconstrained')
	);
}

function findUnconstrainedMovementDomToolElement(root: ParentNode): HTMLElement | null {
	return (
		getSceneControlDomToolSlotElements(root).find((toolElement) =>
			isUnconstrainedMovementDomToolElement(toolElement),
		) ?? null
	);
}

function getSceneControlDomToolListCandidates(root: ParentNode): HTMLElement[] {
	const candidates = new Set<HTMLElement>();
	if (root instanceof HTMLElement && isSceneToolListElement(root)) candidates.add(root);
	const queryRoot = root as Document | Element | DocumentFragment;
	for (const toolList of queryRoot.querySelectorAll<HTMLElement>(
		'.sub-controls, .control-tools, ol, ul',
	)) {
		candidates.add(toolList);
	}
	return [...candidates];
}

function getSceneControlDomAnchorCandidates(root: ParentNode): HTMLElement[] {
	const queryRoot = root as Document | Element | DocumentFragment;
	return [
		...queryRoot.querySelectorAll<HTMLElement>(
			'button, a, [role="button"], [data-tool], [data-action], [data-tooltip], [aria-label], [title]',
		),
	];
}

interface NcswDomAnchorContext {
	toolList: HTMLElement;
	anchorSlot: HTMLElement;
}

function findUnconstrainedMovementDomAnchorContext(root: ParentNode): NcswDomAnchorContext | null {
	for (const toolList of getSceneControlDomToolListCandidates(root)) {
		const unconstrainedTool = findUnconstrainedMovementDomToolElement(toolList);
		if (!unconstrainedTool) continue;
		const anchorSlot =
			resolveDirectChildForInsertion(toolList, unconstrainedTool) ?? unconstrainedTool;
		return {
			toolList,
			anchorSlot,
		};
	}

	for (const anchorCandidate of getSceneControlDomAnchorCandidates(root)) {
		const anchorSlot = resolveSceneControlDomToolSlotElement(anchorCandidate);
		if (
			!isUnconstrainedMovementDomToolElement(anchorCandidate) &&
			!isUnconstrainedMovementDomToolElement(anchorSlot)
		) {
			continue;
		}
		const toolList =
			(anchorSlot.parentElement as HTMLElement | null) ??
			(anchorCandidate.parentElement as HTMLElement | null) ??
			null;
		if (!toolList) continue;
		return {
			toolList,
			anchorSlot: resolveDirectChildForInsertion(toolList, anchorSlot) ?? anchorSlot,
		};
	}
	return null;
}

function findOwnedNcswDomToolElements(root: ParentNode): HTMLElement[] {
	const queryRoot = root as Document | Element | DocumentFragment;
	return [
		...queryRoot.querySelectorAll<HTMLElement>(`[${NCSW_SCENE_TOGGLE_DOM_OWNED_ATTRIBUTE}="true"]`),
	];
}

function isRenderedNcswDomToolElement(toolElement: HTMLElement): boolean {
	const interactiveElement = resolveNcswDomToolInteractiveElement(toolElement);
	const identifiers = [
		getSceneToolElementIdentifier(toolElement),
		getSceneToolElementIdentifier(interactiveElement),
	];
	if (identifiers.includes(NCSW_SCENE_TOGGLE_TOOL_NAME)) return true;
	return Boolean(toolElement.querySelector(`[data-tool="${NCSW_SCENE_TOGGLE_TOOL_NAME}"]`));
}

function findRenderedNcswDomToolElements(root: ParentNode): HTMLElement[] {
	const queryRoot = root as Document | Element | DocumentFragment;
	const directMatches = [
		...queryRoot.querySelectorAll<HTMLElement>(`[data-tool="${NCSW_SCENE_TOGGLE_TOOL_NAME}"]`),
	].map((toolElement) => resolveSceneControlDomToolSlotElement(toolElement));
	const slotMatches = getSceneControlDomToolSlotElements(root).filter((toolElement) =>
		isRenderedNcswDomToolElement(toolElement),
	);
	return [...new Set([...directMatches, ...slotMatches])];
}

function resolveSceneControlToolListElementFromControl(
	controlElement: HTMLElement | null,
): HTMLElement | null {
	if (!controlElement) return null;
	return (
		controlElement.querySelector<HTMLElement>('.sub-controls, .control-tools, ol, ul') ??
		controlElement.closest<HTMLElement>('.sub-controls, .control-tools, ol, ul')
	);
}

function resolveNcswDomToolListElement(root: HTMLElement): HTMLElement | null {
	const tokenControl = root.querySelector<HTMLElement>(
		'[data-control="token"], [data-control="tokens"]',
	);
	const tokenToolList = resolveSceneControlToolListElementFromControl(tokenControl);
	if (tokenToolList && getSceneControlDomToolSlotElements(tokenToolList).length > 0)
		return tokenToolList;

	const unconstrainedMovementAnchorContext = findUnconstrainedMovementDomAnchorContext(root);
	if (unconstrainedMovementAnchorContext) return unconstrainedMovementAnchorContext.toolList;

	const availableLists = [
		...root.querySelectorAll<HTMLElement>('.control-tools, .sub-controls, ol, ul'),
	];
	return (
		availableLists.find((list) => getSceneControlDomToolSlotElements(list).length > 0) ??
		availableLists[0] ??
		null
	);
}

function isFontAwesomeClassName(className: string): boolean {
	return FONT_AWESOME_BASE_CLASSES.has(className) || className.startsWith('fa-');
}

function removeFontAwesomeClasses(element: HTMLElement): void {
	const fontAwesomeClasses = [...element.classList].filter((className) =>
		isFontAwesomeClassName(className),
	);
	for (const className of fontAwesomeClasses) {
		element.classList.remove(className);
	}
}

function bindNcswDomToolClickHandler(toolElement: HTMLElement): void {
	const bindTarget = (target: HTMLElement) => {
		if (target.getAttribute(NCSW_SCENE_TOGGLE_DOM_BOUND_ATTRIBUTE) === 'true') return;
		target.addEventListener('click', (event) => {
			event.preventDefault();
			event.stopPropagation();
			toggleNcswSceneControl();
		});
		target.addEventListener('keydown', (event) => {
			if (event.key !== 'Enter' && event.key !== ' ') return;
			event.preventDefault();
			event.stopPropagation();
			toggleNcswSceneControl();
		});
		target.setAttribute(NCSW_SCENE_TOGGLE_DOM_BOUND_ATTRIBUTE, 'true');
	};

	const clickTarget = resolveNcswDomToolInteractiveElement(toolElement);
	bindTarget(toolElement);
	if (clickTarget !== toolElement) bindTarget(clickTarget);
}

function setNcswDomToolIdentity(toolElement: HTMLElement, title: string): void {
	const clickTarget = resolveNcswDomToolInteractiveElement(toolElement);
	const isSelfInteractive = clickTarget === toolElement;
	toolElement.setAttribute(NCSW_SCENE_TOGGLE_DOM_OWNED_ATTRIBUTE, 'true');
	toolElement.dataset.tool = NCSW_SCENE_TOGGLE_TOOL_NAME;
	toolElement.dataset.tooltip = title;
	delete toolElement.dataset.action;
	toolElement.setAttribute('title', title);
	toolElement.setAttribute('aria-label', title);
	toolElement.classList.remove('active');
	toolElement.removeAttribute('style');
	removeFontAwesomeClasses(toolElement);
	if (isSelfInteractive) {
		toolElement.classList.add('control-tool', 'toggle');
		toolElement.setAttribute('role', 'button');
		toolElement.setAttribute('tabindex', '0');
	} else {
		toolElement.removeAttribute('role');
		toolElement.removeAttribute('tabindex');
	}

	clickTarget.classList.remove('active');
	clickTarget.removeAttribute('style');
	removeFontAwesomeClasses(clickTarget);
	if (isSelfInteractive) clickTarget.classList.add('control-tool', 'toggle');
	clickTarget.dataset.tool = NCSW_SCENE_TOGGLE_TOOL_NAME;
	clickTarget.dataset.tooltip = title;
	delete clickTarget.dataset.action;
	clickTarget.setAttribute('title', title);
	clickTarget.setAttribute('aria-label', title);
	clickTarget.setAttribute('role', 'button');
	clickTarget.setAttribute('tabindex', '0');
	if (clickTarget instanceof HTMLButtonElement) clickTarget.type = 'button';
	clickTarget.style.cursor = 'pointer';
}

function ensureNcswDomToolIcon(toolElement: HTMLElement): void {
	const clickTarget = resolveNcswDomToolInteractiveElement(toolElement);
	clickTarget.replaceChildren();
	const iconElement = document.createElement('i');
	iconElement.className = NCSW_SCENE_TOGGLE_ICON_CLASSES;
	clickTarget.append(iconElement);
}

function updateNcswDomToolElementState(toolElement: HTMLElement): void {
	const isActive = getNcswSidebarViewMode() === 'ncs';
	const title = getNcswSceneToggleTitle(isActive);
	setNcswDomToolIdentity(toolElement, title);
	toolElement.classList.toggle('active', isActive);
	resolveNcswDomToolInteractiveElement(toolElement).classList.toggle('active', isActive);
	ensureNcswDomToolIcon(toolElement);
	bindNcswDomToolClickHandler(toolElement);
}

function createNcswDomToolElement(templateTool: HTMLElement | null): HTMLElement {
	if (!templateTool) {
		const toolElement = document.createElement('li');
		toolElement.className = 'control-tool';
		const clickTarget = document.createElement('button');
		clickTarget.type = 'button';
		toolElement.append(clickTarget);
		toolElement.setAttribute(NCSW_SCENE_TOGGLE_DOM_OWNED_ATTRIBUTE, 'true');
		return toolElement;
	}

	const toolElement = templateTool.cloneNode(false) as HTMLElement;
	toolElement.removeAttribute('id');
	toolElement.classList.remove('active');
	toolElement.removeAttribute('style');

	const templateClickTarget = resolveNcswDomToolInteractiveElement(templateTool);
	if (templateClickTarget !== templateTool) {
		const clickTarget = templateClickTarget.cloneNode(false) as HTMLElement;
		clickTarget.removeAttribute('id');
		clickTarget.classList.remove('active');
		clickTarget.removeAttribute('style');
		if (clickTarget instanceof HTMLButtonElement) clickTarget.type = 'button';
		toolElement.append(clickTarget);
	}
	toolElement.setAttribute(NCSW_SCENE_TOGGLE_DOM_OWNED_ATTRIBUTE, 'true');
	return toolElement;
}

function resolveDirectChildForInsertion(
	container: HTMLElement,
	element: HTMLElement,
): HTMLElement | null {
	let currentElement: HTMLElement | null = element;
	while (currentElement && currentElement.parentElement !== container) {
		currentElement = currentElement.parentElement;
	}
	return currentElement?.parentElement === container ? currentElement : null;
}

function insertNcswDomToolElement(toolList: HTMLElement, toolElement: HTMLElement): void {
	const unconstrainedTool = findUnconstrainedMovementDomToolElement(toolList);
	const unconstrainedToolSlot = unconstrainedTool
		? resolveDirectChildForInsertion(toolList, unconstrainedTool)
		: null;
	if (unconstrainedToolSlot) {
		unconstrainedToolSlot.insertAdjacentElement('afterend', toolElement);
		return;
	}
	toolList.append(toolElement);
}

function insertNcswDomToolAfterAnchorSlot(
	anchorSlot: HTMLElement,
	toolElement: HTMLElement,
): boolean {
	const parent = anchorSlot.parentElement;
	if (!(parent instanceof HTMLElement)) return false;
	anchorSlot.insertAdjacentElement('afterend', toolElement);
	return true;
}

function removeOwnedNcswDomToggleToolElements(root: ParentNode): void {
	for (const toolElement of findOwnedNcswDomToolElements(root)) {
		toolElement.remove();
	}
}

function resolveNcswDomTemplateToolSlot(toolList: HTMLElement): HTMLElement | null {
	const toolSlots = getSceneControlDomToolSlotElements(toolList);
	const templateTool = findUnconstrainedMovementDomToolElement(toolList) ?? toolSlots[0] ?? null;
	if (!templateTool) return null;
	return resolveDirectChildForInsertion(toolList, templateTool) ?? templateTool;
}

function resolveVisibleNcswDomRoot(): HTMLElement | null {
	const root = resolveSceneControlsRootElement() ?? document.body;
	if (!isNcswSceneToggleVisible()) {
		removeOwnedNcswDomToggleToolElements(document.body);
		return null;
	}
	return root;
}

function clearExistingNcswDomTools(root: ParentNode): void {
	for (const existingTool of findOwnedNcswDomToolElements(root)) {
		existingTool.remove();
	}
}

function syncNcswSceneToggleDomTool(): void {
	const root = resolveVisibleNcswDomRoot();
	if (!root) return;

	clearExistingNcswDomTools(document.body);
	if (findRenderedNcswDomToolElements(root).length > 0) return;

	const anchorContext =
		findUnconstrainedMovementDomAnchorContext(root) ??
		findUnconstrainedMovementDomAnchorContext(document.body);
	if (anchorContext) {
		clearExistingNcswDomTools(anchorContext.toolList);
		const toolElement = createNcswDomToolElement(anchorContext.anchorSlot);
		updateNcswDomToolElementState(toolElement);
		if (insertNcswDomToolAfterAnchorSlot(anchorContext.anchorSlot, toolElement)) return;
	}

	const toolList = resolveNcswDomToolListElement(root);
	if (!toolList) return;

	clearExistingNcswDomTools(toolList);
	const templateToolSlot = resolveNcswDomTemplateToolSlot(toolList);
	const toolElement = createNcswDomToolElement(templateToolSlot);
	updateNcswDomToolElementState(toolElement);
	insertNcswDomToolElement(toolList, toolElement);
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
	clearGroupAttackTargetPopoverRefreshInterval();
	minionGroupAttackPanelElement = null;
	groupAttackTargetPopoverElement = null;
	groupAttackActionDescriptionPopoverElement = null;
	groupAttackImagePopoverElement = null;
	didRegisterMinionGroupTokenActions = false;
	isExecutingAction = false;
	refreshScheduled = false;
	if (sceneControlsRefreshHandle) {
		clearTimeout(sceneControlsRefreshHandle);
		sceneControlsRefreshHandle = null;
	}
	activeGroupAttackSession = null;
	activeGroupAttackMembers = [];
	activeGroupAttackWarnings = [];
	groupAttackPanelPosition = null;
	hasInitializedNcswSidebarViewMode = false;
}

export default function registerMinionGroupTokenActions(): void {
	if (didRegisterMinionGroupTokenActions) {
		if (typeof canvas !== 'undefined' && canvas?.ready) {
			scheduleActionBarRefresh('register-repeat');
			scheduleSceneControlsRefresh('register-repeat');
		}
		return;
	}
	didRegisterMinionGroupTokenActions = true;
	(globalThis as Record<string, unknown>).__nimbleMinionGroupTokenActionsRegistered = true;
	logTokenUi('registerMinionGroupTokenActions invoked');
	ensureNcswSidebarViewModeInitialized();
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

	window.addEventListener(NCSW_ENABLED_SETTING_CHANGED_EVENT_NAME, () => {
		hideGroupAttackPanel();
		scheduleSceneControlsRefresh('ncsw-setting-disabled');
	});

	const refreshActionBarAndSceneControls = (source: string): void => {
		scheduleActionBarRefresh(source);
		scheduleSceneControlsRefresh(source);
	};

	registerHook('canvasReady', () => {
		refreshActionBarAndSceneControls('canvasReady');
	});
	registerHook('canvasTearDown', () => {
		hideGroupAttackPanel();
		scheduleSceneControlsRefresh('canvasTearDown');
	});
	registerHook('controlToken', () => scheduleActionBarRefresh('controlToken'));
	registerHook('createCombat', () => refreshActionBarAndSceneControls('createCombat'));
	registerHook('updateCombat', () => refreshActionBarAndSceneControls('updateCombat'));
	registerHook('deleteCombat', () => refreshActionBarAndSceneControls('deleteCombat'));
	registerHook('createCombatant', () => refreshActionBarAndSceneControls('createCombatant'));
	registerHook('updateCombatant', () => refreshActionBarAndSceneControls('updateCombatant'));
	registerHook('deleteCombatant', () => refreshActionBarAndSceneControls('deleteCombatant'));
	registerHook('getSceneControlButtons', (sceneControls) =>
		upsertNcswSceneToggleTool(sceneControls),
	);
	registerHook('renderSceneControls', () => {
		scheduleActionBarRefresh('renderSceneControls');
		syncNcswSceneToggleDomTool();
	});
	registerHook('activateTokenLayer', () => refreshActionBarAndSceneControls('activateTokenLayer'));
	registerHook('deactivateTokenLayer', () =>
		refreshActionBarAndSceneControls('deactivateTokenLayer'),
	);
	registerHook('updateSetting', () => scheduleActionBarRefresh('updateSetting'));

	if (typeof canvas !== 'undefined' && canvas?.ready) {
		refreshActionBarAndSceneControls('initial-ready');
	}
}
