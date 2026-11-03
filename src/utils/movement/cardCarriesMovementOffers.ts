import { type CardDataModels, cardSchemaHas } from '../documents/cardSchemaHas.js';

/** Whether the data model of a chat card type has a field for Movement Offers. */
export function cardCarriesMovementOffers(
	type: string | undefined,
	dataModels?: CardDataModels,
): boolean {
	return cardSchemaHas(type, 'movementOffers', dataModels);
}
