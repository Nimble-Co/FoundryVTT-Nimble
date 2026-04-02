import {
	getCombatTrackerCtCardSizeLevel,
	getCombatTrackerCtEnabled,
	getCombatTrackerCtLeftToRightOrdering,
	getCombatTrackerCtWidthLevel,
	getCombatTrackerNonPlayerHpBarEnabled,
	getCombatTrackerNonPlayerHpBarTextMode,
	getCombatTrackerPlayerHpBarTextMode,
	getCombatTrackerResourceDrawerHoverEnabled,
	isCombatTrackerCardSizeLevelSettingKey,
	isCombatTrackerEnabledSettingKey,
	isCombatTrackerLeftToRightOrderingSettingKey,
	isCombatTrackerNonPlayerHpBarEnabledSettingKey,
	isCombatTrackerNonPlayerHpBarTextModeSettingKey,
	isCombatTrackerPlayerHpBarTextModeSettingKey,
	isCombatTrackerResourceDrawerHoverSettingKey,
	isCombatTrackerWidthLevelSettingKey,
} from '../../../settings/combatTrackerSettings.js';
import { getCombatForCurrentScene, syncCombatTurnsForCt } from './combat.utils.js';
import type { CtTopTrackerSettingPatch } from './types.js';

export function resolveCtTopTrackerSettingPatch(
	settingKey: unknown,
): CtTopTrackerSettingPatch | null {
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
	if (isCombatTrackerLeftToRightOrderingSettingKey(settingKey)) {
		return {
			ctLeftToRightOrdering: getCombatTrackerCtLeftToRightOrdering(),
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
	canCurrentUserViewExpandedMonsters: boolean;
	sharedMonsterCardsExpanded: boolean;
}): boolean {
	if (!params.hasMonsterCombatants) return false;
	if (!params.canCurrentUserViewExpandedMonsters) return false;
	return params.sharedMonsterCardsExpanded;
}
