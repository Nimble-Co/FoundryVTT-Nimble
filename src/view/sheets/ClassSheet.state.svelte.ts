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
		toggleAdvantageSavingThrow(savingThrow: string) {
			void getProps().item.update({
				'system.savingThrows.advantage': savingThrow,
			} as Record<string, unknown>);
		},
		toggleArmorProficiency(armorType: string) {
			const { item } = getProps();
			const current = item.reactive.system.armorProficiencies;
			void item.update({
				'system.armorProficiencies': current.includes(armorType)
					? current.filter((key) => key !== armorType)
					: [...current, armorType],
			} as Record<string, unknown>);
		},
		toggleDisadvantageSavingThrow(savingThrow: string) {
			void getProps().item.update({
				'system.savingThrows.disadvantage': savingThrow,
			} as Record<string, unknown>);
		},
		toggleHitDieSize(hitDie: number) {
			void getProps().item.update({ 'system.hitDieSize': hitDie } as Record<string, unknown>);
		},
		toggleManaRecoveryType(recoveryType: string) {
			void getProps().item.update({
				'system.mana.recovery': recoveryType,
			} as Record<string, unknown>);
		},
		toggleKeyAbilityScoreOption(abilityScore: string) {
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
