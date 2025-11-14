import { NimbleBaseItemData } from './BaseItemDataModel.js';
import { activation, baseProperties } from './common.js';

const { fields } = foundry.data;

const schema = () => ({
	description: new fields.SchemaField({
		baseEffect: new fields.HTMLField({ required: true, initial: '', nullable: false }),
		higherLevelEffect: new fields.HTMLField({ required: true, initial: '', nullable: false }),
	}),
	properties: new fields.SchemaField({
		...baseProperties(),
		selected: new fields.ArrayField(new fields.StringField({ nullable: false, initial: '' }), {
			required: true,
			nullable: false,
			initial: [],
			options: ['concentration', 'range', 'reach', 'utilitySpell'],
		}),
	}),
	school: new fields.StringField({ required: true, initial: '', nullable: false }),
	tier: new fields.NumberField({
		required: true,
		initial: 0,
		min: 0,
		max: 9,
		nullable: false,
	}),
});

declare namespace NimbleSpellData {
	type Schema = NimbleBaseItemData.Schema &
		ReturnType<typeof activation> &
		ReturnType<typeof schema>;
	type BaseData = NimbleBaseItemData.BaseData;
	type DerivedData = NimbleBaseItemData.DerivedData;
}

class NimbleSpellData extends NimbleBaseItemData<
	NimbleSpellData.Schema,
	NimbleSpellData.BaseData,
	NimbleSpellData.DerivedData
> {
	/** @inheritDoc */
	static override defineSchema(): NimbleSpellData.Schema {
		return {
			...NimbleBaseItemData.defineSchema(),
			...activation(),
			...schema(),
		};
	}
}

export { NimbleSpellData };
