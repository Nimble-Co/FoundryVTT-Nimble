import {
	getCombatTrackerCtCardSizeLevel,
	getCombatTrackerCtEnabled,
	getCombatTrackerCtWidthLevel,
	getCombatTrackerNonPlayerHpBarEnabled,
	getCombatTrackerNonPlayerHpBarTextMode,
	getCombatTrackerPlayerHpBarTextMode,
	getCombatTrackerPlayersCanExpandMonsterCards,
	getCombatTrackerResourceDrawerHoverEnabled,
	isCombatTrackerCardSizeLevelSettingKey,
	isCombatTrackerEnabledSettingKey,
	isCombatTrackerNonPlayerHpBarEnabledSettingKey,
	isCombatTrackerNonPlayerHpBarTextModeSettingKey,
	isCombatTrackerPlayerHpBarTextModeSettingKey,
	isCombatTrackerPlayerMonsterExpansionSettingKey,
	isCombatTrackerResourceDrawerHoverSettingKey,
	isCombatTrackerWidthLevelSettingKey,
} from '../../../settings/combatTrackerSettings.js';
import { getCombatForCurrentScene, syncCombatTurnsForCt } from './combatTracker.utils.js';
import type { CtTopTrackerSettingPatch } from './types.js';

export function resolveCtTopTrackerSettingPatch(
	settingKey: unknown,
): CtTopTrackerSettingPatch | null {
	if (isCombatTrackerPlayerMonsterExpansionSettingKey(settingKey)) {
		return {
			playersCanExpandMonsterCards: getCombatTrackerPlayersCanExpandMonsterCards(),
		};
	}
	if (isCombatTrackerResourceDrawerHoverSettingKey(settingKey)) {
		return {
			resourceDrawerHoverEnabled: getCombatTrackerResourceDrawerHoverEnabled(),
		};
	}
	if (isCombatTrackerPlayerHpBarTextModeSettingKey(settingKey)) {
		return {
			playerHpBarTextMode: getCombatTrackerPlayerHpBarTextMode(),
		};
	}
	if (isCombatTrackerNonPlayerHpBarEnabledSettingKey(settingKey)) {
		return {
			nonPlayerHpBarEnabled: getCombatTrackerNonPlayerHpBarEnabled(),
		};
	}
	if (isCombatTrackerNonPlayerHpBarTextModeSettingKey(settingKey)) {
		return {
			nonPlayerHpBarTextMode: getCombatTrackerNonPlayerHpBarTextMode(),
		};
	}
	if (isCombatTrackerEnabledSettingKey(settingKey)) {
		return {
			ctEnabled: getCombatTrackerCtEnabled(),
		};
	}
	if (isCombatTrackerWidthLevelSettingKey(settingKey)) {
		return {
			ctWidthLevel: getCombatTrackerCtWidthLevel(),
			layoutVersionDelta: 1,
		};
	}
	if (isCombatTrackerCardSizeLevelSettingKey(settingKey)) {
		return {
			ctCardSizeLevel: getCombatTrackerCtCardSizeLevel(),
			layoutVersionDelta: 1,
			shouldCenterActiveEntry: true,
		};
	}
	return null;
}

export function resolveActionCombatState(params: {
	currentCombat: Combat | null;
	preferredCombatId: string | null;
}): { combat: Combat | null; preferredCombatId: string | null } {
	const sceneCombat = getCombatForCurrentScene(params.preferredCombatId);
	if (sceneCombat) {
		syncCombatTurnsForCt(sceneCombat);
		return {
			combat: sceneCombat,
			preferredCombatId: sceneCombat.id ?? sceneCombat._id ?? null,
		};
	}

	const currentCombatId = params.currentCombat?.id ?? params.currentCombat?._id ?? '';
	if (!currentCombatId) {
		return {
			combat: params.currentCombat,
			preferredCombatId: params.preferredCombatId,
		};
	}

	const fallbackCombat = game.combats.get(currentCombatId) ?? params.currentCombat;
	syncCombatTurnsForCt(fallbackCombat);
	return {
		combat: fallbackCombat,
		preferredCombatId: params.preferredCombatId,
	};
}

export function resolveMonsterCardsExpandedState(params: {
	hasMonsterCombatants: boolean;
	canCurrentUserExpandMonsterCards: boolean;
	monsterCardsExpanded: boolean;
}): boolean {
	if (!params.hasMonsterCombatants) return false;
	if (!params.canCurrentUserExpandMonsterCards) return false;
	return params.monsterCardsExpanded;
}
