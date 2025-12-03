import { NimbleBaseItemData } from './BaseItemDataModel.js';

const { fields } = foundry.data;

const schema = {
	description: new fields.HTMLField({
		required: true,
		initial: '',
		nullable: false,
	}),
	boonType: new fields.StringField({
		required: true,
		initial: 'minor',
		nullable: false,
	}),
};

declare namespace NimbleBoonData {
	type Schema = NimbleBaseItemData.Schema & typeof schema;
	/** Base data derived from the schema */
	type BaseData = foundry.data.fields.SchemaField.InitializedData<Schema>;
	/** Additional derived/computed data */
	type DerivedData = Record<string, never>;
}

class NimbleBoonData extends NimbleBaseItemData<
	NimbleBoonData.Schema,
	NimbleBoonData.BaseData,
	NimbleBoonData.DerivedData
> {
	/** @inheritDoc */
	static override defineSchema(): NimbleBoonData.Schema {
		return {
			...NimbleBaseItemData.defineSchema(),
			...schema,
		};
	}
}

export { NimbleBoonData };
