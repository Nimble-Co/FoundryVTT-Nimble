import type { ClassSheetProps } from '#types/components/ClassSheet.d.ts';
import {
	prepareAbilityScoreTagOptions,
	prepareArmorOptions,
	prepareHitDieTagOptions,
	prepareManaRecoveryTypeOptions,
	prepareSavingThrowTagOptions,
} from './ClassSheetUtils.js';

export function createClassSheetState(getProps: () => ClassSheetProps) {
	const abilityScoreOptions = prepareAbilityScoreTagOptions();
	const armorOptions = prepareArmorOptions();
	const hitDieOptions = prepareHitDieTagOptions();
	const manaRecoveryOptions = prepareManaRecoveryTypeOptions();
	const savingThrowOptions = prepareSavingThrowTagOptions();
	const { saves } = CONFIG.NIMBLE;

	return {
		abilityScoreOptions,
		armorOptions,
		hitDieOptions,
		manaRecoveryOptions,
		savingThrowOptions,
		saves,

		addWeaponProficiency() {
			const { item } = getProps();
			void item.update({
				'system.weaponProficiencies': [...item.reactive.system.weaponProficiencies, ''],
			} as Record<string, unknown>);
		},
		deleteWeaponProficiency(index: number) {
			const { item } = getProps();
			void item.update({
				'system.weaponProficiencies': item.reactive.system.weaponProficiencies.filter(
					(_, i) => i !== index,
				),
			} as Record<string, unknown>);
		},
		updateWeaponProficiency(index: number, value: string) {
			const { item } = getProps();
			void item.update({
				'system.weaponProficiencies': item.reactive.system.weaponProficiencies.map((weapon, i) =>
					i === index ? value : weapon,
				),
			} as Record<string, unknown>);
		},
		addFeatureGroup() {
			const { item } = getProps();
			void item.update({
				'system.groupIdentifiers': [...(item.reactive.system.groupIdentifiers ?? []), ''],
			} as Record<string, unknown>);
		},
		deleteFeatureGroup(index: number) {
			const { item } = getProps();
			void item.update({
				'system.groupIdentifiers': (item.reactive.system.groupIdentifiers ?? []).filter(
					(_, i) => i !== index,
				),
			} as Record<string, unknown>);
		},
		updateFeatureGroup(index: number, value: string) {
			const { item } = getProps();
			void item.update({
				'system.groupIdentifiers': (item.reactive.system.groupIdentifiers ?? []).map((group, i) =>
					i === index ? value : group,
				),
			} as Record<string, unknown>);
		},
		toggleAdvantageSavingThrow(savingThrow: string | number) {
			void getProps().item.update({
				'system.savingThrows.advantage': String(savingThrow),
			} as Record<string, unknown>);
		},
		toggleArmorProficiency(armorTypeValue: string | number) {
			const armorType = String(armorTypeValue);
			const { item } = getProps();
			const current = item.reactive.system.armorProficiencies;
			void item.update({
				'system.armorProficiencies': current.includes(armorType)
					? current.filter((key) => key !== armorType)
					: [...current, armorType],
			} as Record<string, unknown>);
		},
		toggleDisadvantageSavingThrow(savingThrow: string | number) {
			void getProps().item.update({
				'system.savingThrows.disadvantage': String(savingThrow),
			} as Record<string, unknown>);
		},
		toggleHitDieSize(hitDie: string | number) {
			void getProps().item.update({
				'system.hitDieSize': Number(hitDie),
			} as Record<string, unknown>);
		},
		toggleManaRecoveryType(recoveryType: string | number) {
			void getProps().item.update({
				'system.mana.recovery': String(recoveryType),
			} as Record<string, unknown>);
		},
		toggleKeyAbilityScoreOption(abilityScoreValue: string | number) {
			const abilityScore = String(abilityScoreValue);
			const { item } = getProps();
			const current = item.reactive.system.keyAbilityScores;
			void item.update({
				'system.keyAbilityScores': current.includes(abilityScore)
					? current.filter((key) => key !== abilityScore)
					: [...current, abilityScore],
			} as Record<string, unknown>);
		},
	};
}
