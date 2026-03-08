import {
	type CombatTrackerVisibilityFieldKey,
	type CombatTrackerVisibilityPermissionConfig,
	canUserRoleAccessCombatTrackerPermission,
} from '../../../settings/combatTrackerSettings.js';
import { type ActorHealthState, getActorHealthState } from '../../../utils/actorHealthState.js';
import {
	getActorHpMaxValue,
	getActorHpValue,
	getActorManaValueAndMax,
	getActorWoundsValueAndMax,
} from '../../../utils/actorResources.js';
import { getCombatantImage } from '../../../utils/combatantImage.js';
import {
	getCombatantCurrentActions,
	getCombatantMaxActions,
} from '../../../utils/combatTurnActions.js';
import {
	getHeroicReactionAvailability,
	getHeroicReactionAvailabilityTitle,
} from '../../../utils/heroicActions.js';
import { isCombatantDead } from '../../../utils/isCombatantDead.js';
import {
	ACTION_DICE_ICON_CLASSES,
	CT_BADGE_SCALE_STEP,
	CT_CARD_SCALE_STEP,
	CT_EDGE_GUTTER_PX,
	CT_ESTIMATED_ENTRY_WIDTH_REM,
	CT_FALLBACK_SIDE_RESERVED_PX,
	CT_MAX_BADGE_SIZE_LEVEL,
	CT_MAX_CARD_SIZE_LEVEL,
	CT_MAX_WIDTH_LEVEL,
	CT_MIN_BADGE_SCALE,
	CT_MIN_BADGE_SIZE_LEVEL,
	CT_MIN_CARD_SCALE,
	CT_MIN_CARD_SIZE_LEVEL,
	CT_MIN_SAFE_TRACK_WIDTH_PX,
	CT_MIN_WIDTH_LEVEL,
	CT_MIN_WIDTH_RATIO,
	CT_VIRTUALIZATION_OVERSCAN,
	CT_WIDTH_RATIO_STEP,
	DRAG_SWITCH_LOWER_RATIO,
	DRAG_SWITCH_UPPER_RATIO,
	DRAG_TARGET_EXPANSION_REM,
	MAX_RENDERED_ACTION_DICE,
	PORTRAIT_FALLBACK_IMAGE,
} from './constants.js';
import type {
	BuildVirtualizedAliveEntriesParams,
	CombatantCardResourceChip,
	CombatantDropPreview,
	HpBadgeMode,
	HpBadgeState,
	PlayerCombatantDrawerData,
	ResolveActiveEntryKeyParams,
	ResolveNextCombatantActionsForSlotParams,
	SceneCombatantLists,
	TrackEntry,
	VirtualizedAliveEntries,
} from './types.js';

function getViewportWidthPx(): number {
	return Math.max(0, globalThis.innerWidth || document.documentElement.clientWidth || 0);
}

function getCtWidthRatio(widthLevel: number): number {
	const normalizedWidthLevel = normalizeCtWidthLevel(widthLevel);
	return CT_MIN_WIDTH_RATIO + (normalizedWidthLevel - CT_MIN_WIDTH_LEVEL) * CT_WIDTH_RATIO_STEP;
}

function getVisibleUiRect(selector: string): DOMRect | null {
	const element = document.querySelector<HTMLElement>(selector);
	if (!element) return null;
	const style = globalThis.getComputedStyle(element);
	if (style.display === 'none' || style.visibility === 'hidden') return null;
	const rect = element.getBoundingClientRect();
	if (rect.width <= 0 || rect.height <= 0) return null;
	return rect;
}

function getSafeCtTrackWidthPx(): number {
	const viewportWidth = getViewportWidthPx();
	if (viewportWidth <= 0) return CT_MIN_SAFE_TRACK_WIDTH_PX;

	const leftUiRect = getVisibleUiRect('#ui-left');
	const rightUiRect = getVisibleUiRect('#ui-right');
	const leftInset = leftUiRect
		? Math.max(0, leftUiRect.right + CT_EDGE_GUTTER_PX)
		: CT_FALLBACK_SIDE_RESERVED_PX;
	const rightInset = rightUiRect
		? Math.max(0, viewportWidth - rightUiRect.left + CT_EDGE_GUTTER_PX)
		: CT_FALLBACK_SIDE_RESERVED_PX;
	const safeWidth = viewportWidth - leftInset - rightInset;
	return Math.max(240, safeWidth);
}

function sortDeadCombatants(
	left: Combatant.Implementation,
	right: Combatant.Implementation,
): number {
	const typeDiff =
		Number(isMonsterOrMinionCombatant(left)) - Number(isMonsterOrMinionCombatant(right));
	if (typeDiff !== 0) return typeDiff;
	return (left.name ?? '').localeCompare(right.name ?? '');
}

function getNestedStringProperty(target: unknown, path: string): string | null {
	if (!target || typeof target !== 'object') return null;
	const value = foundry.utils.getProperty(target, path);
	return typeof value === 'string' && value.length > 0 ? value : null;
}

type TokenBarLike = {
	displayBars?: number | null;
	bar1?: { attribute?: string | null } | null;
	bar2?: { attribute?: string | null } | null;
};

function getTokenDisplayModeValue(
	modeKey: 'HOVER' | 'ALWAYS' | 'OWNER_HOVER' | 'OWNER' | 'CONTROL' | 'NONE',
	fallback: number,
): number {
	const tokenDisplayModes = (
		CONST as typeof CONST & {
			TOKEN_DISPLAY_MODES?: Partial<Record<typeof modeKey, number>>;
		}
	).TOKEN_DISPLAY_MODES;
	return Number(tokenDisplayModes?.[modeKey] ?? fallback);
}

function getCombatantTokenDocumentForVisibility(
	combatant: Combatant.Implementation,
): TokenBarLike | null {
	const tokenId = combatant.tokenId ?? combatant.token?.id ?? combatant.token?._id;
	const sceneToken = tokenId ? canvas.scene?.tokens?.get(tokenId) : null;
	return (sceneToken ??
		combatant.token ??
		combatant.actor?.prototypeToken ??
		null) as TokenBarLike | null;
}

function tokenHasBarAttribute(tokenDocument: TokenBarLike | null, attribute: string): boolean {
	if (!tokenDocument) return false;
	return tokenDocument.bar1?.attribute === attribute || tokenDocument.bar2?.attribute === attribute;
}

function isTokenBarVisibleToNonOwners(tokenDocument: TokenBarLike | null): boolean {
	if (!tokenDocument) return false;
	const displayBars = Number(tokenDocument.displayBars ?? Number.NaN);
	if (!Number.isFinite(displayBars)) return false;

	const hoverByAnyone = getTokenDisplayModeValue('HOVER', 30);
	const alwaysForEveryone = getTokenDisplayModeValue('ALWAYS', 50);
	return displayBars === hoverByAnyone || displayBars === alwaysForEveryone;
}

function canCurrentUserSeeCombatantField(
	combatant: Combatant.Implementation,
	fieldKey: CombatTrackerVisibilityFieldKey,
	visibilityPermissions: CombatTrackerVisibilityPermissionConfig,
): boolean {
	if (game.user?.isGM) return true;
	if (combatant.actor?.isOwner) return true;

	return canUserRoleAccessCombatTrackerPermission(
		visibilityPermissions[fieldKey],
		Number(game.user?.role ?? 0),
	);
}

function canCurrentUserSeeCombatantTokenBarField(
	combatant: Combatant.Implementation,
	fieldKey: CombatTrackerVisibilityFieldKey,
	visibilityPermissions: CombatTrackerVisibilityPermissionConfig,
	attribute: string,
): boolean {
	if (!canCurrentUserSeeCombatantField(combatant, fieldKey, visibilityPermissions)) return false;
	if (game.user?.isGM || combatant.actor?.isOwner) return true;

	const tokenDocument = getCombatantTokenDocumentForVisibility(combatant);
	if (!tokenHasBarAttribute(tokenDocument, attribute)) return false;
	return isTokenBarVisibleToNonOwners(tokenDocument);
}

function getHealthStateLabel(state: ActorHealthState): string {
	switch (state) {
		case 'normal':
			return localizeWithFallback('Normal', 'Normal');
		case 'bloodied':
			return localizeWithFallback('NIMBLE.conditions.bloodied', 'Bloodied');
		case 'lastStand':
			return localizeWithFallback('NIMBLE.conditions.lastStand', 'Last Stand');
		default:
			return '--';
	}
}

function formatCombatTrackerValue(value: number | null): string {
	if (value === null) return '--';
	return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

export function normalizeCtWidthLevel(value: unknown): number {
	const numericValue = Number(value);
	if (!Number.isFinite(numericValue)) return 2;
	const roundedValue = Math.round(numericValue);
	return Math.min(CT_MAX_WIDTH_LEVEL, Math.max(CT_MIN_WIDTH_LEVEL, roundedValue));
}

export function normalizeCtCardSizeLevel(value: unknown): number {
	const numericValue = Number(value);
	if (!Number.isFinite(numericValue)) return 3;
	const roundedValue = Math.round(numericValue);
	return Math.min(CT_MAX_CARD_SIZE_LEVEL, Math.max(CT_MIN_CARD_SIZE_LEVEL, roundedValue));
}

export function normalizeCtBadgeSizeLevel(value: unknown): number {
	const numericValue = Number(value);
	if (!Number.isFinite(numericValue)) return CT_MIN_BADGE_SIZE_LEVEL;
	const roundedValue = Math.round(numericValue);
	return Math.min(CT_MAX_BADGE_SIZE_LEVEL, Math.max(CT_MIN_BADGE_SIZE_LEVEL, roundedValue));
}

export function getCtCardScale(cardSizeLevel: number): number {
	const normalizedCardSizeLevel = normalizeCtCardSizeLevel(cardSizeLevel);
	return (
		CT_MIN_CARD_SCALE + (normalizedCardSizeLevel - CT_MIN_CARD_SIZE_LEVEL) * CT_CARD_SCALE_STEP
	);
}

export function getCtBadgeScale(badgeSizeLevel: number): number {
	const normalizedBadgeSizeLevel = normalizeCtBadgeSizeLevel(badgeSizeLevel);
	return (
		CT_MIN_BADGE_SCALE + (normalizedBadgeSizeLevel - CT_MIN_BADGE_SIZE_LEVEL) * CT_BADGE_SCALE_STEP
	);
}

export function resolveCtTrackMaxWidth(widthLevel: number): string {
	const widthRatio = getCtWidthRatio(widthLevel);
	const safeWidthPx = getSafeCtTrackWidthPx();
	const minimumWidthPx = Math.min(CT_MIN_SAFE_TRACK_WIDTH_PX, safeWidthPx);
	const resolvedWidthPx = Math.max(minimumWidthPx, Math.round(safeWidthPx * widthRatio));
	return `${resolvedWidthPx}px`;
}

export function isLegendaryCombatant(combatant: Combatant.Implementation): boolean {
	return combatant.type === 'soloMonster';
}

export function isPlayerCombatant(combatant: Combatant.Implementation): boolean {
	return combatant.type === 'character';
}

export function isMonsterOrMinionCombatant(combatant: Combatant.Implementation): boolean {
	return !isPlayerCombatant(combatant) && !isLegendaryCombatant(combatant);
}

export function getCombatantId(
	combatant: { id?: string | null; _id?: string | null } | null | undefined,
): string {
	return combatant?.id ?? combatant?._id ?? '';
}

export function buildCombatantEntryKey(combatantId: string, occurrence: number): string {
	return `combatant-${combatantId}-${occurrence}`;
}

export function trackDependency(_value: unknown): void {
	// Used to explicitly register rune dependencies in derived/effect blocks.
}

export function getCombatantOccurrenceAtIndex(
	combatants: Combatant.Implementation[],
	combatantId: string,
	inclusiveIndex: number,
): number {
	let occurrence = -1;
	for (let index = 0; index <= inclusiveIndex && index < combatants.length; index += 1) {
		const id = getCombatantId(combatants[index]);
		if (id === combatantId) occurrence += 1;
	}
	return occurrence;
}

export function findTurnIndexByOccurrence(
	turns: Combatant.Implementation[],
	combatantId: string,
	desiredOccurrence: number | null,
): number {
	let occurrence = -1;
	for (const [index, turnCombatant] of turns.entries()) {
		if (getCombatantId(turnCombatant) !== combatantId) continue;
		occurrence += 1;
		if (desiredOccurrence === null || occurrence === desiredOccurrence) return index;
	}
	return -1;
}

export function syncCombatTurnsForCt(combat: Combat | null): void {
	if (!combat) return;

	const existingTurns = combat.turns;
	const normalizedCurrentTurn =
		typeof combat.turn === 'number' && combat.turn >= 0 && combat.turn < existingTurns.length
			? combat.turn
			: null;
	const currentCombatantId =
		normalizedCurrentTurn !== null
			? getCombatantId(existingTurns[normalizedCurrentTurn])
			: getCombatantId(combat.combatant);
	const currentOccurrence =
		currentCombatantId && normalizedCurrentTurn !== null
			? getCombatantOccurrenceAtIndex(existingTurns, currentCombatantId, normalizedCurrentTurn)
			: null;

	let normalizedTurns: Combatant.Implementation[];
	try {
		normalizedTurns = combat.setupTurns();
	} catch (_error) {
		return;
	}

	combat.turns = normalizedTurns;
	if (normalizedTurns.length === 0) {
		combat.turn = 0;
		return;
	}

	if (currentCombatantId) {
		const matchedIndex = findTurnIndexByOccurrence(
			normalizedTurns,
			currentCombatantId,
			currentOccurrence,
		);
		if (matchedIndex >= 0) {
			combat.turn = matchedIndex;
			return;
		}
	}

	const fallbackTurn = Number.isInteger(combat.turn) ? Number(combat.turn) : 0;
	combat.turn = Math.min(Math.max(fallbackTurn, 0), normalizedTurns.length - 1);
}

export function getCombatantSceneId(combatant: Combatant.Implementation): string | undefined {
	if (combatant.sceneId) return combatant.sceneId;
	if (combatant.token?.parent?.id) return combatant.token.parent.id;

	const sceneId = canvas.scene?.id;
	if (sceneId && combatant.tokenId) {
		const tokenDoc = canvas.scene?.tokens?.get(combatant.tokenId);
		if (tokenDoc) return sceneId;
	}

	return undefined;
}

export function hasCombatantsForScene(combat: Combat, sceneId: string): boolean {
	return combat.combatants.contents.some((combatant) => getCombatantSceneId(combatant) === sceneId);
}

export function isCombatStarted(combat: Combat | null): boolean {
	if (!combat) return false;
	const asRecord = combat as unknown as { started?: boolean };
	if (typeof asRecord.started === 'boolean') return asRecord.started;
	return (combat.round ?? 0) > 0;
}

export function isCombatRoundStarted(combat: Combat | null): boolean {
	return (combat?.round ?? 0) > 0;
}

export function getCombatSelectionScore(
	combat: Combat,
	sceneId: string,
	activeCombat: Combat | null,
	viewedCombat: Combat | null,
): number {
	let score = 0;
	if (isCombatStarted(combat)) score += 10000;
	if (combat.round && combat.round > 0) score += Math.min(2000, combat.round * 10);
	if (combat.active) score += 1000;
	if (combat === activeCombat && combat.scene?.id === sceneId) score += 3000;
	if (combat === viewedCombat && combat.scene?.id === sceneId) score += 2000;
	score += Math.min(500, combat.combatants.size * 5);
	return score;
}

export function getCombatForCurrentScene(preferredCombatId: string | null): Combat | null {
	const sceneId = canvas.scene?.id;
	if (!sceneId) return null;

	const activeCombat = game.combat;
	const viewedCombat = game.combats.viewed ?? null;
	const sceneCombats = game.combats.contents.filter((combat) => {
		if (combat.scene?.id === sceneId) return true;
		return hasCombatantsForScene(combat, sceneId);
	});
	if (sceneCombats.length < 1) return null;

	if (preferredCombatId) {
		const preferredCombat = sceneCombats.find(
			(combat) => (combat.id ?? combat._id ?? null) === preferredCombatId,
		);
		if (preferredCombat) return preferredCombat;
	}

	if (activeCombat) {
		const activeCombatId = activeCombat.id ?? activeCombat._id ?? null;
		const activeSceneCombat = sceneCombats.find(
			(combat) => combat === activeCombat || (combat.id ?? combat._id ?? null) === activeCombatId,
		);
		if (activeSceneCombat) return activeSceneCombat;
	}

	if (viewedCombat) {
		const viewedCombatId = viewedCombat.id ?? viewedCombat._id ?? null;
		const viewedSceneCombat = sceneCombats.find(
			(combat) => combat === viewedCombat || (combat.id ?? combat._id ?? null) === viewedCombatId,
		);
		if (viewedSceneCombat) return viewedSceneCombat;
	}

	sceneCombats.sort((left, right) => {
		const leftScore = getCombatSelectionScore(left, sceneId, activeCombat, viewedCombat);
		const rightScore = getCombatSelectionScore(right, sceneId, activeCombat, viewedCombat);
		return rightScore - leftScore;
	});
	return sceneCombats[0] ?? null;
}

export function getCombatantsForScene(
	combat: Combat | null,
	sceneId: string | undefined,
): SceneCombatantLists {
	if (!combat || !sceneId) return { aliveCombatants: [], deadCombatants: [] };

	const combatantsForScene = combat.combatants.contents.filter(
		(combatant) =>
			getCombatantSceneId(combatant) === sceneId && combatant.visible && combatant._id != null,
	);
	const turnCombatants = combat.turns
		.map((turnCombatant) => {
			const combatantId = turnCombatant.id ?? turnCombatant._id ?? '';
			if (!combatantId) return null;
			return combat.combatants.get(combatantId) ?? turnCombatant;
		})
		.filter((combatant): combatant is Combatant.Implementation => Boolean(combatant))
		.filter(
			(combatant) =>
				getCombatantSceneId(combatant) === sceneId && combatant.visible && combatant._id != null,
		);
	const turnCombatantIds = new Set(turnCombatants.map((combatant) => combatant.id ?? ''));

	const aliveCombatants = [
		...turnCombatants.filter((combatant) => !isCombatantDead(combatant)),
		...combatantsForScene.filter((combatant) => {
			if (isCombatantDead(combatant)) return false;
			return !turnCombatantIds.has(combatant.id ?? '');
		}),
	];
	const deadCombatants = combatantsForScene
		.filter((combatant) => isCombatantDead(combatant))
		.sort(sortDeadCombatants);

	return { aliveCombatants, deadCombatants };
}

export function getCombatantDisplayName(combatant: Combatant.Implementation): string {
	return (
		getNestedStringProperty(combatant.token, 'reactive.name') ??
		combatant.token?.name ??
		getNestedStringProperty(combatant.token?.actor, 'reactive.name') ??
		getNestedStringProperty(combatant, 'reactive.name') ??
		combatant.name ??
		'Unknown'
	);
}

export function getCombatantHpBadgeState(combatant: Combatant.Implementation): HpBadgeState {
	switch (getActorHealthState(combatant.actor)) {
		case 'normal':
			return 'green';
		case 'bloodied':
			return isLegendaryCombatant(combatant) ? 'yellow' : 'red';
		case 'lastStand':
			return 'red';
		default:
			return 'unknown';
	}
}

export function getCombatantHpBadgeClass(combatant: Combatant.Implementation): string {
	const state = getCombatantHpBadgeState(combatant);
	switch (state) {
		case 'red':
			return 'nimble-ct__badge--hp-red';
		case 'yellow':
			return 'nimble-ct__badge--hp-yellow';
		case 'green':
			return 'nimble-ct__badge--hp-green';
		default:
			return 'nimble-ct__badge--hp-unknown';
	}
}

export function getCombatantHpDrawerIconClass(combatant: Combatant.Implementation): string {
	const healthState = getActorHealthState(combatant.actor);
	return healthState === 'bloodied' ? 'fa-solid fa-heart-crack' : 'fa-solid fa-heart';
}

export function getCombatantHpBadgeMode(
	combatant: Combatant.Implementation,
	visibilityPermissions: CombatTrackerVisibilityPermissionConfig,
): HpBadgeMode {
	const canShowHpValue = canCurrentUserSeeCombatantTokenBarField(
		combatant,
		'hpValue',
		visibilityPermissions,
		'attributes.hp',
	);
	if (canShowHpValue) return 'value';

	const canShowHpState = canCurrentUserSeeCombatantTokenBarField(
		combatant,
		'hpState',
		visibilityPermissions,
		'attributes.hp',
	);
	return canShowHpState ? 'state' : 'hidden';
}

export function getCombatantHpBadgeText(
	combatant: Combatant.Implementation,
	visibilityPermissions: CombatTrackerVisibilityPermissionConfig,
): string | null {
	const badgeMode = getCombatantHpBadgeMode(combatant, visibilityPermissions);
	if (badgeMode === 'hidden') return null;
	if (badgeMode === 'state') return getHealthStateLabel(getActorHealthState(combatant.actor));

	const hpValue = getActorHpValue(combatant.actor);
	if (hpValue === null) return '--';
	return formatCombatTrackerValue(hpValue);
}

export function getCombatantHpBadgeTooltip(
	combatant: Combatant.Implementation,
	visibilityPermissions: CombatTrackerVisibilityPermissionConfig,
): string | null {
	const badgeMode = getCombatantHpBadgeMode(combatant, visibilityPermissions);
	if (badgeMode === 'hidden') return null;

	const healthState = getActorHealthState(combatant.actor);
	const stateLabel = getHealthStateLabel(healthState);
	const hpValue = getActorHpValue(combatant.actor);
	const hpMax = getActorHpMaxValue(combatant.actor);
	if (badgeMode === 'state') {
		return stateLabel;
	}
	if (hpValue === null || hpMax === null) return stateLabel;
	return `${hpValue}/${hpMax} (${stateLabel})`;
}

export function shouldRenderHpBadge(
	combatant: Combatant.Implementation,
	visibilityPermissions: CombatTrackerVisibilityPermissionConfig,
): boolean {
	return getCombatantHpBadgeMode(combatant, visibilityPermissions) !== 'hidden';
}

export function shouldRenderCombatantActions(
	combatant: Combatant.Implementation,
	visibilityPermissions: CombatTrackerVisibilityPermissionConfig,
): boolean {
	return canCurrentUserSeeCombatantField(combatant, 'actions', visibilityPermissions);
}

export function getCombatantCardResourceChips(
	combatant: Combatant.Implementation,
	visibilityPermissions: CombatTrackerVisibilityPermissionConfig,
): CombatantCardResourceChip[] {
	const chips: CombatantCardResourceChip[] = [];

	const wounds = getActorWoundsValueAndMax(combatant.actor);
	if (
		wounds &&
		canCurrentUserSeeCombatantTokenBarField(
			combatant,
			'wounds',
			visibilityPermissions,
			'attributes.wounds.value',
		)
	) {
		chips.push({
			key: 'wounds',
			iconClass: 'fa-solid fa-droplet',
			text: `${Math.max(0, Math.floor(wounds.value))}/${Math.max(0, Math.floor(wounds.max))}`,
			title: 'Wounds',
			tone: 'wounds',
		});
	}

	const mana = getActorManaValueAndMax(combatant.actor);
	if (
		mana &&
		canCurrentUserSeeCombatantTokenBarField(
			combatant,
			'mana',
			visibilityPermissions,
			'resources.mana',
		)
	) {
		chips.push({
			key: 'mana',
			iconClass: 'fa-solid fa-sparkles',
			text: `${Math.max(0, Math.floor(mana.value))}/${Math.max(0, Math.floor(mana.max))}`,
			title: 'Mana',
			tone: 'mana',
		});
	}

	if (isPlayerCombatant(combatant)) {
		const defendAvailable = getHeroicReactionAvailability(combatant, 'defend');
		if (canCurrentUserSeeCombatantField(combatant, 'defend', visibilityPermissions)) {
			chips.push({
				key: 'defend',
				iconClass: 'fa-solid fa-shield-halved',
				title: getHeroicReactionAvailabilityTitle('defend', defendAvailable),
				active: defendAvailable,
				tone: 'utility',
			});
		}

		const interposeAvailable = getHeroicReactionAvailability(combatant, 'interpose');
		if (canCurrentUserSeeCombatantField(combatant, 'interpose', visibilityPermissions)) {
			chips.push({
				key: 'interpose',
				iconClass: 'fa-solid fa-hand',
				title: getHeroicReactionAvailabilityTitle('interpose', interposeAvailable),
				active: interposeAvailable,
				tone: 'utility',
			});
		}
	}

	return chips;
}

export function getPlayerCombatantDrawerData(
	combatant: Combatant.Implementation,
	visibilityPermissions: CombatTrackerVisibilityPermissionConfig,
): PlayerCombatantDrawerData {
	const hpBadgeMode = getCombatantHpBadgeMode(combatant, visibilityPermissions);
	const hpValue = getActorHpValue(combatant.actor);
	const hpMax = getActorHpMaxValue(combatant.actor);
	const hpState = getActorHealthState(combatant.actor);
	const hpText =
		hpBadgeMode === 'value'
			? `${formatCombatTrackerValue(hpValue)}/${formatCombatTrackerValue(hpMax)}`
			: hpBadgeMode === 'state'
				? getHealthStateLabel(hpState)
				: null;
	const hpTitle = getCombatantHpBadgeTooltip(combatant, visibilityPermissions);
	const hpVisible = hpBadgeMode !== 'hidden' && Boolean(hpText);

	const wounds = getActorWoundsValueAndMax(combatant.actor);
	const woundsVisible = Boolean(
		wounds &&
			canCurrentUserSeeCombatantTokenBarField(
				combatant,
				'wounds',
				visibilityPermissions,
				'attributes.wounds.value',
			),
	);
	const woundsText =
		woundsVisible && wounds
			? `${Math.max(0, Math.floor(wounds.value))}/${Math.max(0, Math.floor(wounds.max))}`
			: undefined;

	const defendAvailable = getHeroicReactionAvailability(combatant, 'defend');
	const defendVisible = canCurrentUserSeeCombatantField(combatant, 'defend', visibilityPermissions);

	const interposeAvailable = getHeroicReactionAvailability(combatant, 'interpose');
	const interposeVisible = canCurrentUserSeeCombatantField(
		combatant,
		'interpose',
		visibilityPermissions,
	);
	const opportunityAttackAvailable = getHeroicReactionAvailability(combatant, 'opportunityAttack');
	const opportunityAttackVisible = canCurrentUserSeeCombatantField(
		combatant,
		'opportunityAttack',
		visibilityPermissions,
	);
	const helpAvailable = getHeroicReactionAvailability(combatant, 'help');
	const helpVisible = canCurrentUserSeeCombatantField(combatant, 'help', visibilityPermissions);

	return {
		hp: {
			key: 'hp',
			iconClass: hpVisible ? getCombatantHpDrawerIconClass(combatant) : undefined,
			text: hpVisible ? (hpText ?? undefined) : undefined,
			title: hpVisible ? (hpTitle ?? 'Hit Points') : 'Hit Points hidden',
			active: hpVisible,
			visible: hpVisible,
		},
		wounds: {
			key: 'wounds',
			iconClass: 'fa-solid fa-droplet',
			text: woundsText,
			title: woundsText ? `Wounds ${woundsText}` : 'Wounds hidden',
			active: woundsVisible,
			visible: woundsVisible,
		},
		defend: {
			key: 'defend',
			iconClass: 'fa-solid fa-shield-halved',
			title: getHeroicReactionAvailabilityTitle('defend', defendAvailable),
			active: defendAvailable,
			visible: defendVisible,
		},
		interpose: {
			key: 'interpose',
			iconClass: 'fa-solid fa-hand',
			title: getHeroicReactionAvailabilityTitle('interpose', interposeAvailable),
			active: interposeAvailable,
			visible: interposeVisible,
		},
		opportunityAttack: {
			key: 'opportunityAttack',
			iconClass: 'fa-solid fa-bolt',
			title: getHeroicReactionAvailabilityTitle('opportunityAttack', opportunityAttackAvailable),
			active: opportunityAttackAvailable,
			visible: opportunityAttackVisible,
		},
		help: {
			key: 'help',
			iconClass: 'fa-solid fa-handshake',
			title: getHeroicReactionAvailabilityTitle('help', helpAvailable),
			active: helpAvailable,
			visible: helpVisible,
		},
	};
}

export function getCombatantOutlineClass(
	combatant: Combatant.Implementation,
	visibilityPermissions: CombatTrackerVisibilityPermissionConfig,
): string {
	if (!canCurrentUserSeeCombatantField(combatant, 'outline', visibilityPermissions)) return '';
	if (isPlayerCombatant(combatant)) return 'nimble-ct__portrait--outline-player';
	if (isLegendaryCombatant(combatant)) return 'nimble-ct__portrait--outline-monster';
	if (isFriendlyCombatant(combatant)) return 'nimble-ct__portrait--outline-friendly';
	return 'nimble-ct__portrait--outline-monster';
}

export function getActionState(combatant: Combatant.Implementation): {
	current: number;
	max: number;
	overflow: number;
	slots: number[];
} {
	const normalizedCurrent = getCombatantCurrentActions(combatant);
	const normalizedMax = getCombatantMaxActions(combatant);
	const visiblePips = Math.min(normalizedMax, MAX_RENDERED_ACTION_DICE);
	return {
		current: normalizedCurrent,
		max: normalizedMax,
		overflow:
			Math.max(0, normalizedMax - MAX_RENDERED_ACTION_DICE) +
			Math.max(0, normalizedCurrent - normalizedMax),
		slots: Array.from({ length: visiblePips }, (_value, index) => index),
	};
}

export function getActionDiceIconClass(slot: number): (typeof ACTION_DICE_ICON_CLASSES)[number] {
	const clampedIndex = Math.max(0, Math.min(slot, ACTION_DICE_ICON_CLASSES.length - 1));
	return ACTION_DICE_ICON_CLASSES[clampedIndex];
}

export function hasCombatantTurnRemainingThisRound(combatant: Combatant.Implementation): boolean {
	if (isPlayerCombatant(combatant) || isLegendaryCombatant(combatant)) return true;
	return getCombatantCurrentActions(combatant) > 0;
}

export function isFriendlyCombatant(combatant: Combatant.Implementation): boolean {
	const tokenDisposition = Number(
		combatant.token?.disposition ?? combatant.token?.object?.document?.disposition ?? NaN,
	);
	return tokenDisposition === CONST.TOKEN_DISPOSITIONS.FRIENDLY;
}

export function isEligibleForInitiativeRoll(combatant: Combatant.Implementation): boolean {
	return combatant.type === 'character' || isFriendlyCombatant(combatant);
}

export function getTrackEntryCombatantId(entry: TrackEntry): string {
	return getCombatantId(entry.combatant);
}

export function buildAliveEntries(
	combatants: Combatant.Implementation[],
	collapseMonsters: boolean,
	includeMonsterStack: boolean,
): TrackEntry[] {
	const entries: TrackEntry[] = [];
	const occurrenceByCombatantId = new Map<string, number>();
	let stackInserted = false;
	for (const combatant of combatants) {
		if (collapseMonsters && isMonsterOrMinionCombatant(combatant)) {
			if (!stackInserted) {
				entries.push({ key: 'monster-stack', kind: 'monster-stack' });
				stackInserted = true;
			}
			continue;
		}
		const combatantId = getCombatantId(combatant);
		const occurrence = occurrenceByCombatantId.get(combatantId) ?? 0;
		occurrenceByCombatantId.set(combatantId, occurrence + 1);
		entries.push({
			key: combatantId
				? buildCombatantEntryKey(combatantId, occurrence)
				: `combatant-${entries.length}`,
			kind: 'combatant',
			combatant,
		});
	}

	if (collapseMonsters && includeMonsterStack && !stackInserted) {
		entries.push({ key: 'monster-stack', kind: 'monster-stack' });
	}
	return entries;
}

export function getActiveCombatantId(combat: Combat | null): string | null {
	if (!combat) return null;
	const turnIndex = Number(combat.turn ?? -1);
	if (Number.isInteger(turnIndex) && turnIndex >= 0 && turnIndex < combat.turns.length) {
		return combat.turns[turnIndex]?.id ?? null;
	}
	return combat.combatant?.id ?? null;
}

export function getActiveCombatant(combat: Combat | null): Combatant.Implementation | null {
	if (!combat) return null;
	const activeId = getActiveCombatantId(combat);
	if (!activeId) return null;
	return (
		combat.combatants.get(activeId) ??
		combat.turns.find((turnCombatant) => turnCombatant.id === activeId) ??
		null
	);
}

export function getActiveCombatantOccurrence(
	combat: Combat | null,
	activeId: string,
): number | null {
	if (!combat) return null;
	const turnIndex = Number(combat.turn ?? -1);
	if (!Number.isInteger(turnIndex) || turnIndex < 0 || turnIndex >= combat.turns.length)
		return null;
	return getCombatantOccurrenceAtIndex(combat.turns, activeId, turnIndex);
}

export function resolveActiveEntryKey(params: ResolveActiveEntryKeyParams): string | null {
	const { activeCombatantId, activeOccurrence, aliveEntries, collapseMonsters, monsterCombatants } =
		params;
	if (!activeCombatantId) return aliveEntries[0]?.key ?? null;

	if (
		collapseMonsters &&
		monsterCombatants.some((combatant) => getCombatantId(combatant) === activeCombatantId)
	) {
		return 'monster-stack';
	}

	if (activeOccurrence !== null) {
		const activeCombatantKey = buildCombatantEntryKey(activeCombatantId, activeOccurrence);
		if (aliveEntries.some((entry) => entry.key === activeCombatantKey)) return activeCombatantKey;
	}

	const fallbackEntry = aliveEntries.find(
		(entry) => entry.kind === 'combatant' && getTrackEntryCombatantId(entry) === activeCombatantId,
	);
	return fallbackEntry?.key ?? aliveEntries[0]?.key ?? null;
}

export function orderEntriesForCenteredActive(
	entries: TrackEntry[],
	activeKey: string | null,
	centerActiveCards: boolean,
): TrackEntry[] {
	if (!centerActiveCards) return entries;
	if (entries.length <= 1 || !activeKey) return entries;
	const activeIndex = entries.findIndex((entry) => entry.key === activeKey);
	if (activeIndex < 0) return entries;

	const halfLength = Math.floor(entries.length / 2);
	return Array.from({ length: entries.length }, (_value, index) => {
		const sourceIndex = (activeIndex - halfLength + index + entries.length) % entries.length;
		return entries[sourceIndex];
	});
}

export function findRoundBoundaryIndex(sceneAliveCombatants: Combatant.Implementation[]): number {
	if (sceneAliveCombatants.length < 1) return -1;
	for (let index = sceneAliveCombatants.length - 1; index >= 0; index -= 1) {
		if (hasCombatantTurnRemainingThisRound(sceneAliveCombatants[index])) return index;
	}
	return sceneAliveCombatants.length - 1;
}

export function getRoundBoundaryKey(
	sceneAliveCombatants: Combatant.Implementation[],
	collapseMonsters: boolean,
): string | null {
	const boundaryIndex = findRoundBoundaryIndex(sceneAliveCombatants);
	if (boundaryIndex < 0) return null;

	const lastCurrentRoundCombatant = sceneAliveCombatants[boundaryIndex];
	if (!lastCurrentRoundCombatant) return null;

	if (collapseMonsters && isMonsterOrMinionCombatant(lastCurrentRoundCombatant)) {
		return 'monster-stack';
	}

	const combatantId = getCombatantId(lastCurrentRoundCombatant);
	if (!combatantId) return null;
	const occurrence = getCombatantOccurrenceAtIndex(
		sceneAliveCombatants,
		combatantId,
		boundaryIndex,
	);
	return buildCombatantEntryKey(combatantId, occurrence);
}

export function getRoundSeparatorInsertionIndex(
	orderedEntries: TrackEntry[],
	roundBoundaryKey: string | null,
): number {
	if (orderedEntries.length < 1 || !roundBoundaryKey) return -1;
	const boundaryIndex = orderedEntries.findIndex((entry) => entry.key === roundBoundaryKey);
	if (boundaryIndex < 0) return -1;
	return (boundaryIndex + 1) % orderedEntries.length;
}

export function buildCombatSyncSignature(
	combat: Combat | null,
	sceneId: string | undefined,
): string {
	if (!combat || !sceneId) return 'none';

	const combatId = combat.id ?? combat._id ?? 'unknown';
	const started = isCombatStarted(combat) ? 1 : 0;
	const round = Number(combat.round ?? 0);
	const turn = Number(combat.turn ?? -1);
	const activeId = getActiveCombatantId(combat) ?? '';
	const turns = combat.turns
		.filter((combatant) => getCombatantSceneId(combatant) === sceneId)
		.map((combatant) => combatant.id ?? combatant._id ?? '')
		.join(',');
	const actionSummary = combat.combatants.contents
		.filter((combatant) => getCombatantSceneId(combatant) === sceneId)
		.map((combatant) => {
			const currentActions = getCombatantCurrentActions(combatant);
			const maxActions = getCombatantMaxActions(combatant);
			const reactionSummary = (['defend', 'interpose', 'opportunityAttack', 'help'] as const)
				.map((reactionKey) => Number(getHeroicReactionAvailability(combatant, reactionKey)))
				.join('');
			return `${combatant.id ?? combatant._id ?? ''}:${currentActions}:${maxActions}:${Number(isCombatantDead(combatant))}:${reactionSummary}`;
		})
		.join('|');

	return `${combatId}|${started}|${round}|${turn}|${activeId}|${turns}|${actionSummary}`;
}

export function canCurrentUserRollInitiativeForCombatant(
	combatant: Combatant.Implementation,
): boolean {
	const currentUser = game.user;
	if (!currentUser) return false;
	if (currentUser.isGM) return true;
	if (!combatant.actor) return false;
	return combatant.actor.testUserPermission(currentUser, CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER);
}

export function shouldShowInitiativePromptForCombatant(
	combatant: Combatant.Implementation,
): boolean {
	if (!isPlayerCombatant(combatant)) return false;
	return combatant.initiative == null;
}

export function localizeWithFallback(key: string, fallback: string): string {
	const localized = game.i18n?.localize?.(key);
	if (typeof localized === 'string' && localized !== key) return localized;
	return fallback;
}

export function canCurrentUserAdjustCombatantActions(combatant: Combatant.Implementation): boolean {
	if (isCombatantDead(combatant)) return false;
	if (game.user?.isGM) return true;
	return Boolean(combatant.actor?.isOwner);
}

export function resolveNextCombatantActionsForSlot(
	params: ResolveNextCombatantActionsForSlotParams,
): number {
	const clampedMax = Math.max(0, Math.floor(params.maxActions));
	const clampedCurrent = Math.min(clampedMax, Math.max(0, Math.floor(params.currentActions)));
	const targetFromSlot = Math.min(clampedMax, Math.max(0, params.slot + 1));
	if (targetFromSlot === clampedCurrent) return Math.max(0, clampedCurrent - 1);
	return targetFromSlot;
}

export function getRootFontSizePx(): number {
	const rootFontSize =
		Number.parseFloat(globalThis.getComputedStyle(document.documentElement).fontSize) || 16;
	return Number.isFinite(rootFontSize) && rootFontSize > 0 ? rootFontSize : 16;
}

export function getEstimatedCtEntryWidthPx(ctCardSizeLevel: number): number {
	return getRootFontSizePx() * CT_ESTIMATED_ENTRY_WIDTH_REM * getCtCardScale(ctCardSizeLevel);
}

export function buildVirtualizedAliveEntries(
	params: BuildVirtualizedAliveEntriesParams,
	ctCardSizeLevel: number,
): VirtualizedAliveEntries {
	const totalEntries = params.entries.length;
	if (!params.enabled || totalEntries < 1) {
		return {
			enabled: false,
			startIndex: 0,
			endIndex: totalEntries,
			leadingWidthPx: 0,
			trailingWidthPx: 0,
			entries: params.entries,
		};
	}

	const estimatedEntryWidthPx = Math.max(1, getEstimatedCtEntryWidthPx(ctCardSizeLevel));
	const visibleCount = Math.max(
		1,
		Math.ceil(Math.max(estimatedEntryWidthPx, params.viewportWidth) / estimatedEntryWidthPx),
	);
	const firstVisibleIndex = Math.max(0, Math.floor(params.scrollLeft / estimatedEntryWidthPx));
	const startIndex = Math.max(0, firstVisibleIndex - CT_VIRTUALIZATION_OVERSCAN);
	const endIndex = Math.min(
		totalEntries,
		firstVisibleIndex + visibleCount + CT_VIRTUALIZATION_OVERSCAN,
	);
	return {
		enabled: true,
		startIndex,
		endIndex,
		leadingWidthPx: Math.round(startIndex * estimatedEntryWidthPx),
		trailingWidthPx: Math.round((totalEntries - endIndex) * estimatedEntryWidthPx),
		entries: params.entries.slice(startIndex, endIndex),
	};
}

export function getDragTargetExpansionPx(): number {
	return getRootFontSizePx() * DRAG_TARGET_EXPANSION_REM;
}

export function resolvePreviewBeforeState(
	relative: number,
	targetId: string,
	dragPreview: CombatantDropPreview | null,
): boolean {
	if (relative <= DRAG_SWITCH_UPPER_RATIO) return true;
	if (relative >= DRAG_SWITCH_LOWER_RATIO) return false;
	if (dragPreview?.targetId === targetId) return dragPreview.before;
	return relative < 0.5;
}

export function getCombatantImageForDisplay(combatant: Combatant.Implementation): string {
	return (
		getCombatantImage(combatant, {
			includeActorImage: true,
			fallback: PORTRAIT_FALLBACK_IMAGE,
		}) ?? PORTRAIT_FALLBACK_IMAGE
	);
}
