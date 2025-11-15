import prepareSubclassMetadata from '../metaData/prepareSubclassMetadata';
import prepareEmbeddedDocumentTooltipDescription from './prepareEmbeddedDocumentTooltipDescription';
import prepareEmbeddedDocumentTooltipHeader from './prepareEmbeddedDocumentTooltipHeader';

import type { NimbleSubclassItem } from '../../../documents/item/subclass';

export default function prepareAncestryTooltip(subclass: NimbleSubclassItem): string {
	const metadata = prepareSubclassMetadata(subclass);

	const components = [
		prepareEmbeddedDocumentTooltipHeader(subclass, metadata),
		prepareEmbeddedDocumentTooltipDescription(
			subclass.system?.description || 'No description available.',
			'Subclass Description',
		),
	];

	return components.filter(Boolean).join('');
}
