import { metadata } from './common.js';

const { fields } = foundry.data;

const assessActionCardSchema = () => ({
	skillKey: new fields.StringField({ required: true, initial: '', nullable: false }),
	dc: new fields.NumberField({ required: true, initial: 12, nullable: false, integer: true }),
	isSuccess: new fields.BooleanField({ required: true, initial: false, nullable: false }),
	optionTitle: new fields.StringField({ required: true, initial: '', nullable: false }),
	resultMessage: new fields.StringField({ required: true, initial: '', nullable: false }),
	target: new fields.StringField({ required: false, initial: null, nullable: true }),
	targetName: new fields.StringField({ required: false, initial: null, nullable: true }),
});

declare namespace NimbleAssessActionCardData {
	type Schema = DataSchema &
		ReturnType<typeof metadata> &
		ReturnType<typeof assessActionCardSchema>;
	interface BaseData extends Record<string, unknown> {}
	interface DerivedData extends Record<string, unknown> {}
}

class NimbleAssessActionCardData extends foundry.abstract.TypeDataModel<
	NimbleAssessActionCardData.Schema,
	ChatMessage.ConfiguredInstance,
	NimbleAssessActionCardData.BaseData,
	NimbleAssessActionCardData.DerivedData
> {
	static override defineSchema(): NimbleAssessActionCardData.Schema {
		return {
			...assessActionCardSchema(),
			...metadata(),
		};
	}
}

export { NimbleAssessActionCardData };
