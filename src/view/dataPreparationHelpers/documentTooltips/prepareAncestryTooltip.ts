import prepareAncestryMetadata from '../metaData/prepareAncestryMetadata.js';
import prepareAncestryTooltipTags from './prepareAncestryTooltipTags.js';
import prepareEmbeddedDocumentTooltipDescription from './prepareEmbeddedDocumentTooltipDescription.js';
import prepareEmbeddedDocumentTooltipHeader from './prepareEmbeddedDocumentTooltipHeader.js';

import type { NimbleAncestryItem } from '../../../documents/item/ancestry.js';

export default async function prepareAncestryTooltip(
	ancestry: NimbleAncestryItem,
): Promise<string> {
	const metadata = prepareAncestryMetadata(ancestry);

	const components = [
		prepareEmbeddedDocumentTooltipHeader(ancestry, metadata),
		prepareAncestryTooltipTags(ancestry),
		await prepareEmbeddedDocumentTooltipDescription(
			ancestry.system?.description || 'No description available.',
			'Ancestry Description',
			ancestry,
		),
	];

	return components.filter(Boolean).join('');
}
