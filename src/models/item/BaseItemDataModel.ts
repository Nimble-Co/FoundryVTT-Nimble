import { identifier } from '../common.js';
import { rules } from './common.js';

function baseItemSchema() {
	const { fields } = foundry.data;

	return {
		macro: new fields.StringField({ required: true, initial: '', nullable: false }),
		grantedById: new fields.StringField({ required: false, nullable: false, initial: undefined }),
	};
}

declare namespace NimbleBaseItemData {
	type Schema = foundry.data.fields.DataSchema &
		ReturnType<typeof baseItemSchema> &
		ReturnType<typeof identifier> &
		ReturnType<typeof rules>;
	/** Base data derived from the schema */
	type BaseData = foundry.data.fields.SchemaField.InitializedData<Schema>;
	/** Additional derived/computed data */
	type DerivedData = Record<string, never>;
}

class NimbleBaseItemData<
	Schema extends NimbleBaseItemData.Schema,
	BaseData extends NimbleBaseItemData.BaseData,
	DerivedData extends NimbleBaseItemData.DerivedData,
> extends foundry.abstract.TypeDataModel<Schema, Item, BaseData, DerivedData> {
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
