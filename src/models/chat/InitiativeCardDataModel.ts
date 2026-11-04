import {
	incomingReactions,
	metadata,
	migrateIncomingReactions,
	rerollHistory,
	resultChanges,
	roller,
} from './common.js';

const { fields } = foundry.data;

const initiativeCardSchema = () => ({
	/** The combat and combatant this roll belongs to. Empty when it was no combat's roll. */
	combatId: new fields.StringField({ required: false, nullable: true, initial: null }),
	combatantId: new fields.StringField({ required: false, nullable: true, initial: null }),
	/** The initiativeMana dice and mana this roll gave. */
	initiativeMana: new fields.ObjectField({ required: false, nullable: true, initial: null }),
	/** The pending action adjustment the roll folded into the current actions. */
	foldedActionDelta: new fields.NumberField({
		required: true,
		nullable: false,
		initial: 0,
		integer: true,
	}),
});

declare namespace NimbleInitiativeCardData {
	type Schema = DataSchema &
		ReturnType<typeof metadata> &
		ReturnType<typeof initiativeCardSchema> &
		ReturnType<typeof roller> &
		ReturnType<typeof incomingReactions> &
		ReturnType<typeof rerollHistory> &
		ReturnType<typeof resultChanges>;
	interface BaseData extends Record<string, unknown> {}
	interface DerivedData extends Record<string, unknown> {}
}

class NimbleInitiativeCardData extends foundry.abstract.TypeDataModel<
	NimbleInitiativeCardData.Schema,
	ChatMessage.ConfiguredInstance,
	NimbleInitiativeCardData.BaseData,
	NimbleInitiativeCardData.DerivedData
> {
	static override defineSchema(): NimbleInitiativeCardData.Schema {
		return {
			...initiativeCardSchema(),
			...metadata(),
			...roller(),
			...incomingReactions(),
			...rerollHistory(),
			...resultChanges(),
		};
	}

	static override migrateData(source: Record<string, unknown>): Record<string, unknown> {
		migrateIncomingReactions(source);
		return super.migrateData(source);
	}
}

export { NimbleInitiativeCardData };
