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
	objectSizeType: new fields.StringField({
		required: true,
		initial: 'slots',
		nullable: false,
		options: ['slots', 'stackable', 'smallSized'],
	}),
	slotsRequired: new fields.NumberField({
		required: true,
		initial: 0,
		min: 0,
		nullable: false,
	}),
	stackSize: new fields.NumberField({
		required: true,
		initial: 2,
		min: 2,
		nullable: false,
	}),
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
	// Schema-defined properties
	declare activation: {
		showDescription: boolean;
		acquireTargetsFromTemplate: boolean;
		cost: { details: string; quantity: number; type: string; isReaction: boolean };
		duration: { details: string; quantity: number; type: string };
		effects: Record<string, unknown>[];
		targets: {
			count: number;
			restrictions: string;
			attackType: '' | 'melee' | 'reach' | 'range';
			distance: number;
		};
		template: { length: number; radius: number; shape: string; width: number };
	};

	declare description: {
		public: string;
		unidentified: string;
		secret: string;
	};
	declare identified: boolean;
	declare objectType: string;
	declare quantity: number;
	declare unidentifiedName: string;
	declare objectSizeType: 'slots' | 'stackable' | 'smallSized';
	declare slotsRequired: number;
	declare stackSize: number;
	declare properties: {
		reach: { min: number; max: number | null };
		range: { min: number; max: number | null };
		selected: string[];
		strengthRequirement: {
			value: number | null;
			overridesTwoHanded: boolean;
		};
		thrownRange: number;
	};

	/** @inheritDoc */
	static override defineSchema(): NimbleObjectData.Schema {
		return {
			...NimbleBaseItemData.defineSchema(),
			...activation(),
			...schema(),
		};
	}
}

export { NimbleObjectData };
