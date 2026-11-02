import { metadata } from './common.js';

const { fields } = foundry.data;

const demandControlCardSchema = () => ({
	actorUuid: new fields.StringField({ required: true, nullable: false, initial: '' }),
	option: new fields.StringField({ required: true, nullable: false, initial: '' }),
	text: new fields.StringField({ required: true, nullable: false, initial: '' }),
	/** The rows the GM has done on a LOSE CONTROL card. */
	done: new fields.ArrayField(new fields.StringField({ required: true, nullable: false }), {
		required: true,
		nullable: false,
		initial: [],
	}),
});

declare namespace NimbleDemandControlCardData {
	type Schema = DataSchema &
		ReturnType<typeof metadata> &
		ReturnType<typeof demandControlCardSchema>;
	interface BaseData extends Record<string, unknown> {}
	interface DerivedData extends Record<string, unknown> {}
}

/** The result of a Demand Control. */
class NimbleDemandControlCardData extends foundry.abstract.TypeDataModel<
	NimbleDemandControlCardData.Schema,
	ChatMessage.ConfiguredInstance,
	NimbleDemandControlCardData.BaseData,
	NimbleDemandControlCardData.DerivedData
> {
	static override defineSchema(): NimbleDemandControlCardData.Schema {
		return {
			...metadata(),
			...demandControlCardSchema(),
		};
	}
}

export { NimbleDemandControlCardData };
