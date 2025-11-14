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
	type BaseData = NimbleBaseItemData.BaseData;
	type DerivedData = NimbleBaseItemData.DerivedData;
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
