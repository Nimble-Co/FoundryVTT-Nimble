import { metadata, targets } from './common.js';

const { fields } = foundry.data;

const reactionCardSchema = () => ({
	reactionType: new fields.StringField({
		required: true,
		initial: '',
		nullable: false,
		choices: ['defend', 'interpose', 'opportunity', 'help'],
	}),
	armorValue: new fields.NumberField({ required: false, initial: null, nullable: true }),
	weaponName: new fields.StringField({ required: false, initial: null, nullable: true }),
	weaponDamage: new fields.StringField({ required: false, initial: null, nullable: true }),
});

declare namespace NimbleReactionCardData {
	type Schema = DataSchema &
		ReturnType<typeof metadata> &
		ReturnType<typeof reactionCardSchema> &
		ReturnType<typeof targets>;
	interface BaseData extends Record<string, unknown> {}
	interface DerivedData extends Record<string, unknown> {}
}

class NimbleReactionCardData extends foundry.abstract.TypeDataModel<
	NimbleReactionCardData.Schema,
	ChatMessage.ConfiguredInstance,
	NimbleReactionCardData.BaseData,
	NimbleReactionCardData.DerivedData
> {
	static override defineSchema(): NimbleReactionCardData.Schema {
		return {
			...reactionCardSchema(),
			...metadata(),
			...targets(),
		};
	}
}

export { NimbleReactionCardData };
