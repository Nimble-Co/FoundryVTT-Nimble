import { NimbleBaseItemData } from './BaseItemDataModel.js';

const { fields } = foundry.data;

const schema = {
	description: new fields.HTMLField({ required: true, initial: '', nullable: false }),
};

declare namespace NimbleAncestryBonusData {
	type Schema = NimbleBaseItemData.Schema & typeof schema;
	type BaseData = NimbleBaseItemData.BaseData;
	type DerivedData = NimbleBaseItemData.DerivedData;
}

class NimbleAncestryBonusData extends NimbleBaseItemData<
	NimbleAncestryBonusData.Schema,
	NimbleAncestryBonusData.BaseData,
	NimbleAncestryBonusData.DerivedData
> {
	declare description: string;

	/** @inheritDoc */
	static override defineSchema(): NimbleAncestryBonusData.Schema {
		return {
			...NimbleBaseItemData.defineSchema(),
			...schema,
		};
	}
}

export { NimbleAncestryBonusData };
