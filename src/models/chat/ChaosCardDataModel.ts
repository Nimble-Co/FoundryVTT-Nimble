import { metadata } from './common.js';

const { fields } = foundry.data;

const chaosCardSchema = () => ({
	actorUuid: new fields.StringField({ required: true, nullable: false, initial: '' }),
	/** The attack card that invoked Chaos. Null for a cast with no attack. */
	attackMessageId: new fields.StringField({ required: false, nullable: true, initial: null }),
	status: new fields.StringField({
		required: true,
		nullable: false,
		initial: 'done',
		choices: ['choosing', 'picking', 'done'],
	}),
	advantage: new fields.BooleanField({ required: true, nullable: false, initial: false }),
	rolls: new fields.ArrayField(new fields.ObjectField(), {
		required: true,
		nullable: false,
		initial: [],
	}),
	kept: new fields.NumberField({ required: false, nullable: true, initial: null, integer: true }),
	chooseUses: new fields.NumberField({
		required: true,
		nullable: false,
		initial: 0,
		integer: true,
	}),
});

declare namespace NimbleChaosCardData {
	type Schema = DataSchema & ReturnType<typeof metadata> & ReturnType<typeof chaosCardSchema>;
	interface BaseData extends Record<string, unknown> {}
	interface DerivedData extends Record<string, unknown> {}
}

/** One invocation of the Chaos Table. */
class NimbleChaosCardData extends foundry.abstract.TypeDataModel<
	NimbleChaosCardData.Schema,
	ChatMessage.ConfiguredInstance,
	NimbleChaosCardData.BaseData,
	NimbleChaosCardData.DerivedData
> {
	static override defineSchema(): NimbleChaosCardData.Schema {
		return {
			...metadata(),
			...chaosCardSchema(),
		};
	}
}

export { NimbleChaosCardData };
