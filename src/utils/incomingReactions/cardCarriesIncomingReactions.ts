import { type CardDataModels, cardSchemaHas } from '../documents/cardSchemaHas.js';

/** Whether the data model of a chat card type has a field for the reaction rows. */
export function cardCarriesIncomingReactions(
	type: string | undefined,
	dataModels?: CardDataModels,
): boolean {
	return cardSchemaHas(type, 'incomingReactions', dataModels);
}
