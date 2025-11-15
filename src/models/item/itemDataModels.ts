import { NimbleBackgroundData } from './BackgroundDataModel';
import { NimbleBoonData } from './BoonDataModel';
import { NimbleClassData } from './ClassDataModel';
import { NimbleFeatureData } from './FeatureDataModel';
import { NimbleMonsterFeatureData } from './MonsterFeatureDataModel';
import { NimbleObjectData } from './ObjectDataModel';
import { NimbleAncestryData } from './AncestryDataModel';
import { NimbleSpellData } from './SpellDataModel';
import { NimbleSubclassData } from './SubclassDataModel';

const itemDataModels = {
	background: NimbleBackgroundData,
	boon: NimbleBoonData,
	class: NimbleClassData,
	feature: NimbleFeatureData,
	monsterFeature: NimbleMonsterFeatureData,
	object: NimbleObjectData,
	ancestry: NimbleAncestryData,
	spell: NimbleSpellData,
	subclass: NimbleSubclassData,
};

export default itemDataModels;

// Merge types into fvtt-types
declare global {
	interface DataModelConfig {
		Item: {
			background: NimbleBackgroundData;
			boon: NimbleBoonData;
			class: NimbleClassData;
			feature: NimbleFeatureData;
			monsterFeature: NimbleMonsterFeatureData;
			object: NimbleObjectData;
			ancestry: NimbleAncestryData;
			spell: NimbleSpellData;
			subclass: NimbleSubclassData;
		};
	}
}
