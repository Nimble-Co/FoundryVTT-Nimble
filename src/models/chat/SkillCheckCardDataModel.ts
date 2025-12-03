import { metadata } from './common.js';

const { fields } = foundry.data;

const skillCheckCardSchema = () => ({
	skillKey: new fields.StringField({ required: true, initial: '', nullable: false }),
});

declare namespace NimbleSkillCheckCardData {
	type Schema = foundry.data.fields.DataSchema &
		ReturnType<typeof metadata> &
		ReturnType<typeof skillCheckCardSchema>;
	interface BaseData extends Record<string, unknown> {}
	interface DerivedData extends Record<string, unknown> {}
}

class NimbleSkillCheckCardData extends foundry.abstract.TypeDataModel<
	NimbleSkillCheckCardData.Schema,
	ChatMessage,
	NimbleSkillCheckCardData.BaseData,
	NimbleSkillCheckCardData.DerivedData
> {
	static override defineSchema(): NimbleSkillCheckCardData.Schema {
		return {
			...skillCheckCardSchema(),
			...metadata(),
		};
	}
}

export { NimbleSkillCheckCardData };
