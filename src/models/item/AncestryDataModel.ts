import { NimbleBaseItemData } from './BaseItemDataModel.js';

const { fields } = foundry.data;

const schema = {
	description: new fields.HTMLField({ required: true, initial: '', nullable: false }),
	exotic: new fields.BooleanField({ required: true, initial: false, nullable: false }),
	size: new fields.ArrayField(
		new fields.StringField({ required: true, initial: 'medium', nullable: false }),
		{ required: true, nullable: false, initial: () => [] },
	),
};

declare namespace NimbleAncestryData {
	type Schema = NimbleBaseItemData.Schema & typeof schema;
	type BaseData = NimbleBaseItemData.BaseData;
	type DerivedData = NimbleBaseItemData.DerivedData;
}

class NimbleAncestryData extends NimbleBaseItemData<
	NimbleAncestryData.Schema,
	NimbleAncestryData.BaseData,
	NimbleAncestryData.DerivedData
> {
	/** @inheritDoc */
	static override defineSchema(): NimbleAncestryData.Schema {
		return {
			...NimbleBaseItemData.defineSchema(),
			...schema,
		};
	}
}

export { NimbleAncestryData };
