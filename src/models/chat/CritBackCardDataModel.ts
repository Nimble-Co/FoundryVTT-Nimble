import { metadata } from './common.js';

const { fields } = foundry.data;

const critBackCardSchema = () => ({
	actorUuid: new fields.StringField({ required: true, nullable: false, initial: '' }),
	heroTokenUuid: new fields.StringField({ required: true, nullable: false, initial: '' }),
	label: new fields.StringField({ required: true, nullable: false, initial: '' }),
	text: new fields.StringField({ required: true, nullable: false, initial: '' }),
	used: new fields.BooleanField({ required: true, nullable: false, initial: false }),
});

declare namespace NimbleCritBackCardData {
	type Schema = DataSchema & ReturnType<typeof metadata> & ReturnType<typeof critBackCardSchema>;
	interface BaseData extends Record<string, unknown> {}
	interface DerivedData extends Record<string, unknown> {}
}

/** The GM's choice of a crit back attack. */
class NimbleCritBackCardData extends foundry.abstract.TypeDataModel<
	NimbleCritBackCardData.Schema,
	ChatMessage.ConfiguredInstance,
	NimbleCritBackCardData.BaseData,
	NimbleCritBackCardData.DerivedData
> {
	static override defineSchema(): NimbleCritBackCardData.Schema {
		return {
			...metadata(),
			...critBackCardSchema(),
		};
	}
}

export { NimbleCritBackCardData };
