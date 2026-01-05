import { activation } from '../item/common.js';
import { metadata, targets } from './common.js';

const { fields } = foundry.data;

const featureCardSchema = () => ({
	class: new fields.StringField({ required: true, nullable: false, initial: '' }),
	description: new fields.HTMLField({ required: false, initial: '', nullable: false }),
	featureType: new fields.StringField({ required: true, nullable: false, initial: '' }),
	isCritical: new fields.BooleanField({ required: true, initial: false, nullable: false }),
	isMiss: new fields.BooleanField({ required: true, initial: false, nullable: false }),
	name: new fields.StringField({ required: true, nullable: false }),
	attackType: new fields.StringField({
		required: true,
		nullable: false,
		blank: true,
		initial: '',
		choices: ['', 'melee', 'reach', 'range'],
	}),
	attackDistance: new fields.NumberField({
		required: true,
		nullable: false,
		initial: 1,
		min: 1,
		integer: true,
	}),
});

declare namespace NimbleFeatureCardData {
	type Schema = DataSchema &
		ReturnType<typeof activation> &
		ReturnType<typeof metadata> &
		ReturnType<typeof featureCardSchema> &
		ReturnType<typeof targets>;
	interface BaseData extends Record<string, unknown> {}
	interface DerivedData extends Record<string, unknown> {}
}

class NimbleFeatureCardData extends foundry.abstract.TypeDataModel<
	NimbleFeatureCardData.Schema,
	ChatMessage.ConfiguredInstance,
	NimbleFeatureCardData.BaseData,
	NimbleFeatureCardData.DerivedData
> {
	static override defineSchema(): NimbleFeatureCardData.Schema {
		return {
			...activation(),
			...featureCardSchema(),
			...metadata(),
			...targets(),
		};
	}
}

export { NimbleFeatureCardData };
