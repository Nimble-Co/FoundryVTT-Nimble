import { LEGACY_CONDITION_EFFECT_TYPE, NIMBLE_EFFECT_TYPE } from './nimbleEffectChoices.js';
import { NimbleEffectData } from './nimbleEffectDataModel.js';

const activeEffectDataModels = {
	[NIMBLE_EFFECT_TYPE]: NimbleEffectData,
	[LEGACY_CONDITION_EFFECT_TYPE]: NimbleEffectData,
};

export default activeEffectDataModels;

declare global {
	interface DataModelConfig {
		ActiveEffect: {
			[NIMBLE_EFFECT_TYPE]: NimbleEffectData;
			[LEGACY_CONDITION_EFFECT_TYPE]: NimbleEffectData;
		};
	}
}
