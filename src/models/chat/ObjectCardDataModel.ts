import { activation } from '../item/common.js';
import {
	appliedHealing,
	attackResultChanges,
	concentration,
	damageBack,
	defends,
	grantedActionOffers,
	incomingReactions,
	keptAmount,
	metadata,
	migrateDefends,
	migrateIncomingReactions,
	movementOffers,
	primaryDieBonuses,
	rerollHistory,
	targets,
} from './common.js';

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
		ReturnType<typeof appliedHealing> &
		ReturnType<typeof concentration> &
		ReturnType<typeof grantedActionOffers> &
		ReturnType<typeof incomingReactions> &
		ReturnType<typeof rerollHistory> &
		ReturnType<typeof attackResultChanges> &
		ReturnType<typeof defends> &
		ReturnType<typeof keptAmount> &
		ReturnType<typeof primaryDieBonuses> &
		ReturnType<typeof damageBack> &
		ReturnType<typeof movementOffers> &
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
			...appliedHealing(),
			...concentration(),
			...grantedActionOffers(),
			...incomingReactions(),
			...rerollHistory(),
			...attackResultChanges(),
			...defends(),
			...keptAmount(),
			...primaryDieBonuses(),
			...damageBack(),
			...movementOffers(),
			...objectCardSchema(),
			...metadata(),
			...targets(),
		};
	}

	static override migrateData(source: Record<string, unknown>): Record<string, unknown> {
		migrateDefends(source);
		migrateIncomingReactions(source);
		return super.migrateData(source);
	}
}

export { NimbleObjectCardData };
