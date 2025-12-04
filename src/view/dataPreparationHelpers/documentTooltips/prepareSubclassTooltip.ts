import prepareSubclassMetadata from '../metaData/prepareSubclassMetadata.js';
import prepareEmbeddedDocumentTooltipDescription from './prepareEmbeddedDocumentTooltipDescription.js';
import prepareEmbeddedDocumentTooltipHeader from './prepareEmbeddedDocumentTooltipHeader.js';

import type { NimbleSubclassItem } from '../../../documents/item/subclass.js';

export default async function prepareAncestryTooltip(
	subclass: NimbleSubclassItem,
): Promise<string> {
	const metadata = prepareSubclassMetadata(subclass);

	const components = [
		prepareEmbeddedDocumentTooltipHeader(subclass, metadata),
		await prepareEmbeddedDocumentTooltipDescription(
			subclass.system?.description || 'No description available.',
			'Subclass Description',
			subclass,
		),
	];

	return components.filter(Boolean).join('');
}
