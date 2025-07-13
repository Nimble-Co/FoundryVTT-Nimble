import { NimbleBaseItemData } from './BaseItemDataModel.js';
import { activation, baseProperties } from './common.js';

const { fields } = foundry.data;

const schema = () => ({
	description: new fields.SchemaField({
		public: new fields.HTMLField({ required: true, initial: '', nullable: false }),
		unidentified: new fields.HTMLField({ required: true, initial: '', nullable: false }),
		secret: new fields.HTMLField({ required: true, initial: '', nullable: false }),
	}),
	identified: new fields.BooleanField({ required: true, nullable: false, initial: true }),
	objectType: new fields.StringField({ required: true, initial: '', nullable: false }),
	quantity: new fields.NumberField({
		required: true,
		initial: 1,
		nullable: false,
		min: 0,
	}),
	unidentifiedName: new fields.StringField({
		required: true,
		initial: 'Unidentified Object',
		nullable: false,
	}),
	slotsRequired: new fields.NumberField({
		required: true,
		initial: 0,
		min: 0,
		nullable: false,
	}),
	stackable: new fields.BooleanField({ required: true, initial: false, nullable: false }),
	properties: new fields.SchemaField({
		...baseProperties(),
		selected: new fields.ArrayField(
			new fields.StringField({ required: true, nullable: false, initial: '' }),
			{
				required: true,
				nullable: false,
				initial: [],
				options: [
					'concentration',
					'light',
					'load',
					'range',
					'reach',
					'thrown',
					'twoHanded',
					'vicious',
				],
			},
		),
		strengthRequirement: new fields.SchemaField({
			value: new fields.NumberField({ required: true, nullable: true, initial: null }),
			overridesTwoHanded: new fields.BooleanField({
				required: true,
				initial: false,
				nullable: false,
			}),
		}),
		thrownRange: new fields.NumberField({ required: true, nullable: false, initial: 4 }),
	}),
});

declare namespace NimbleObjectData {
	type Schema = NimbleBaseItemData.Schema &
		ReturnType<typeof activation> &
		ReturnType<typeof schema>;
	type BaseData = NimbleBaseItemData.BaseData;
	type DerivedData = NimbleBaseItemData.DerivedData;
}

class NimbleObjectData extends NimbleBaseItemData<
	NimbleObjectData.Schema,
	NimbleObjectData.BaseData,
	NimbleObjectData.DerivedData
> {
	/** @inheritDoc */
	static override defineSchema(): NimbleObjectData.Schema {
		return {
			...super.defineSchema(),
			...activation(),
			...schema(),
		};
	}
}

export { NimbleObjectData };
