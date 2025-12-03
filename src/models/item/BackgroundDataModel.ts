import { NimbleBaseItemData } from './BaseItemDataModel.js';

const { fields } = foundry.data;

const schema = {
	description: new fields.HTMLField({ required: true, initial: '', nullable: false }),
};

declare namespace NimbleBackgroundData {
	type Schema = NimbleBaseItemData.Schema & typeof schema;
	/** Base data derived from the schema */
	type BaseData = foundry.data.fields.SchemaField.InitializedData<Schema>;
	/** Additional derived/computed data */
	type DerivedData = Record<string, never>;
}

class NimbleBackgroundData extends NimbleBaseItemData<
	NimbleBackgroundData.Schema,
	NimbleBackgroundData.BaseData,
	NimbleBackgroundData.DerivedData
> {
	/** @inheritDoc */
	static override defineSchema(): NimbleBackgroundData.Schema {
		return {
			...NimbleBaseItemData.defineSchema(),
			...schema,
		};
	}
}

export { NimbleBackgroundData };
