import { metadata } from './common.js';

const { fields } = foundry.data;

const fieldRestCardSchema = () => ({
	// Rest type: 'catchBreath' or 'makeCamp'
	restType: new fields.StringField({
		required: true,
		nullable: false,
		initial: 'catchBreath',
		choices: ['catchBreath', 'makeCamp'],
	}),
	// Hit dice that were spent: { size: quantity }
	hitDiceSpent: new fields.ObjectField({ required: true, nullable: false, initial: {} }),
	// Total healing amount
	totalHealing: new fields.NumberField({ required: true, nullable: false, initial: 0 }),
	// Whether the dice were maximized
	wasMaximized: new fields.BooleanField({ required: true, initial: false, nullable: false }),
	// Whether advantage was used
	hadAdvantage: new fields.BooleanField({ required: true, initial: false, nullable: false }),
	// Source of advantage (e.g., "Wild One - in the wild")
	advantageSource: new fields.StringField({ required: false, nullable: true, initial: null }),
});

declare namespace NimbleFieldRestCardData {
	type Schema = DataSchema & ReturnType<typeof metadata> & ReturnType<typeof fieldRestCardSchema>;
	interface BaseData extends Record<string, unknown> {}
	interface DerivedData extends Record<string, unknown> {}
}

class NimbleFieldRestCardData extends foundry.abstract.TypeDataModel<
	NimbleFieldRestCardData.Schema,
	ChatMessage.ConfiguredInstance,
	NimbleFieldRestCardData.BaseData,
	NimbleFieldRestCardData.DerivedData
> {
	static override defineSchema(): NimbleFieldRestCardData.Schema {
		return {
			...fieldRestCardSchema(),
			...metadata(),
		};
	}
}

export { NimbleFieldRestCardData };
