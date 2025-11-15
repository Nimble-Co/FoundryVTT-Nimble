import prepareAncestryMetadata from '../metaData/prepareAncestryMetadata';
import prepareAncestryTooltipTags from './prepareAncestryTooltipTags';
import prepareEmbeddedDocumentTooltipDescription from './prepareEmbeddedDocumentTooltipDescription';
import prepareEmbeddedDocumentTooltipHeader from './prepareEmbeddedDocumentTooltipHeader';

import type { NimbleAncestryItem } from '../../../documents/item/ancestry';

export default function prepareAncestryTooltip(ancestry: NimbleAncestryItem): string {
	const metadata = prepareAncestryMetadata(ancestry);

	const components = [
		prepareEmbeddedDocumentTooltipHeader(ancestry, metadata),
		prepareAncestryTooltipTags(ancestry),
		prepareEmbeddedDocumentTooltipDescription(
			ancestry.system?.description || 'No description available.',
			'Ancestry Description',
		),
	];

	return components.filter(Boolean).join('');
}
