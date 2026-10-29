type RollData = Record<string, unknown>;

interface EnrichSource {
	isOwner: boolean;
	getRollData(): RollData;
}

export interface EnrichActor extends EnrichSource {
	items: { get(id: string): EnrichSource | undefined };
}

/** The text as Foundry enriches it: inline rolls, links, secrets for an owner. */
export function enrichText(
	raw: string,
	actor: EnrichSource,
	document: EnrichSource = actor,
): Promise<string> {
	return foundry.applications.ux.TextEditor.implementation.enrichHTML(raw, {
		secrets: actor.isOwner,
		rollData: document.getRollData(),
		relativeTo: document as unknown as foundry.abstract.Document.Any,
	});
}

/**
 * The enriched descriptions of the item rows that show their text. Enrichment is async, so a
 * row shows its plain text until its entry comes; a changed description drops the old entry.
 */
export function createDescriptionEnricher(actor: EnrichActor) {
	let enriched: Record<string, string> = $state({});
	/** by item id, the raw description that `enriched` holds or waits for */
	const sources = new Map<string, string>();

	return {
		get enriched() {
			return enriched;
		},
		/** item id and raw description of each row that shows its text */
		want(wanted: (readonly [string, string])[]): void {
			for (const [id, raw] of wanted) {
				if (sources.get(id) === raw) continue;
				sources.set(id, raw);
				if (id in enriched) {
					const { [id]: _stale, ...rest } = enriched;
					enriched = rest;
				}
				void enrichText(raw, actor, actor.items.get(id) ?? actor).then((html) => {
					if (sources.get(id) !== raw) return;
					enriched = { ...enriched, [id]: html };
				});
			}
		},
	};
}
