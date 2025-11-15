import { NimbleConditionEffectData } from './conditionDataModel';

const activeEffectDataModels = {
	condition: NimbleConditionEffectData,
};

export default activeEffectDataModels;

declare global {
	interface DataModelConfig {
		ActiveEffect: {
			condition: NimbleConditionEffectData;
		};
	}
}
