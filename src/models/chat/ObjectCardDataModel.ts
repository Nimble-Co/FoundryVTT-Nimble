import { activation } from '../item/common';
import { metadata, targets } from './common';

const { fields } = foundry.data;

const objectCardSchema = () => ({
	description: new fields.SchemaField({
		public: new fields.HTMLField({ required: false, initial: '', nullable: false }),
		unidentified: new fields.HTMLField({ required: false, initial: '', nullable: false }),
	}),
	name: new fields.SchemaField({
		public: new fields.StringField({ required: true, nullable: false }),
		unidentified: new fields.StringField({ required: true, nullable: false }),
	}),
	isCritical: new fields.BooleanField({ required: true, initial: false, nullable: false }),
	isIdentified: new fields.BooleanField({ required: true, nullable: false }),
	isMiss: new fields.BooleanField({ required: true, initial: false, nullable: false }),
	objectType: new fields.StringField({ required: true, nullable: false, initial: '' }),
	properties: new fields.ArrayField(new fields.StringField({ required: true, nullable: false }), {
		required: true,
		nullable: false,
	}),
});

declare namespace NimbleObjectCardData {
	type Schema = DataSchema &
		ReturnType<typeof activation> &
		ReturnType<typeof metadata> &
		ReturnType<typeof objectCardSchema> &
		ReturnType<typeof targets>;
	interface BaseData extends Record<string, unknown> {}
	interface DerivedData extends Record<string, unknown> {}
}

class NimbleObjectCardData extends foundry.abstract.TypeDataModel<
	NimbleObjectCardData.Schema,
	ChatMessage.ConfiguredInstance,
	NimbleObjectCardData.BaseData,
	NimbleObjectCardData.DerivedData
> {
	static override defineSchema(): NimbleObjectCardData.Schema {
		return {
			...activation(),
			...objectCardSchema(),
			...metadata(),
			...targets(),
		};
	}
}

export { NimbleObjectCardData };
