import { HIT_DIE_SIZES } from './ClassSheetConstants.js';

type TagOption = { label: string; value: string | number };

export function prepareAbilityScoreTagOptions(): TagOption[] {
	return Object.entries(CONFIG.NIMBLE.abilityScores).map(([key, label]) => ({
		label: label as string,
		value: key,
	}));
}

export function prepareArmorOptions(): TagOption[] {
	return Object.entries(CONFIG.NIMBLE.armorTypesPlural)
		.map(([key, label]) => ({ value: key, label: label as string }))
		.sort((a, b) => a.label.localeCompare(b.label));
}

export function prepareHitDieTagOptions(): TagOption[] {
	return HIT_DIE_SIZES.map((dieSize) => ({
		label: `d${dieSize}`,
		value: dieSize,
	}));
}

export function prepareManaRecoveryTypeOptions(): TagOption[] {
	return Object.entries(CONFIG.NIMBLE.manaRecoveryTypes).map(([key, label]) => ({
		label: label as string,
		value: key,
	}));
}

export function prepareSavingThrowTagOptions(): TagOption[] {
	return Object.entries(CONFIG.NIMBLE.savingThrows).map(([key, label]) => ({
		label: label as string,
		value: key,
	}));
}
