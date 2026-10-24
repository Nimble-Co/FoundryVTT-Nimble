import { incomingReactions, metadata, rerollHistory, roller } from './common.js';

const { fields } = foundry.data;

const skillCheckCardSchema = () => ({
	skillKey: new fields.StringField({ required: true, initial: '', nullable: false }),
	rollMode: new fields.NumberField({
		required: true,
		initial: 0,
		nullable: false,
		integer: true,
	}),
});

declare namespace NimbleSkillCheckCardData {
	type Schema = DataSchema &
		ReturnType<typeof metadata> &
		ReturnType<typeof skillCheckCardSchema> &
		ReturnType<typeof roller> &
		ReturnType<typeof incomingReactions> &
		ReturnType<typeof rerollHistory>;
	interface BaseData extends Record<string, unknown> {}
	interface DerivedData extends Record<string, unknown> {}
}

class NimbleSkillCheckCardData extends foundry.abstract.TypeDataModel<
	NimbleSkillCheckCardData.Schema,
	ChatMessage.ConfiguredInstance,
	NimbleSkillCheckCardData.BaseData,
	NimbleSkillCheckCardData.DerivedData
> {
	static override defineSchema(): NimbleSkillCheckCardData.Schema {
		return {
			...skillCheckCardSchema(),
			...metadata(),
			...roller(),
			...incomingReactions(),
			...rerollHistory(),
		};
	}
}

export { NimbleSkillCheckCardData };
