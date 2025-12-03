import { NimbleBaseItemData } from './BaseItemDataModel.js';
import { activation } from './common.js';

const { fields } = foundry.data;

const MONSTER_FEATURE_SUBTYPES = {
	feature: 'NIMBLE.monsterFeatureSubtypes.feature',
	action: 'NIMBLE.monsterFeatureSubtypes.action',
	bloodied: 'NIMBLE.monsterFeatureSubtypes.bloodied',
	lastStand: 'NIMBLE.monsterFeatureSubtypes.lastStand',
};

const schema = () => ({
	description: new fields.HTMLField({ required: true, initial: '', nullable: false }),
	subtype: new fields.StringField({
		required: true,
		initial: 'feature',
		nullable: false,
		choices: MONSTER_FEATURE_SUBTYPES,
	}),
});

declare namespace NimbleMonsterFeatureData {
	type Schema = NimbleBaseItemData.Schema &
		ReturnType<typeof activation> &
		ReturnType<typeof schema>;
	/** Base data derived from the schema */
	type BaseData = foundry.data.fields.SchemaField.InitializedData<Schema>;
	/** Additional derived/computed data */
	type DerivedData = Record<string, never>;
}

class NimbleMonsterFeatureData extends NimbleBaseItemData<
	NimbleMonsterFeatureData.Schema,
	NimbleMonsterFeatureData.BaseData,
	NimbleMonsterFeatureData.DerivedData
> {
	/** @inheritDoc */
	static override defineSchema(): NimbleMonsterFeatureData.Schema {
		return {
			...NimbleBaseItemData.defineSchema(),
			...activation(),
			...schema(),
		};
	}
}

export { NimbleMonsterFeatureData };
