import { metadata, targets } from './common.js';

const { fields } = foundry.data;

const movementTriggerCardSchema = () => ({
	name: new fields.StringField({ required: true, nullable: false, initial: '' }),
	itemUuid: new fields.StringField({ required: true, nullable: false, initial: '' }),
	payload: new fields.StringField({
		required: true,
		nullable: false,
		initial: 'reminder',
		choices: ['offer', 'reminder'],
	}),
	message: new fields.StringField({ required: true, nullable: false, initial: '' }),
	moverName: new fields.StringField({ required: true, nullable: false, initial: '' }),
	spaces: new fields.NumberField({ required: true, nullable: false, initial: 0, integer: true }),
	spacesThisTurn: new fields.NumberField({
		required: true,
		nullable: false,
		initial: 0,
		integer: true,
	}),
});

declare namespace NimbleMovementTriggerCardData {
	type Schema = DataSchema &
		ReturnType<typeof metadata> &
		ReturnType<typeof targets> &
		ReturnType<typeof movementTriggerCardSchema>;
	interface BaseData extends Record<string, unknown> {}
	interface DerivedData extends Record<string, unknown> {}
}

/** A Movement offers the use of an item, or reminds the table of it. */
class NimbleMovementTriggerCardData extends foundry.abstract.TypeDataModel<
	NimbleMovementTriggerCardData.Schema,
	ChatMessage.ConfiguredInstance,
	NimbleMovementTriggerCardData.BaseData,
	NimbleMovementTriggerCardData.DerivedData
> {
	static override defineSchema(): NimbleMovementTriggerCardData.Schema {
		return {
			...metadata(),
			...targets(),
			...movementTriggerCardSchema(),
		};
	}
}

export { NimbleMovementTriggerCardData };
