import { NimbleBaseItemData } from './BaseItemDataModel.js';
import { activation } from './common.js';

const { fields } = foundry.data;

const schema = () => ({
	description: new fields.HTMLField({ required: true, initial: '', nullable: false }),
	featureType: new fields.StringField({ required: true, nullable: false, initial: 'class' }),
	class: new fields.StringField({ required: true, nullable: false, initial: '' }),
	group: new fields.StringField({ required: true, nullable: false, initial: '' }),
	subclass: new fields.BooleanField({
		required: false,
		nullable: false,
		initial: false,
	}),
	gainedAtLevel: new fields.NumberField({
		required: false,
		nullable: true,
		initial: null,
		integer: true,
		min: 1,
		max: 20,
	}),
	gainedAtLevels: new fields.ArrayField(
		new fields.NumberField({
			required: true,
			nullable: false,
			integer: true,
			min: 1,
			max: 20,
		}),
		{
			required: false,
			nullable: false,
			initial: [],
		},
	),
});

declare namespace NimbleFeatureData {
	type Schema = NimbleBaseItemData.Schema &
		ReturnType<typeof activation> &
		ReturnType<typeof schema>;
	type BaseData = NimbleBaseItemData.BaseData;
	type DerivedData = NimbleBaseItemData.DerivedData;
}

class NimbleFeatureData extends NimbleBaseItemData<
	NimbleFeatureData.Schema,
	NimbleFeatureData.BaseData,
	NimbleFeatureData.DerivedData
> {
	declare description: string;

	declare featureType: string;

	declare class: string;

	declare group: string;

	declare subclass: boolean;

	declare gainedAtLevel: number | null;

	declare gainedAtLevels: number[];

	declare activation: {
		showDescription: boolean;
		acquireTargetsFromTemplate: boolean;
		cost: { details: string; quantity: number; type: string; isReaction: boolean };
		duration: { details: string; quantity: number; type: string };
		effects: Record<string, unknown>[];
		targets: {
			count: number;
			restrictions: string;
			attackType: '' | 'reach' | 'range';
			distance: number;
		};
		template: { length: number; radius: number; shape: string; width: number };
	};

	/** @inheritDoc */
	static override defineSchema(): NimbleFeatureData.Schema {
		return {
			...NimbleBaseItemData.defineSchema(),
			...activation(),
			...schema(),
		};
	}
}

export { NimbleFeatureData };
