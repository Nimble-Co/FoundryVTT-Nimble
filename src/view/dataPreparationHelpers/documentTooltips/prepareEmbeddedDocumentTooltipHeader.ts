import type { NimbleBaseItem } from '../../../documents/item/base.svelte.js';

export default function prepareEmbeddedDocumentTooltipHeader(
	item: NimbleBaseItem,
	metadata: string,
): string {
	const components: string[] = [
		`
    <header class="nimble-tooltip__item-header">
      <section class="nimble-icon">
        <div class="nimble-icon__button nimble-icon__button--bordered nimble-icon__button--small">
          <img class="nimble-icon__image" src="${item.img}" alg="${item.name}">
        </div>
      </section>

      <h3 class="nimble-heading nimble-heading--document-tooltip-name">
        ${item.name}
      </h3>
  `,
	];

	if (metadata) {
		components.push(`<span class="nimble-tooltip__item-metadata">${metadata}</span>`);
	}

	components.push('</header>');

	return components.join('');
}
