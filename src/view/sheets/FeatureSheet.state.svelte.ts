import type { FeatureSheetProps } from '#types/components/FeatureSheet.d.ts';
import {
	getGainedAtLevelsDisplayValue,
	getSelectionCountByLevelDisplayValue,
	parseLevels,
	parseSelectionCountByLevel,
} from './FeatureSheetUtils.js';

export function createFeatureSheetState(getProps: () => FeatureSheetProps) {
	const { featureTypes } = CONFIG.NIMBLE;
	const featureTypeOptions = Object.entries(featureTypes).map(([key, featureType]) => ({
		label: featureType as string,
		value: key,
	}));

	return {
		featureTypeOptions,
		get gainedAtLevelsInputValue() {
			const { item } = getProps();
			return getGainedAtLevelsDisplayValue(
				item.reactive.system.gainedAtLevels ?? [],
				item.reactive.system.gainedAtLevel,
			);
		},
		get selectionCountByLevelInputValue() {
			const { item } = getProps();
			return getSelectionCountByLevelDisplayValue(item.reactive.system.selectionCountByLevel ?? {});
		},
		updateFeatureType(newSelection: string) {
			void getProps().item.update({ 'system.featureType': newSelection } as Record<
				string,
				unknown
			>);
		},
		updateGainedAtLevels(rawLevels: string) {
			const levels = parseLevels(rawLevels);
			void getProps().item.update({
				'system.gainedAtLevels': levels,
				'system.gainedAtLevel': levels[0] ?? null,
			} as Record<string, unknown>);
		},
		updateSelectionCountByLevel(rawInput: string) {
			void getProps().item.update({
				'system.selectionCountByLevel': parseSelectionCountByLevel(rawInput),
			} as Record<string, unknown>);
		},
		updateSubclassFlag(checked: boolean) {
			void getProps().item.update({ 'system.subclass': checked } as Record<string, unknown>);
		},
	};
}
