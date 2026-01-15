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
