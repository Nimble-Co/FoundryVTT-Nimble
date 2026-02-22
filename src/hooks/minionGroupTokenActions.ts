import { isCombatantDead } from '../utils/isCombatantDead.js';
import { isMinionCombatant } from '../utils/minionGrouping.js';
import { MINION_GROUPING_MODE_NCS } from '../utils/minionGroupingModes.js';
import {
	createMinionGroupAttackSelectionState,
	deriveDefaultMemberActionSelection,
	rememberMemberActionSelection,
	type MinionGroupAttackOption,
	type MinionGroupAttackSessionContext,
	type MinionGroupAttackSelectionState,
} from '../utils/minionGroupAttackSession.js';

const NCSW_PANEL_ID = 'nimble-minion-group-attack-panel';
const MINION_GROUP_TOKEN_UI_DEBUG_ENABLED_KEY = 'NIMBLE_ENABLE_GROUP_TOKEN_UI_LOGS';
const MINION_GROUP_TOKEN_UI_DEBUG_DISABLED_KEY = 'NIMBLE_DISABLE_GROUP_TOKEN_UI_LOGS';
const NCSW_PANEL_VIEWPORT_MARGIN_PX = 8;
const NCSW_PANEL_MIN_WIDTH_REM = 20;
const NCSW_PANEL_MAX_TARGETS_PER_ROW = 4;
const NCSW_LOGO_PATH = '/systems/nimble/ncsw/logos/NimbleLogos.png';
const NCS_SELECTION_ATTACK_GROUP_ID = '__nimbleNcsSelectionAttackGroup';
const NCS_SELECTION_MONSTER_ATTACK_SCOPE_ID = '__nimbleNcsSelectionMonsterAttack';
const NCSW_I18N_PREFIX = 'NIMBLE.nimbleCombatSystemWindow';

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
const rememberedGroupAttackSelectionsByActorType = new Map<string, string>();

type HookRegistration = { hook: string; id: number };
let hookIds: HookRegistration[] = [];

interface AttackableGroupSummary {
	groupId: string;
	selectedCount: number;
	selectedCombatantIds: string[];
}

type CombatWithGrouping = Combat & {
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
	selectedTokenCount: number;
	selectedAliveNonMinionMonsters: Combatant.Implementation[];
	selectedMinions: Combatant.Implementation[];
	canAttackGroups: boolean;
	attackableGroupSummaries: AttackableGroupSummary[];
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

function buildSelectionContext(): SelectionContext {
	const combat = getCombatForCurrentScene();
	const selectedTokens = canvas?.tokens?.controlled ?? [];
	const selectedTokenCount = selectedTokens.length;
	const sceneId = canvas.scene?.id;
	const selectedCombatants: Combatant.Implementation[] = [];

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
		for (const token of selectedTokens) {
			const tokenId = token.document?.id ?? token.id ?? '';
			if (!tokenId) {
				continue;
			}

			const combatant = combatantsByTokenId.get(tokenId);
			if (!combatant?.id) {
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
	const ncsSelectedAliveMinionIds = [
		...new Set(
			selectedMinions
				.filter((combatant) => !isCombatantDead(combatant))
				.map((combatant) => combatant.id)
				.filter((combatantId): combatantId is string => typeof combatantId === 'string'),
		),
	];
	const attackableGroupSummaries =
		ncsSelectedAliveMinionIds.length >= 1
			? [
					{
						groupId: NCS_SELECTION_ATTACK_GROUP_ID,
						selectedCount: ncsSelectedAliveMinionIds.length,
						selectedCombatantIds: ncsSelectedAliveMinionIds,
					},
				]
			: [];

	const canAttackGroups = Boolean(combat) && attackableGroupSummaries.length > 0;

	return {
		combat,
		selectedTokenCount,
		selectedAliveNonMinionMonsters,
		selectedMinions,
		canAttackGroups,
		attackableGroupSummaries,
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
	_combat: CombatWithGrouping,
	groupId: string,
	context: SelectionContext,
): Array<{ combatant: Combatant.Implementation; member: GroupAttackMemberView }> {
	if (groupId !== NCS_SELECTION_ATTACK_GROUP_ID) return [];

	const rows: Array<{ combatant: Combatant.Implementation; member: GroupAttackMemberView }> = [];
	for (const combatant of context.selectedMinions) {
		if (!combatant.id) continue;
		if (isCombatantDead(combatant)) continue;
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
	logo.src = NCSW_LOGO_PATH;
	logo.addEventListener('error', () => {
		logo.remove();
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
		if (groupAttackPanelPosition) {
			setGroupAttackPanelPosition(groupAttackPanelPosition);
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
		const activationOptions: Record<string, unknown> = { fastForward: true };
		const selectedActionRollFormula = selectedAction.rollFormula?.trim() ?? '';
		if (selectedActionRollFormula.length > 0 && selectedActionRollFormula !== '-') {
			activationOptions.rollFormula = selectedActionRollFormula;
		}

		await actor.activateItem(selectedActionId, activationOptions);

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

	registerHook('canvasReady', () => scheduleActionBarRefresh('canvasReady'));
	registerHook('canvasTearDown', () => hideGroupAttackPanel());
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
