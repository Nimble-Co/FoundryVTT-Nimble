import prepareClassMetadata from '../metaData/prepareClassMetadata.js';
import prepareEmbeddedDocumentTooltipDescription from './prepareEmbeddedDocumentTooltipDescription.js';
import prepareEmbeddedDocumentTooltipHeader from './prepareEmbeddedDocumentTooltipHeader.js';

import type { NimbleClassItem } from '../../../documents/item/class.js';

export default async function prepareAncestryTooltip(
	characterClass: NimbleClassItem,
): Promise<string> {
	const metadata = prepareClassMetadata(characterClass);

	const components = [
		prepareEmbeddedDocumentTooltipHeader(characterClass, metadata),
		await prepareEmbeddedDocumentTooltipDescription(
			characterClass.system?.description || 'No description available.',
			'Class Description',
			characterClass,
		),
	];

	return components.filter(Boolean).join('');
}
