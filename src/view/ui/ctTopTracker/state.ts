import {
	getCombatTrackerCenterActiveCardEnabled,
	getCombatTrackerCtBadgeSizeLevel,
	getCombatTrackerCtCardSizeLevel,
	getCombatTrackerCtEnabled,
	getCombatTrackerCtWidthLevel,
	getCombatTrackerPlayersCanExpandMonsterCards,
	getCombatTrackerUseActionDice,
	getCombatTrackerVisibilityPermissionConfig,
	isCombatTrackerBadgeSizeLevelSettingKey,
	isCombatTrackerCardSizeLevelSettingKey,
	isCombatTrackerCenterActiveCardSettingKey,
	isCombatTrackerEnabledSettingKey,
	isCombatTrackerPlayerMonsterExpansionSettingKey,
	isCombatTrackerUseActionDiceSettingKey,
	isCombatTrackerVisibilityPermissionSettingKey,
	isCombatTrackerWidthLevelSettingKey,
} from '../../../settings/combatTrackerSettings.js';
import { getCombatForCurrentScene, syncCombatTurnsForCt } from './helpers.js';
import type { CtTopTrackerSettingPatch } from './types.js';

export function resolveCtTopTrackerSettingPatch(
	settingKey: unknown,
): CtTopTrackerSettingPatch | null {
	if (isCombatTrackerPlayerMonsterExpansionSettingKey(settingKey)) {
		return {
			playersCanExpandMonsterCards: getCombatTrackerPlayersCanExpandMonsterCards(),
		};
	}
	if (isCombatTrackerCenterActiveCardSettingKey(settingKey)) {
		return {
			centerActiveCardEnabled: getCombatTrackerCenterActiveCardEnabled(),
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
	if (isCombatTrackerBadgeSizeLevelSettingKey(settingKey)) {
		return {
			ctBadgeSizeLevel: getCombatTrackerCtBadgeSizeLevel(),
		};
	}
	if (isCombatTrackerUseActionDiceSettingKey(settingKey)) {
		return {
			useActionDice: getCombatTrackerUseActionDice(),
		};
	}
	if (isCombatTrackerVisibilityPermissionSettingKey(settingKey)) {
		return {
			visibilityPermissions: getCombatTrackerVisibilityPermissionConfig(),
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
