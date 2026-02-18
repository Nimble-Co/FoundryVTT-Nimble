import {
	getMinionGroupIdentityColorNumberByLabel,
	getMinionGroupLabel,
	getMinionGroupMemberNumber,
	getMinionGroupSummaries,
	isMinionCombatant,
} from '../utils/minionGrouping.js';

const TOKEN_GROUP_BADGE_KEY = '_nimbleMinionGroupBadge';
const TOKEN_GROUP_OUTLINE_KEY = '_nimbleMinionGroupOutline';

let didRegisterMinionGroupTokenBadges = false;

type TokenWithGroupBadge = Token & {
	[TOKEN_GROUP_BADGE_KEY]?: PIXI.Container | null;
	[TOKEN_GROUP_OUTLINE_KEY]?: PIXI.Graphics | null;
};

type GroupBadgeContainer = PIXI.Container & {
	background?: PIXI.Graphics;
	label?: PIXI.Text;
};

interface TokenGroupBadgeData {
	groupCode: string;
	groupLabel: string;
}

function canRenderMinionGroupIdentityUi(): boolean {
	return Boolean(game.user?.isGM);
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

function buildTokenGroupBadgeDataForCurrentScene(): Map<string, TokenGroupBadgeData> {
	if (!canRenderMinionGroupIdentityUi()) return new Map();

	const sceneId = canvas.scene?.id;
	if (!sceneId) return new Map();

	const combat = getCombatForScene(sceneId);
	if (!combat) return new Map();

	const combatantsForScene = combat.combatants.contents.filter(
		(combatant) => getCombatantSceneId(combatant) === sceneId,
	);
	const groupSummaries = getMinionGroupSummaries(combatantsForScene);
	const tokenBadgeData = new Map<string, TokenGroupBadgeData>();

	for (const groupSummary of groupSummaries.values()) {
		const label = groupSummary.label ?? getMinionGroupLabel(groupSummary.members[0]);
		if (!label) continue;

		const usedMemberNumbers = new Set<number>();
		const membersNeedingFallback: Combatant.Implementation[] = [];
		for (const member of groupSummary.members) {
			if (!isMinionCombatant(member)) continue;
			if (!member.tokenId) continue;

			const memberNumber = getMinionGroupMemberNumber(member);
			if (typeof memberNumber === 'number' && !usedMemberNumbers.has(memberNumber)) {
				usedMemberNumbers.add(memberNumber);
				tokenBadgeData.set(member.tokenId, {
					groupCode: `${label}${memberNumber}`,
					groupLabel: label,
				});
				continue;
			}

			membersNeedingFallback.push(member);
		}

		let nextFallbackNumber = 1;
		for (const member of membersNeedingFallback) {
			if (!isMinionCombatant(member)) continue;
			if (!member.tokenId) continue;
			while (usedMemberNumbers.has(nextFallbackNumber)) nextFallbackNumber += 1;

			const memberCode = `${label}${nextFallbackNumber}`;
			usedMemberNumbers.add(nextFallbackNumber);
			nextFallbackNumber += 1;

			tokenBadgeData.set(member.tokenId, {
				groupCode: memberCode,
				groupLabel: label,
			});
		}
	}

	return tokenBadgeData;
}

function removeTokenGroupBadge(token: TokenWithGroupBadge): void {
	const badge = token[TOKEN_GROUP_BADGE_KEY];
	if (!badge) return;

	badge.parent?.removeChild(badge);
	badge.destroy({ children: true });
	token[TOKEN_GROUP_BADGE_KEY] = null;
}

function removeTokenGroupOutline(token: TokenWithGroupBadge): void {
	const outline = token[TOKEN_GROUP_OUTLINE_KEY];
	if (!outline) return;

	outline.parent?.removeChild(outline);
	outline.destroy();
	token[TOKEN_GROUP_OUTLINE_KEY] = null;
}

function ensureTokenGroupBadge(token: TokenWithGroupBadge): GroupBadgeContainer {
	const existing = token[TOKEN_GROUP_BADGE_KEY] as GroupBadgeContainer | null | undefined;
	if (existing) return existing;

	const badge = new PIXI.Container() as GroupBadgeContainer;
	badge.eventMode = 'none';
	badge.zIndex = 1000;

	const background = new PIXI.Graphics();
	const label = new PIXI.Text('');
	label.anchor.set(0, 0);

	badge.background = background;
	badge.label = label;
	badge.addChild(background);
	badge.addChild(label);
	token.addChild(badge);
	token[TOKEN_GROUP_BADGE_KEY] = badge;

	return badge;
}

function ensureTokenGroupOutline(token: TokenWithGroupBadge): PIXI.Graphics {
	const existing = token[TOKEN_GROUP_OUTLINE_KEY];
	if (existing) return existing;

	const outline = new PIXI.Graphics();
	outline.eventMode = 'none';
	outline.zIndex = 950;
	token.addChild(outline);
	token[TOKEN_GROUP_OUTLINE_KEY] = outline;
	return outline;
}

function styleAndPositionTokenGroupBadge(
	token: TokenWithGroupBadge,
	badge: GroupBadgeContainer,
	badgeData: TokenGroupBadgeData,
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
	text.text = badgeData.groupCode.toUpperCase();
	const rendererResolution = Number(
		canvas?.app?.renderer?.resolution ?? globalThis.devicePixelRatio ?? 1,
	);
	text.resolution = Math.max(2, Number.isFinite(rendererResolution) ? rendererResolution : 2);
	text.roundPixels = true;

	const badgeWidth = Math.ceil(text.width + paddingX * 2);
	const badgeHeight = Math.ceil(text.height + paddingY * 2);
	const borderRadius = Math.max(4, Math.round(fontSize * 0.38));
	const accentColor = getMinionGroupIdentityColorNumberByLabel(badgeData.groupLabel);
	const baseBackgroundColor = 0x0f1422;
	const backgroundColor = blendColors(baseBackgroundColor, accentColor, 0.22);

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

	// Center the badge on the token's top-right corner so only the lower-left quadrant overlaps art.
	const centeredTopRightX = tokenSize - badgeWidth / 2;
	const centeredTopRightY = -badgeHeight / 2;
	badge.position.set(Math.round(centeredTopRightX), Math.round(centeredTopRightY));
}

function styleAndPositionTokenGroupOutline(
	token: TokenWithGroupBadge,
	outline: PIXI.Graphics,
	badgeData: TokenGroupBadgeData,
): void {
	const tokenWidth = Math.max(1, Number(token.w ?? 1));
	const tokenHeight = Math.max(1, Number(token.h ?? 1));
	const minSide = Math.max(1, Math.min(tokenWidth, tokenHeight));
	const accentColor = getMinionGroupIdentityColorNumberByLabel(badgeData.groupLabel);

	const lineWidth = Math.max(2, Math.min(6, Math.round(minSide * 0.05)));
	const outerWidth = Math.max(1, Math.round(tokenWidth));
	const outerHeight = Math.max(1, Math.round(tokenHeight));
	const innerInset = lineWidth;
	const innerWidth = Math.max(1, outerWidth - innerInset * 2);
	const innerHeight = Math.max(1, outerHeight - innerInset * 2);
	// Keep corners close to square so sharp token corners are fully covered.
	const outerRadius = Math.max(0, Math.min(4, Math.round(minSide * 0.03)));
	const maxInnerRadius = Math.floor(Math.min(innerWidth, innerHeight) / 2);
	const innerRadius = Math.max(0, Math.min(maxInnerRadius, outerRadius - lineWidth));

	outline.clear();
	outline.beginFill(accentColor, 0.95);
	outline.drawRoundedRect(0, 0, outerWidth, outerHeight, outerRadius);
	outline.beginHole();
	outline.drawRoundedRect(innerInset, innerInset, innerWidth, innerHeight, innerRadius);
	outline.endHole();
	outline.endFill();
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

function refreshTokenGroupBadge(
	token: TokenWithGroupBadge,
	tokenBadgeDataByTokenId: Map<string, TokenGroupBadgeData>,
): void {
	if (!canRenderMinionGroupIdentityUi()) {
		removeTokenGroupOutline(token);
		removeTokenGroupBadge(token);
		return;
	}

	const tokenId = token.document?.id ?? '';
	const badgeData = tokenId ? tokenBadgeDataByTokenId.get(tokenId) : null;

	if (!badgeData) {
		removeTokenGroupOutline(token);
		removeTokenGroupBadge(token);
		return;
	}

	const outline = ensureTokenGroupOutline(token);
	styleAndPositionTokenGroupOutline(token, outline, badgeData);

	const badge = ensureTokenGroupBadge(token);
	styleAndPositionTokenGroupBadge(token, badge, badgeData);
}

function refreshAllVisibleTokenGroupBadges(): void {
	if (!canvas?.ready || !canvas?.tokens) return;
	if (!canRenderMinionGroupIdentityUi()) {
		clearAllVisibleTokenGroupBadges();
		return;
	}

	const tokenBadgeDataByTokenId = buildTokenGroupBadgeDataForCurrentScene();
	for (const token of canvas.tokens.placeables) {
		refreshTokenGroupBadge(token as TokenWithGroupBadge, tokenBadgeDataByTokenId);
	}
}

function clearAllVisibleTokenGroupBadges(): void {
	if (!canvas?.tokens) return;
	for (const token of canvas.tokens.placeables) {
		removeTokenGroupOutline(token as TokenWithGroupBadge);
		removeTokenGroupBadge(token as TokenWithGroupBadge);
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
		const tokenBadgeDataByTokenId = buildTokenGroupBadgeDataForCurrentScene();
		refreshTokenGroupBadge(token as TokenWithGroupBadge, tokenBadgeDataByTokenId);
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

	if (canvas?.ready) {
		refreshAllVisibleTokenGroupBadges();
	}
}
