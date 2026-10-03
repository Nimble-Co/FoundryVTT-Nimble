import { metadata, movementOffers, targets } from './common.js';

const { fields } = foundry.data;

const movementOfferCardSchema = () => ({
	name: new fields.StringField({ required: true, nullable: false, initial: '' }),
	reason: new fields.StringField({ required: true, nullable: false, initial: '' }),
	activation: new fields.SchemaField({
		effects: new fields.ArrayField(new fields.ObjectField(), {
			required: true,
			nullable: false,
			initial: [],
		}),
	}),
});

declare namespace NimbleMovementOfferCardData {
	type Schema = DataSchema &
		ReturnType<typeof metadata> &
		ReturnType<typeof targets> &
		ReturnType<typeof movementOffers> &
		ReturnType<typeof movementOfferCardSchema>;
	interface BaseData extends Record<string, unknown> {}
	interface DerivedData extends Record<string, unknown> {}
}

/** A Movement Offer posted on its own, with one move node in `activation.effects`. */
class NimbleMovementOfferCardData extends foundry.abstract.TypeDataModel<
	NimbleMovementOfferCardData.Schema,
	ChatMessage.ConfiguredInstance,
	NimbleMovementOfferCardData.BaseData,
	NimbleMovementOfferCardData.DerivedData
> {
	static override defineSchema(): NimbleMovementOfferCardData.Schema {
		return {
			...metadata(),
			...targets(),
			...movementOffers(),
			...movementOfferCardSchema(),
		};
	}
}

export { NimbleMovementOfferCardData };
