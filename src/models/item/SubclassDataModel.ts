import { NimbleBaseItemData } from './BaseItemDataModel.js';

const { fields } = foundry.data;

const schema = {
	description: new fields.HTMLField({ required: true, initial: '', nullable: false }),
	parentClass: new fields.StringField({ required: true, initial: '', nullable: false }),
	resources: new fields.ArrayField(new fields.ObjectField({ required: true, nullable: false }), {
		required: true,
		nullable: false,
	}),
};

declare namespace NimbleSubclassData {
	type Schema = NimbleBaseItemData.Schema & typeof schema;
	/** Base data derived from the schema */
	type BaseData = foundry.data.fields.SchemaField.InitializedData<Schema>;
	/** Additional derived/computed data */
	type DerivedData = Record<string, never>;
}

class NimbleSubclassData extends NimbleBaseItemData<
	NimbleSubclassData.Schema,
	NimbleSubclassData.BaseData,
	NimbleSubclassData.DerivedData
> {
	/** @inheritDoc */
	static override defineSchema(): NimbleSubclassData.Schema {
		return {
			...NimbleBaseItemData.defineSchema(),
			...schema,
		};
	}
}

export { NimbleSubclassData };
