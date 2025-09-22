import { NimbleBaseItemData } from './BaseItemDataModel.js';
import { activation } from './common.js';

const { fields } = foundry.data;

const schema = () => ({
	description: new fields.HTMLField({ required: true, initial: '', nullable: false }),
	isAction: new fields.BooleanField({ required: true, initial: false, nullable: false }),
});

declare namespace NimbleMonsterFeatureData {
	type Schema = NimbleBaseItemData.Schema &
		ReturnType<typeof activation> &
		ReturnType<typeof schema>;
	type BaseData = NimbleBaseItemData.BaseData;
	type DerivedData = NimbleBaseItemData.DerivedData;
}

class NimbleMonsterFeatureData extends NimbleBaseItemData<
	NimbleMonsterFeatureData.Schema,
	NimbleMonsterFeatureData.BaseData,
	NimbleMonsterFeatureData.DerivedData
> {
	/** @inheritDoc */
	static override defineSchema(): NimbleMonsterFeatureData.Schema {
		return {
			...super.defineSchema(),
			...activation(),
			...schema(),
		};
	}
}

export { NimbleMonsterFeatureData };
