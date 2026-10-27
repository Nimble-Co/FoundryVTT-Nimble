/**
 * Enriches HTML text using Foundry's TextEditor.
 * This is the primary utility for rendering spell descriptions with
 * inline rolls, links, and other Foundry enrichment.
 */
export default async function enrichSpellText(text: string): Promise<string> {
	return foundry.applications.ux.TextEditor.implementation.enrichHTML(text);
}
