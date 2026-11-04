import type { CardDataModels } from '#types/cardDataModel.d.ts';

/**
 * Whether the data model of a chat card type has the field `key`.
 * Foundry drops a key the schema does not declare, with no warning.
 */
export function cardSchemaHas(
	type: string | undefined,
	key: string,
	dataModels: CardDataModels = CONFIG.ChatMessage.dataModels as unknown as CardDataModels,
): boolean {
	return !!type && key in (dataModels[type]?.defineSchema() ?? {});
}
