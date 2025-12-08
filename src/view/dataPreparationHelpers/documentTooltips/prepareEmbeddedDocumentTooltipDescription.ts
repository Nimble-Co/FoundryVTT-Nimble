type EnrichOptions = Parameters<
	(typeof foundry.applications.ux.TextEditor.implementation)['enrichHTML']
>[1];

export default async function prepareEmbeddedDocumentTooltipDescription(
	source: string | undefined,
	heading: string,
	document?: any,
): Promise<string | null> {
	if (!source) return null;

	const TextEditor = foundry.applications.ux?.TextEditor;
	if (!TextEditor) return null;

	const enrichOptions = {
		secrets: document?.isOwner || game.user?.isGM,
		rollData: document?.isEmbedded ? document.actor?.getRollData() : document?.getRollData(),
		relativeTo: document,
	} as EnrichOptions;

	const enriched = await TextEditor.implementation.enrichHTML(source, enrichOptions);

	return `<section>
    <header>
      <h4 class="nimble-heading" data-heading-variant="section">
        ${heading}
      </h4>

      <div class="nimble-tooltip__description-wrapper">
        ${enriched}
      </div>
  </section>`;
}
