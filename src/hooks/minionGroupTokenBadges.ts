import {
	getEffectiveMinionGroupLeader,
	getMinionGroupId,
	getMinionGroupSummaries,
} from '../utils/minionGrouping.js';

const LEGACY_TOKEN_GROUP_BADGE_KEY = '_nimbleMinionGroupBadge';
const LEGACY_TOKEN_GROUP_OUTLINE_KEY = '_nimbleMinionGroupOutline';
const TOKEN_TURN_COMPLETE_BADGE_KEY = '_nimbleTurnCompleteBadge';

let didRegisterMinionGroupTokenBadges = false;

type TokenWithTurnBadge = Token & {
	[LEGACY_TOKEN_GROUP_BADGE_KEY]?: PIXI.Container | null;
	[LEGACY_TOKEN_GROUP_OUTLINE_KEY]?: PIXI.Graphics | null;
	[TOKEN_TURN_COMPLETE_BADGE_KEY]?: PIXI.Container | null;
};

type TurnCompleteBadgeContainer = PIXI.Container & {
	background?: PIXI.Graphics;
	label?: PIXI.Text;
};

function getCombatantCurrentActions(combatant: Combatant.Implementation): number {
	const actions = Number(foundry.utils.getProperty(combatant, 'system.actions.base.current') ?? 0);
	if (!Number.isFinite(actions)) return 0;
	return Math.max(0, actions);
}

function getTurnOrderIndexForCombatant(
	combat: Combat,
	combatant: Combatant.Implementation,
	groupSummaries: ReturnType<typeof getMinionGroupSummaries>,
): number {
	const combatantId = combatant.id ?? '';
	if (!combatantId) return -1;

	const directIndex = combat.turns.findIndex((turnCombatant) => turnCombatant.id === combatantId);
	if (directIndex >= 0) return directIndex;

	const groupId = getMinionGroupId(combatant);
	if (!groupId) return -1;

	const groupSummary = groupSummaries.get(groupId);
	if (!groupSummary) return -1;

	const leader =
		getEffectiveMinionGroupLeader(groupSummary, { aliveOnly: true }) ??
		getEffectiveMinionGroupLeader(groupSummary);
	if (!leader?.id) return -1;

	return combat.turns.findIndex((turnCombatant) => turnCombatant.id === leader.id);
}

function hasCombatantTurnEndedThisRound(
	combat: Combat,
	combatant: Combatant.Implementation,
	groupSummaries: ReturnType<typeof getMinionGroupSummaries>,
): boolean {
	if ((combat.round ?? 0) < 1) return false;

	const activeCombatantId = combat.combatant?.id ?? '';
	if (!activeCombatantId) return false;

	const activeTurnIndex = combat.turns.findIndex(
		(turnCombatant) => turnCombatant.id === activeCombatantId,
	);
	if (activeTurnIndex < 0) return false;

	const combatantTurnIndex = getTurnOrderIndexForCombatant(combat, combatant, groupSummaries);
	if (combatantTurnIndex < 0) return false;

	return combatantTurnIndex < activeTurnIndex;
}

function getCombatantSceneId(combatant: Combatant.Implementation): string | undefined {
	if (combatant.sceneId) return combatant.sceneId;
	if (combatant.token?.parent?.id) return combatant.token.parent.id;
	return undefined;
}

function getCombatForScene(sceneId: string): Combat | null {
	const activeCombat = game.combat;
	if (activeCombat?.active && activeCombat.scene?.id === sceneId) return activeCombat;

	const viewedCombat = game.combats.viewed ?? null;
	if (viewedCombat?.scene?.id === sceneId) return viewedCombat;

	const combatForScene = game.combats.contents.find(
		(combat) =>
			combat.scene?.id === sceneId ||
			combat.combatants.contents.some((combatant) => getCombatantSceneId(combatant) === sceneId),
	);

	return combatForScene ?? null;
}

function buildTurnCompleteBadgeTokenIdsForCurrentScene(): Set<string> {
	const tokenIds = new Set<string>();

	if (!game.user?.isGM) return tokenIds;

	const sceneId = canvas.scene?.id;
	if (!sceneId) return tokenIds;

	const combat = getCombatForScene(sceneId);
	if (!combat) return tokenIds;

	const combatantsForScene = combat.combatants.contents.filter(
		(combatant) => getCombatantSceneId(combatant) === sceneId,
	);
	const groupSummaries = getMinionGroupSummaries(combatantsForScene);

	for (const combatant of combatantsForScene) {
		if (!combatant.tokenId) continue;
		if (combatant.defeated) continue;

		const turnEnded = hasCombatantTurnEndedThisRound(combat, combatant, groupSummaries);
		if (combatant.type === 'character') {
			if (!turnEnded) continue;
			tokenIds.add(combatant.tokenId);
			continue;
		}

		const actionsRemaining = getCombatantCurrentActions(combatant);
		if (actionsRemaining > 0 && !turnEnded) continue;

		tokenIds.add(combatant.tokenId);
	}

	return tokenIds;
}

function removeLegacyGroupIdentityVisuals(token: TokenWithTurnBadge): void {
	const legacyBadge = token[LEGACY_TOKEN_GROUP_BADGE_KEY];
	if (legacyBadge) {
		legacyBadge.parent?.removeChild(legacyBadge);
		legacyBadge.destroy({ children: true });
		token[LEGACY_TOKEN_GROUP_BADGE_KEY] = null;
	}

	const legacyOutline = token[LEGACY_TOKEN_GROUP_OUTLINE_KEY];
	if (legacyOutline) {
		legacyOutline.parent?.removeChild(legacyOutline);
		legacyOutline.destroy();
		token[LEGACY_TOKEN_GROUP_OUTLINE_KEY] = null;
	}
}

function removeTokenTurnCompleteBadge(token: TokenWithTurnBadge): void {
	const badge = token[TOKEN_TURN_COMPLETE_BADGE_KEY];
	if (!badge) return;

	badge.parent?.removeChild(badge);
	badge.destroy({ children: true });
	token[TOKEN_TURN_COMPLETE_BADGE_KEY] = null;
}

function ensureTokenTurnCompleteBadge(token: TokenWithTurnBadge): TurnCompleteBadgeContainer {
	const existing = token[TOKEN_TURN_COMPLETE_BADGE_KEY] as
		| TurnCompleteBadgeContainer
		| null
		| undefined;
	if (existing) return existing;

	const badge = new PIXI.Container() as TurnCompleteBadgeContainer;
	badge.eventMode = 'none';
	badge.zIndex = 1010;

	const background = new PIXI.Graphics();
	const label = new PIXI.Text('');
	label.anchor.set(0, 0);

	badge.background = background;
	badge.label = label;
	badge.addChild(background);
	badge.addChild(label);
	token.addChild(badge);
	token[TOKEN_TURN_COMPLETE_BADGE_KEY] = badge;

	return badge;
}

function blendColors(colorA: number, colorB: number, mixToB: number): number {
	const ratio = Math.max(0, Math.min(1, mixToB));
	const aR = (colorA >> 16) & 0xff;
	const aG = (colorA >> 8) & 0xff;
	const aB = colorA & 0xff;
	const bR = (colorB >> 16) & 0xff;
	const bG = (colorB >> 8) & 0xff;
	const bB = colorB & 0xff;
	const r = Math.round(aR + (bR - aR) * ratio);
	const g = Math.round(aG + (bG - aG) * ratio);
	const b = Math.round(aB + (bB - aB) * ratio);
	return (r << 16) | (g << 8) | b;
}

function styleAndPositionTokenTurnCompleteBadge(
	token: TokenWithTurnBadge,
	badge: TurnCompleteBadgeContainer,
): void {
	const text = badge.label;
	const background = badge.background;
	if (!text || !background) return;

	const tokenSize = Math.max(1, Number(token.w ?? 1));
	const fontSize = Math.max(12, Math.min(24, Math.round(tokenSize * 0.22)));
	const paddingX = Math.max(4, Math.round(fontSize * 0.35));
	const paddingY = Math.max(2, Math.round(fontSize * 0.2));

	text.style = new PIXI.TextStyle({
		fontFamily: 'Signika',
		fontSize,
		fontWeight: '700',
		fill: 0xf6f9ff,
		align: 'center',
	});
	text.text = '\u2713';

	const rendererResolution = Number(
		canvas?.app?.renderer?.resolution ?? globalThis.devicePixelRatio ?? 1,
	);
	text.resolution = Math.max(2, Number.isFinite(rendererResolution) ? rendererResolution : 2);
	text.roundPixels = true;

	const badgeWidth = Math.ceil(text.width + paddingX * 2);
	const badgeHeight = Math.ceil(text.height + paddingY * 2);
	const borderRadius = Math.max(4, Math.round(fontSize * 0.38));
	const accentColor = 0x3b82f6;
	const backgroundColor = blendColors(0x0f1422, accentColor, 0.22);

	background.clear();
	background.lineStyle({
		width: 1,
		color: accentColor,
		alpha: 0.95,
	});
	background.beginFill(backgroundColor, 0.95);
	background.drawRoundedRect(0, 0, badgeWidth, badgeHeight, borderRadius);
	background.endFill();

	text.position.set(
		Math.round((badgeWidth - text.width) / 2),
		Math.round((badgeHeight - text.height) / 2),
	);

	const centeredTopRightX = tokenSize - badgeWidth / 2;
	const centeredTopRightY = -badgeHeight / 2;
	badge.position.set(Math.round(centeredTopRightX), Math.round(centeredTopRightY));
}

function refreshTokenTurnCompleteBadge(
	token: TokenWithTurnBadge,
	turnCompleteBadgeTokenIds: Set<string>,
): void {
	removeLegacyGroupIdentityVisuals(token);

	const tokenId = token.document?.id ?? '';
	const shouldRenderTurnCompleteBadge = tokenId ? turnCompleteBadgeTokenIds.has(tokenId) : false;
	if (!shouldRenderTurnCompleteBadge) {
		removeTokenTurnCompleteBadge(token);
		return;
	}

	const turnCompleteBadge = ensureTokenTurnCompleteBadge(token);
	styleAndPositionTokenTurnCompleteBadge(token, turnCompleteBadge);
}

function refreshAllVisibleTokenGroupBadges(): void {
	if (!canvas?.ready || !canvas?.tokens) return;

	const turnCompleteBadgeTokenIds = buildTurnCompleteBadgeTokenIdsForCurrentScene();
	for (const token of canvas.tokens.placeables) {
		refreshTokenTurnCompleteBadge(token as TokenWithTurnBadge, turnCompleteBadgeTokenIds);
	}
}

function clearAllVisibleTokenGroupBadges(): void {
	if (!canvas?.tokens) return;
	for (const token of canvas.tokens.placeables) {
		removeLegacyGroupIdentityVisuals(token as TokenWithTurnBadge);
		removeTokenTurnCompleteBadge(token as TokenWithTurnBadge);
	}
}

export default function registerMinionGroupTokenBadges(): void {
	if (didRegisterMinionGroupTokenBadges) return;
	didRegisterMinionGroupTokenBadges = true;

	Hooks.on('canvasReady', () => {
		refreshAllVisibleTokenGroupBadges();
	});

	Hooks.on('canvasTearDown', () => {
		clearAllVisibleTokenGroupBadges();
	});

	Hooks.on('refreshToken', (token: Token) => {
		const turnCompleteBadgeTokenIds = buildTurnCompleteBadgeTokenIdsForCurrentScene();
		refreshTokenTurnCompleteBadge(token as TokenWithTurnBadge, turnCompleteBadgeTokenIds);
	});

	Hooks.on('createCombat', () => {
		refreshAllVisibleTokenGroupBadges();
	});

	Hooks.on('updateCombat', () => {
		refreshAllVisibleTokenGroupBadges();
	});

	Hooks.on('deleteCombat', () => {
		refreshAllVisibleTokenGroupBadges();
	});

	Hooks.on('createCombatant', () => {
		refreshAllVisibleTokenGroupBadges();
	});

	Hooks.on('updateCombatant', () => {
		refreshAllVisibleTokenGroupBadges();
	});

	Hooks.on('deleteCombatant', () => {
		refreshAllVisibleTokenGroupBadges();
	});

	Hooks.on('updateSetting', () => {
		refreshAllVisibleTokenGroupBadges();
	});

	if (canvas?.ready) {
		refreshAllVisibleTokenGroupBadges();
	}
}
