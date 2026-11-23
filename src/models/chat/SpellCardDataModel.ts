import { activation } from '../item/common.js';
import {
	appliedDamage,
	appliedHealing,
	attackResultChanges,
	concentration,
	costs,
	damageBack,
	defends,
	grantedActionOffers,
	incomingReactions,
	keptAmount,
	metadata,
	migrateIncomingReactions,
	movementOffers,
	optionNotes,
	primaryDieBonuses,
	rerollHistory,
	targets,
} from './common.js';

const { fields } = foundry.data;

const spellCardSchema = () => ({
	description: new fields.SchemaField({
		baseEffect: new fields.HTMLField({ required: false, initial: '', nullable: false }),
		higherLevelEffect: new fields.HTMLField({ required: false, initial: '', nullable: false }),
		upcastEffect: new fields.HTMLField({ required: false, initial: '', nullable: false }),
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
	upcast: new fields.ObjectField({ required: false, nullable: true, initial: null }),
	/**
	 * The mana the cast spent on the spell, after free casts and less mana. An option's mana
	 * is not in it. With Resource Spending off, the mana the cast would have spent.
	 */
	castManaSpent: new fields.NumberField({
		required: true,
		nullable: false,
		initial: 0,
		min: 0,
		integer: true,
	}),
});

declare namespace NimbleSpellCardData {
	type Schema = DataSchema &
		ReturnType<typeof activation> &
		ReturnType<typeof appliedDamage> &
		ReturnType<typeof appliedHealing> &
		ReturnType<typeof concentration> &
		ReturnType<typeof grantedActionOffers> &
		ReturnType<typeof incomingReactions> &
		ReturnType<typeof rerollHistory> &
		ReturnType<typeof attackResultChanges> &
		ReturnType<typeof costs> &
		ReturnType<typeof defends> &
		ReturnType<typeof keptAmount> &
		ReturnType<typeof primaryDieBonuses> &
		ReturnType<typeof damageBack> &
		ReturnType<typeof movementOffers> &
		ReturnType<typeof optionNotes> &
		ReturnType<typeof metadata> &
		ReturnType<typeof spellCardSchema> &
		ReturnType<typeof targets>;
	interface BaseData extends Record<string, unknown> {}
	interface DerivedData extends Record<string, unknown> {}
}

class NimbleSpellCardData extends foundry.abstract.TypeDataModel<
	NimbleSpellCardData.Schema,
	ChatMessage.ConfiguredInstance,
	NimbleSpellCardData.BaseData,
	NimbleSpellCardData.DerivedData
> {
	static override defineSchema(): NimbleSpellCardData.Schema {
		return {
			...activation(),
			...appliedDamage(),
			...appliedHealing(),
			...concentration(),
			...grantedActionOffers(),
			...incomingReactions(),
			...rerollHistory(),
			...attackResultChanges(),
			...costs(),
			...defends(),
			...keptAmount(),
			...primaryDieBonuses(),
			...damageBack(),
			...movementOffers(),
			...optionNotes(),
			...spellCardSchema(),
			...metadata(),
			...targets(),
		};
	}

	static override migrateData(source: Record<string, unknown>): Record<string, unknown> {
		migrateIncomingReactions(source);
		return super.migrateData(source);
	}
}

export { NimbleSpellCardData };
