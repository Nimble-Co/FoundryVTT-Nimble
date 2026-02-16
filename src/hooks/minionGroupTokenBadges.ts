import {
	getMinionGroupLabel,
	getMinionGroupMemberNumber,
	getMinionGroupSummaries,
	isMinionCombatant,
} from '../utils/minionGrouping.js';

const TOKEN_GROUP_BADGE_KEY = '_nimbleMinionGroupBadge';

let didRegisterMinionGroupTokenBadges = false;

type TokenWithGroupBadge = Token & {
	[TOKEN_GROUP_BADGE_KEY]?: PIXI.Container | null;
};

type GroupBadgeContainer = PIXI.Container & {
	background?: PIXI.Graphics;
	label?: PIXI.Text;
};

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

function buildTokenGroupCodesForCurrentScene(): Map<string, string> {
	const sceneId = canvas.scene?.id;
	if (!sceneId) return new Map();

	const combat = getCombatForScene(sceneId);
	if (!combat) return new Map();

	const combatantsForScene = combat.combatants.contents.filter(
		(combatant) => getCombatantSceneId(combatant) === sceneId,
	);
	const groupSummaries = getMinionGroupSummaries(combatantsForScene);
	const tokenCodes = new Map<string, string>();

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
				tokenCodes.set(member.tokenId, `${label}${memberNumber}`);
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

			tokenCodes.set(member.tokenId, memberCode);
		}
	}

	return tokenCodes;
}

function removeTokenGroupBadge(token: TokenWithGroupBadge): void {
	const badge = token[TOKEN_GROUP_BADGE_KEY];
	if (!badge) return;

	badge.parent?.removeChild(badge);
	badge.destroy({ children: true });
	token[TOKEN_GROUP_BADGE_KEY] = null;
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

function styleAndPositionTokenGroupBadge(
	token: TokenWithGroupBadge,
	badge: GroupBadgeContainer,
	groupCode: string,
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
		fill: 0xe2d4bd,
		align: 'center',
	});
	text.text = groupCode.toUpperCase();
	const rendererResolution = Number(
		canvas?.app?.renderer?.resolution ?? globalThis.devicePixelRatio ?? 1,
	);
	text.resolution = Math.max(2, Number.isFinite(rendererResolution) ? rendererResolution : 2);
	text.roundPixels = true;

	const badgeWidth = Math.ceil(text.width + paddingX * 2);
	const badgeHeight = Math.ceil(text.height + paddingY * 2);
	const borderRadius = Math.max(4, Math.round(fontSize * 0.38));

	background.clear();
	background.lineStyle({
		width: 1,
		color: 0x82bbe3,
		alpha: 0.95,
	});
	background.beginFill(0x141928, 0.95);
	background.drawRoundedRect(0, 0, badgeWidth, badgeHeight, borderRadius);
	background.endFill();

	text.position.set(
		Math.round((badgeWidth - text.width) / 2),
		Math.round((badgeHeight - text.height) / 2),
	);

	const margin = Math.max(2, Math.round(tokenSize * 0.03));
	badge.position.set(Math.round(Math.max(0, tokenSize - badgeWidth - margin)), Math.round(margin));
}

function refreshTokenGroupBadge(token: TokenWithGroupBadge, tokenCodes: Map<string, string>): void {
	const tokenId = token.document?.id ?? '';
	const groupCode = tokenId ? tokenCodes.get(tokenId) : null;

	if (!groupCode) {
		removeTokenGroupBadge(token);
		return;
	}

	const badge = ensureTokenGroupBadge(token);
	styleAndPositionTokenGroupBadge(token, badge, groupCode);
}

function refreshAllVisibleTokenGroupBadges(): void {
	if (!canvas?.ready || !canvas?.tokens) return;

	const tokenCodes = buildTokenGroupCodesForCurrentScene();
	for (const token of canvas.tokens.placeables) {
		refreshTokenGroupBadge(token as TokenWithGroupBadge, tokenCodes);
	}
}

function clearAllVisibleTokenGroupBadges(): void {
	if (!canvas?.tokens) return;
	for (const token of canvas.tokens.placeables) {
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
		const tokenCodes = buildTokenGroupCodesForCurrentScene();
		refreshTokenGroupBadge(token as TokenWithGroupBadge, tokenCodes);
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
