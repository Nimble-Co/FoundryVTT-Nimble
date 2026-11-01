interface CardDataModel {
	defineSchema(): Record<string, unknown>;
}

/**
 * Whether the data model of a chat card type has a field for the reaction rows.
 * Foundry drops a key the schema does not declare, with no warning.
 */
export function cardCarriesIncomingReactions(
	type: string | undefined,
	dataModels: Record<string, CardDataModel | undefined> = CONFIG.ChatMessage
		.dataModels as unknown as Record<string, CardDataModel | undefined>,
): boolean {
	return !!type && 'incomingReactions' in (dataModels[type]?.defineSchema() ?? {});
}
