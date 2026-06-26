import { NimbleBaseItemData } from './BaseItemDataModel.js';

const { fields } = foundry.data;

const schema = {
	description: new fields.HTMLField({ required: true, initial: '', nullable: false }),
	exotic: new fields.BooleanField({ required: true, initial: false, nullable: false }),
	size: new fields.ArrayField(
		new fields.StringField({ required: true, initial: 'medium', nullable: false }),
		{ required: true, nullable: false, initial: () => [] },
	),
	// Compendium UUID of the ancestry's default bonus trait. Players may swap this for
	// any other ancestry bonus during character creation.
	defaultBonus: new fields.StringField({ required: true, initial: '', nullable: false }),
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
	declare description: string;

	declare exotic: boolean;

	declare size: string[];

	declare defaultBonus: string;

	/** @inheritDoc */
	static override defineSchema(): NimbleAncestryData.Schema {
		return {
			...NimbleBaseItemData.defineSchema(),
			...schema,
		};
	}
}

export { NimbleAncestryData };
