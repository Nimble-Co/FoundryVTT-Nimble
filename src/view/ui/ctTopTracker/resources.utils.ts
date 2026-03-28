import type {
	CombatTrackerNonPlayerHpBarTextMode,
	CombatTrackerPlayerHpBarTextMode,
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
import localize from '../../../utils/localize.js';
import {
	isFriendlyCombatant,
	isLegendaryCombatant,
	isPlayerCombatant,
	localizeWithFallback,
} from './combat.utils.js';
import { PORTRAIT_FALLBACK_IMAGE } from './constants.js';
import type {
	CombatantCardResourceChip,
	NonPlayerCombatantHpBarData,
	PlayerCombatantBarData,
	PlayerCombatantDrawerData,
} from './types.js';

function getNestedStringProperty(target: unknown, path: string): string | null {
	if (!target || typeof target !== 'object') return null;
	const value = foundry.utils.getProperty(target, path);
	return typeof value === 'string' && value.length > 0 ? value : null;
}

const CT_WOUNDS_LABEL = 'NIMBLE.ui.combatTracker.wounds';
const CT_MANA_LABEL = 'NIMBLE.ui.combatTracker.mana';
const CT_HIT_POINTS_LABEL = 'NIMBLE.ui.combatTracker.hitPoints';
const CT_HIT_POINTS_HIDDEN_LABEL = 'NIMBLE.ui.combatTracker.hitPointsHidden';
const CT_WOUNDS_HIDDEN_LABEL = 'NIMBLE.ui.combatTracker.woundsHidden';
const CT_WOUNDS_VALUE_LABEL = 'NIMBLE.ui.combatTracker.woundsValue';

type TokenBarLike = {
	displayBars?: number | null;
	bar1?: { attribute?: string | null } | null;
	bar2?: { attribute?: string | null } | null;
};

type CombatantHealthTone = 'green' | 'yellow' | 'red' | 'unknown';

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

function isTokenBarExplicitlyHidden(tokenDocument: TokenBarLike | null): boolean {
	if (!tokenDocument) return true;
	const displayBars = Number(tokenDocument.displayBars ?? Number.NaN);
	if (!Number.isFinite(displayBars)) return true;
	return displayBars === getTokenDisplayModeValue('NONE', 0);
}

function canCurrentUserSeeCombatantTokenBarField(
	combatant: Combatant.Implementation,
	attribute: string,
): boolean {
	if (game.user?.isGM || combatant.actor?.isOwner) return true;

	const tokenDocument = getCombatantTokenDocumentForVisibility(combatant);
	if (!tokenHasBarAttribute(tokenDocument, attribute)) return false;
	return isTokenBarVisibleToNonOwners(tokenDocument);
}

function canCurrentUserSeeAssignedCombatantTokenBarField(
	combatant: Combatant.Implementation,
	attribute: string,
): boolean {
	const tokenDocument = getCombatantTokenDocumentForVisibility(combatant);
	if (!tokenHasBarAttribute(tokenDocument, attribute)) return false;
	if (isTokenBarExplicitlyHidden(tokenDocument)) return false;

	if (game.user?.isGM || combatant.actor?.isOwner) return true;
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

function getCombatantHealthTone(combatant: Combatant.Implementation): CombatantHealthTone {
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

function getNonPlayerHpBarToneClass(combatant: Combatant.Implementation): string {
	switch (getCombatantHealthTone(combatant)) {
		case 'red':
			return 'nimble-ct__non-player-hp-bar--red';
		case 'yellow':
			return 'nimble-ct__non-player-hp-bar--yellow';
		case 'green':
			return 'nimble-ct__non-player-hp-bar--green';
		default:
			return 'nimble-ct__non-player-hp-bar--unknown';
	}
}

function getPlayerHpBarToneClass(combatant: Combatant.Implementation): string {
	switch (getCombatantHealthTone(combatant)) {
		case 'red':
			return 'nimble-ct__player-resource-bar--red';
		case 'yellow':
			return 'nimble-ct__player-resource-bar--yellow';
		case 'green':
			return 'nimble-ct__player-resource-bar--green';
		default:
			return 'nimble-ct__player-resource-bar--unknown';
	}
}

function clampBarFillPercent(value: number, max: number): number {
	if (!Number.isFinite(value) || !Number.isFinite(max) || max <= 0) return 0;
	return Math.max(0, Math.min(100, Math.round((value / max) * 100)));
}

function getPlayerHpBarCenterText(
	combatant: Combatant.Implementation,
	textMode: CombatTrackerPlayerHpBarTextMode,
	fillPercent: number,
): string | null {
	if (textMode === 'none') return null;
	if (textMode === 'percentage') return `${fillPercent}%`;
	if (!canCurrentUserSeeAssignedCombatantTokenBarField(combatant, 'attributes.hp')) {
		return null;
	}
	return getHealthStateLabel(getActorHealthState(combatant.actor));
}

export function getCombatantHpDrawerIconClass(combatant: Combatant.Implementation): string {
	const healthState = getActorHealthState(combatant.actor);
	return healthState === 'bloodied' ? 'fa-solid fa-heart-crack' : 'fa-solid fa-heart';
}

function getCombatantHpTooltip(combatant: Combatant.Implementation, showState: boolean): string {
	const stateLabel = getHealthStateLabel(getActorHealthState(combatant.actor));
	const hpValue = getActorHpValue(combatant.actor);
	const hpMax = getActorHpMaxValue(combatant.actor);
	if (hpValue === null) return '--';
	if (hpMax === null) return formatCombatTrackerValue(hpValue);
	if (!showState) return `${hpValue}/${hpMax}`;
	return `${hpValue}/${hpMax} (${stateLabel})`;
}

function getCombatantHpBarTooltip(combatant: Combatant.Implementation): string | null {
	const canShowHpValue = canCurrentUserSeeCombatantTokenBarField(combatant, 'attributes.hp');
	if (!canShowHpValue) return null;
	const canShowHpState = canCurrentUserSeeCombatantTokenBarField(combatant, 'attributes.hp');
	return getCombatantHpTooltip(combatant, canShowHpState);
}

export function getNonPlayerCombatantHpBarData(
	combatant: Combatant.Implementation,
	barEnabled: boolean,
	centerTextMode: CombatTrackerNonPlayerHpBarTextMode,
): NonPlayerCombatantHpBarData {
	if (!barEnabled || isPlayerCombatant(combatant)) {
		return {
			visible: false,
			fillPercent: 0,
			centerText: null,
			toneClass: 'nimble-ct__non-player-hp-bar--unknown',
			tooltip: null,
		};
	}

	const canShowHpValue = canCurrentUserSeeCombatantTokenBarField(combatant, 'attributes.hp');
	if (!canShowHpValue) {
		return {
			visible: false,
			fillPercent: 0,
			centerText: null,
			toneClass: 'nimble-ct__non-player-hp-bar--unknown',
			tooltip: null,
		};
	}

	const hpValue = getActorHpValue(combatant.actor);
	const hpMax = getActorHpMaxValue(combatant.actor);
	if (hpValue === null || hpMax === null || hpMax <= 0) {
		return {
			visible: false,
			fillPercent: 0,
			centerText: null,
			toneClass: 'nimble-ct__non-player-hp-bar--unknown',
			tooltip: null,
		};
	}

	const fillPercent = Math.max(0, Math.min(100, Math.round((hpValue / hpMax) * 100)));
	let centerText: string | null = null;
	if (centerTextMode === 'hpState') {
		const canShowHpState = canCurrentUserSeeCombatantTokenBarField(combatant, 'attributes.hp');
		if (canShowHpState) {
			centerText = getHealthStateLabel(getActorHealthState(combatant.actor));
		}
	} else if (centerTextMode === 'percentage') {
		centerText = `${fillPercent}%`;
	}

	return {
		visible: true,
		fillPercent,
		centerText,
		toneClass: getNonPlayerHpBarToneClass(combatant),
		tooltip: getCombatantHpBarTooltip(combatant),
	};
}

export function shouldRenderCombatantActions(): boolean {
	return true;
}

export function getCombatantCardResourceChips(
	combatant: Combatant.Implementation,
): CombatantCardResourceChip[] {
	const chips: CombatantCardResourceChip[] = [];

	const wounds = getActorWoundsValueAndMax(combatant.actor);
	if (wounds && canCurrentUserSeeCombatantTokenBarField(combatant, 'attributes.wounds.value')) {
		chips.push({
			key: 'wounds',
			iconClass: 'fa-solid fa-droplet',
			text: `${Math.max(0, Math.floor(wounds.value))}/${Math.max(0, Math.floor(wounds.max))}`,
			title: localizeWithFallback(CT_WOUNDS_LABEL, 'Wounds'),
			tone: 'wounds',
		});
	}

	const mana = getActorManaValueAndMax(combatant.actor);
	if (mana && canCurrentUserSeeCombatantTokenBarField(combatant, 'resources.mana')) {
		chips.push({
			key: 'mana',
			iconClass: 'fa-solid fa-sparkles',
			text: `${Math.max(0, Math.floor(mana.value))}/${Math.max(0, Math.floor(mana.max))}`,
			title: localizeWithFallback(CT_MANA_LABEL, 'Mana'),
			tone: 'mana',
		});
	}

	if (isPlayerCombatant(combatant)) {
		const defendAvailable = getHeroicReactionAvailability(combatant, 'defend');
		chips.push({
			key: 'defend',
			iconClass: 'fa-solid fa-shield-halved',
			title: getHeroicReactionAvailabilityTitle('defend', defendAvailable),
			active: defendAvailable,
			tone: 'utility',
		});

		const interposeAvailable = getHeroicReactionAvailability(combatant, 'interpose');
		chips.push({
			key: 'interpose',
			iconClass: 'fa-solid fa-hand',
			title: getHeroicReactionAvailabilityTitle('interpose', interposeAvailable),
			active: interposeAvailable,
			tone: 'utility',
		});
	}

	return chips;
}

export function getPlayerCombatantDrawerData(
	combatant: Combatant.Implementation,
	playerHpBarTextMode: CombatTrackerPlayerHpBarTextMode,
): PlayerCombatantDrawerData {
	const hpValue = getActorHpValue(combatant.actor);
	const hpMax = getActorHpMaxValue(combatant.actor);
	const hpVisible = Boolean(
		hpValue !== null &&
			hpMax !== null &&
			hpMax > 0 &&
			canCurrentUserSeeAssignedCombatantTokenBarField(combatant, 'attributes.hp'),
	);
	const hpFillPercent =
		hpVisible && hpValue !== null && hpMax !== null ? clampBarFillPercent(hpValue, hpMax) : 0;
	const hpTitle =
		getCombatantHpBarTooltip(combatant) ?? localizeWithFallback(CT_HIT_POINTS_LABEL, 'Hit Points');
	const hpBar: PlayerCombatantBarData = {
		key: 'hp',
		visible: hpVisible,
		fillPercent: hpFillPercent,
		centerText: hpVisible
			? getPlayerHpBarCenterText(combatant, playerHpBarTextMode, hpFillPercent)
			: null,
		title: hpVisible
			? hpTitle
			: localizeWithFallback(CT_HIT_POINTS_HIDDEN_LABEL, 'Hit Points hidden'),
		toneClass: getPlayerHpBarToneClass(combatant),
	};

	const wounds = getActorWoundsValueAndMax(combatant.actor);
	const woundsVisible = Boolean(
		wounds && canCurrentUserSeeAssignedCombatantTokenBarField(combatant, 'attributes.wounds.value'),
	);
	const woundsBar: PlayerCombatantBarData = {
		key: 'wounds',
		visible: woundsVisible,
		fillPercent: woundsVisible && wounds ? clampBarFillPercent(wounds.value, wounds.max) : 0,
		centerText:
			woundsVisible && wounds
				? `${Math.max(0, Math.floor(wounds.value))}/${Math.max(0, Math.floor(wounds.max))}`
				: null,
		title:
			woundsVisible && wounds
				? localize(CT_WOUNDS_VALUE_LABEL, {
						current: String(Math.max(0, Math.floor(wounds.value))),
						max: String(Math.max(0, Math.floor(wounds.max))),
					})
				: localizeWithFallback(CT_WOUNDS_HIDDEN_LABEL, 'Wounds hidden'),
		toneClass: 'nimble-ct__player-resource-bar--wounds',
		iconClass: 'fa-solid fa-droplet',
	};

	const defendAvailable = getHeroicReactionAvailability(combatant, 'defend');
	const interposeAvailable = getHeroicReactionAvailability(combatant, 'interpose');
	const opportunityAttackAvailable = getHeroicReactionAvailability(combatant, 'opportunityAttack');
	const helpAvailable = getHeroicReactionAvailability(combatant, 'help');

	return {
		rowCount: 1 + Number(hpBar.visible) + Number(woundsBar.visible),
		hpBar,
		woundsBar,
		defend: {
			key: 'defend',
			iconClass: 'fa-solid fa-shield-halved',
			title: getHeroicReactionAvailabilityTitle('defend', defendAvailable),
			active: defendAvailable,
			visible: true,
		},
		interpose: {
			key: 'interpose',
			iconClass: 'fa-solid fa-hand',
			title: getHeroicReactionAvailabilityTitle('interpose', interposeAvailable),
			active: interposeAvailable,
			visible: true,
		},
		opportunityAttack: {
			key: 'opportunityAttack',
			iconClass: 'fa-solid fa-bolt',
			title: getHeroicReactionAvailabilityTitle('opportunityAttack', opportunityAttackAvailable),
			active: opportunityAttackAvailable,
			visible: true,
		},
		help: {
			key: 'help',
			iconClass: 'fa-solid fa-handshake',
			title: getHeroicReactionAvailabilityTitle('help', helpAvailable),
			active: helpAvailable,
			visible: true,
		},
	};
}

export function getCombatantOutlineClass(combatant: Combatant.Implementation): string {
	if (isPlayerCombatant(combatant)) return 'nimble-ct__portrait--outline-player';
	if (isLegendaryCombatant(combatant)) return 'nimble-ct__portrait--outline-monster';
	if (isFriendlyCombatant(combatant)) return 'nimble-ct__portrait--outline-friendly';
	return 'nimble-ct__portrait--outline-monster';
}

export function getActionState(combatant: Combatant.Implementation): {
	current: number;
	max: number;
} {
	const normalizedCurrent = getCombatantCurrentActions(combatant);
	const normalizedMax = getCombatantMaxActions(combatant);
	return {
		current: normalizedCurrent,
		max: normalizedMax,
	};
}

export function getPortraitFallbackForCombatant(): string {
	return PORTRAIT_FALLBACK_IMAGE;
}

export function getCombatantImageForDisplay(combatant: Combatant.Implementation): string {
	const fallback = getPortraitFallbackForCombatant();
	return (
		getCombatantImage(combatant, {
			includeActorImage: true,
			fallback,
		}) ?? fallback
	);
}
