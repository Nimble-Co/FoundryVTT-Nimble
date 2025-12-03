import { activation } from '../item/common.js';
import { targets, metadata } from './common.js';

const { fields } = foundry.data;

const spellCardSchema = () => ({
	description: new fields.SchemaField({
		baseEffect: new fields.HTMLField({ required: false, initial: '', nullable: false }),
		higherLevelEffect: new fields.HTMLField({ required: false, initial: '', nullable: false }),
	}),
	duration: new fields.SchemaField({
		concentration: new fields.BooleanField({ required: true, initial: false, nullable: false }),
		period: new fields.StringField({ required: true, initial: '', nullable: false }),
	}),
	isCritical: new fields.BooleanField({ required: true, initial: false, nullable: false }),
	isMiss: new fields.BooleanField({ required: true, initial: false, nullable: false }),
	school: new fields.StringField({ required: true, initial: '', nullable: false }),
	spellName: new fields.StringField({ required: true, initial: '', nullable: false }),
	tier: new fields.NumberField({
		required: true,
		initial: 0,
		min: 0,
		max: 9,
		nullable: false,
	}),
});

declare namespace NimbleSpellCardData {
	type Schema = foundry.data.fields.DataSchema &
		ReturnType<typeof activation> &
		ReturnType<typeof metadata> &
		ReturnType<typeof spellCardSchema> &
		ReturnType<typeof targets>;
	interface BaseData extends Record<string, unknown> {}
	interface DerivedData extends Record<string, unknown> {}
}

class NimbleSpellCardData extends foundry.abstract.TypeDataModel<
	NimbleSpellCardData.Schema,
	ChatMessage,
	NimbleSpellCardData.BaseData,
	NimbleSpellCardData.DerivedData
> {
	static override defineSchema(): NimbleSpellCardData.Schema {
		return {
			...activation(),
			...spellCardSchema(),
			...metadata(),
			...targets(),
		};
	}
}

export { NimbleSpellCardData };
