type EnrichOptions = NonNullable<
	Parameters<(typeof foundry.applications.ux.TextEditor.implementation)['enrichHTML']>[1]
>;

interface RollDataSource {
	isEmbedded?: boolean;
	actor?: { getRollData(): Record<string, unknown> } | null;
	getRollData?(): Record<string, unknown>;
}

export function getDocumentEnrichOptions(
	document: RollDataSource | null | undefined,
): EnrichOptions {
	if (!document) return {};

	const rollData =
		document.isEmbedded && document.actor ? document.actor.getRollData() : document.getRollData?.();

	return { rollData, relativeTo: document } as EnrichOptions;
}

export default function enrichDocumentHTML(
	text: string | null | undefined,
	document: RollDataSource | null | undefined,
	options: EnrichOptions = {},
): Promise<string> {
	return foundry.applications.ux.TextEditor.implementation.enrichHTML(text ?? '', {
		...getDocumentEnrichOptions(document),
		...options,
	});
}
