import { metadata } from './common.js';

const { fields } = foundry.data;

const abilityCheckCardSchema = () => ({
	abilityKey: new fields.StringField({ required: true, initial: '', nullable: false }),
	rollMode: new fields.NumberField({ required: true, initial: 0, nullable: false }),
});

declare namespace NimbleAbilityCheckCardData {
	type Schema = foundry.data.fields.DataSchema &
		ReturnType<typeof metadata> &
		ReturnType<typeof abilityCheckCardSchema>;
	interface BaseData extends Record<string, unknown> {}
	interface DerivedData extends Record<string, unknown> {}
}

class NimbleAbilityCheckCardData extends foundry.abstract.TypeDataModel<
	NimbleAbilityCheckCardData.Schema,
	ChatMessage,
	NimbleAbilityCheckCardData.BaseData,
	NimbleAbilityCheckCardData.DerivedData
> {
	static override defineSchema(): NimbleAbilityCheckCardData.Schema {
		return {
			...abilityCheckCardSchema(),
			...metadata(),
		};
	}
}

export { NimbleAbilityCheckCardData };
