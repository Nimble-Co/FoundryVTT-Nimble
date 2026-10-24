import { incomingReactions, metadata, rerollHistory, roller } from './common.js';

const { fields } = foundry.data;

const abilityCheckCardSchema = () => ({
	abilityKey: new fields.StringField({ required: true, initial: '', nullable: false }),
	rollMode: new fields.NumberField({ required: true, initial: 0, nullable: false }),
});

declare namespace NimbleAbilityCheckCardData {
	type Schema = DataSchema &
		ReturnType<typeof metadata> &
		ReturnType<typeof abilityCheckCardSchema> &
		ReturnType<typeof roller> &
		ReturnType<typeof incomingReactions> &
		ReturnType<typeof rerollHistory>;
	interface BaseData extends Record<string, unknown> {}
	interface DerivedData extends Record<string, unknown> {}
}

class NimbleAbilityCheckCardData extends foundry.abstract.TypeDataModel<
	NimbleAbilityCheckCardData.Schema,
	ChatMessage.ConfiguredInstance,
	NimbleAbilityCheckCardData.BaseData,
	NimbleAbilityCheckCardData.DerivedData
> {
	static override defineSchema(): NimbleAbilityCheckCardData.Schema {
		return {
			...abilityCheckCardSchema(),
			...metadata(),
			...roller(),
			...incomingReactions(),
			...rerollHistory(),
		};
	}
}

export { NimbleAbilityCheckCardData };
