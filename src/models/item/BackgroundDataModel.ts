import { NimbleBaseItemData } from './BaseItemDataModel.js';

const { fields } = foundry.data;

const schema = {
	description: new fields.HTMLField({ required: true, initial: '', nullable: false }),
};

declare namespace NimbleBackgroundData {
	type Schema = NimbleBaseItemData.Schema & typeof schema;
	type BaseData = NimbleBaseItemData.BaseData;
	type DerivedData = NimbleBaseItemData.DerivedData;
}

class NimbleBackgroundData extends NimbleBaseItemData<
	NimbleBackgroundData.Schema,
	NimbleBackgroundData.BaseData,
	NimbleBackgroundData.DerivedData
> {
	declare description: string;

	/** @inheritDoc */
	static override defineSchema(): NimbleBackgroundData.Schema {
		return {
			...NimbleBaseItemData.defineSchema(),
			...schema,
		};
	}
}

export { NimbleBackgroundData };
