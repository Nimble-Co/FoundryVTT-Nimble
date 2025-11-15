import { identifier } from '../common';
import { rules } from './common';

function baseItemSchema() {
	const { fields } = foundry.data;

	return {
		macro: new fields.StringField({ required: true, initial: '', nullable: false }),
		grantedById: new fields.StringField({ required: false, nullable: false, initial: undefined }),
	};
}

declare namespace NimbleBaseItemData {
	type Schema = DataSchema &
		ReturnType<typeof baseItemSchema> &
		ReturnType<typeof identifier> &
		ReturnType<typeof rules>;
	interface BaseData extends Record<string, unknown> {}
	interface DerivedData extends Record<string, unknown> {}
}

class NimbleBaseItemData<
	Schema extends NimbleBaseItemData.Schema,
	BaseData extends NimbleBaseItemData.BaseData,
	DerivedData extends NimbleBaseItemData.DerivedData,
> extends foundry.abstract.TypeDataModel<Schema, Item.ConfiguredInstance, BaseData, DerivedData> {
	/** @inheritDoc */
	static override defineSchema(): NimbleBaseItemData.Schema {
		return {
			...baseItemSchema(),
			...identifier(),
			...rules(),
		};
	}
}

export { NimbleBaseItemData };
