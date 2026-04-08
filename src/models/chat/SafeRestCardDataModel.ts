import { metadata } from './common.js';

const { fields } = foundry.data;

const safeRestCardSchema = () => ({
	// Hit dice recovered: { size: amount }
	hitDiceRecovered: new fields.ObjectField({ required: true, nullable: false, initial: {} }),
	// HP restored
	hpRestored: new fields.NumberField({ required: true, nullable: false, initial: 0 }),
	// Temp HP removed
	tempHpRemoved: new fields.NumberField({ required: true, nullable: false, initial: 0 }),
	// Mana restored
	manaRestored: new fields.NumberField({ required: true, nullable: false, initial: 0 }),
	// Wounds recovered
	woundsRecovered: new fields.NumberField({ required: true, nullable: false, initial: 0 }),
	// Charge pools recovered: Array of { label, amount, previousValue, newValue, icon }
	chargePoolsRecovered: new fields.ArrayField(
		new fields.ObjectField({
			required: true,
			nullable: false,
			initial: {},
			model: {
				label: new fields.StringField({ required: true }),
				previousValue: new fields.NumberField({ required: true }),
				newValue: new fields.NumberField({ required: true }),
				amount: new fields.NumberField({ required: true }),
				icon: new fields.StringField({ required: false }),
			},
		}),
		{ required: true, nullable: false, initial: [] },
	),
});

declare namespace NimbleSafeRestCardData {
	type Schema = DataSchema & ReturnType<typeof metadata> & ReturnType<typeof safeRestCardSchema>;
	interface BaseData extends Record<string, unknown> {}
	interface DerivedData extends Record<string, unknown> {}
}

class NimbleSafeRestCardData extends foundry.abstract.TypeDataModel<
	NimbleSafeRestCardData.Schema,
	ChatMessage.ConfiguredInstance,
	NimbleSafeRestCardData.BaseData,
	NimbleSafeRestCardData.DerivedData
> {
	static override defineSchema(): NimbleSafeRestCardData.Schema {
		return {
			...safeRestCardSchema(),
			...metadata(),
		};
	}
}

export { NimbleSafeRestCardData };
