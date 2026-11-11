import { metadata } from './common.js';

const { fields } = foundry.data;

const effectsEndedCardSchema = () => ({
	/** The moment in words, on cards from before `momentHeading`. */
	heading: new fields.StringField({ required: true, nullable: false, initial: '' }),
	/** Finds the card of a moment, so all lines of the moment go on one card. */
	momentKey: new fields.StringField({ required: true, nullable: false, initial: '' }),
	/** The moment as a lang key and data, localized on each client. */
	momentHeading: new fields.ObjectField({ required: false, nullable: true, initial: null }),
	/** The ended effects of cards from before the Events strip. New lines are in the events flag. */
	rows: new fields.ArrayField(
		new fields.SchemaField({
			effectId: new fields.StringField({ required: true, nullable: false, initial: '' }),
			holderUuid: new fields.StringField({ required: true, nullable: false, initial: '' }),
			holderName: new fields.StringField({ required: true, nullable: false, initial: '' }),
			name: new fields.StringField({ required: true, nullable: false, initial: '' }),
			img: new fields.StringField({ required: true, nullable: false, initial: '' }),
			sourceName: new fields.StringField({ required: true, nullable: false, initial: '' }),
			/** The stored data of the effect, to make it again with Undo. */
			effect: new fields.ObjectField({ required: true, nullable: false, initial: {} }),
		}),
		{ required: true, nullable: false, initial: [] },
	),
});

declare namespace NimbleEffectsEndedCardData {
	type Schema = DataSchema &
		ReturnType<typeof metadata> &
		ReturnType<typeof effectsEndedCardSchema>;
	interface BaseData extends Record<string, unknown> {}
	interface DerivedData extends Record<string, unknown> {}
}

/** One card for each moment with no host card: the events of the moment, in order. */
class NimbleEffectsEndedCardData extends foundry.abstract.TypeDataModel<
	NimbleEffectsEndedCardData.Schema,
	ChatMessage.ConfiguredInstance,
	NimbleEffectsEndedCardData.BaseData,
	NimbleEffectsEndedCardData.DerivedData
> {
	static override defineSchema(): NimbleEffectsEndedCardData.Schema {
		return {
			...effectsEndedCardSchema(),
			...metadata(),
		};
	}
}

export { NimbleEffectsEndedCardData };
