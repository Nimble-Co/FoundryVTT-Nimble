import { metadata } from './common.js';

const { fields } = foundry.data;

const effectsEndedCardSchema = () => ({
	/** The moment, already in words: "Start of Tessa's turn". */
	heading: new fields.StringField({ required: true, nullable: false, initial: '' }),
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

/** One message for each moment: the effects that ended at it, each with Undo. */
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
