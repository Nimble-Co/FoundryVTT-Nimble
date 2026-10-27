/** Matches Foundry's document-link syntax: `@UUID[uuid]` with an optional `{Label}`. */
const documentLinkPattern = /@UUID\[([^\]]+)\](?:\{([^}]*)\})?/g;

/**
 * Replaces Foundry document links with the text they display, for output that cannot
 * render an enriched link (the PDF export). Unlabelled links resolve to the referenced
 * document's name, and stay untouched when that document cannot be found.
 */
export default function resolveContentLinks(content: string): string {
	if (!content) return '';

	return content.replace(documentLinkPattern, (link, uuid: string, label?: string) => {
		if (label) return label;

		const referencedDocument = fromUuidSync(uuid, { strict: false }) as { name?: string } | null;
		return referencedDocument?.name ?? link;
	});
}
