import prepareClassMetadata from '../metaData/prepareClassMetadata';
import prepareEmbeddedDocumentTooltipDescription from './prepareEmbeddedDocumentTooltipDescription';
import prepareEmbeddedDocumentTooltipHeader from './prepareEmbeddedDocumentTooltipHeader';

import type { NimbleClassItem } from '../../../documents/item/class';

export default function prepareAncestryTooltip(characterClass: NimbleClassItem): string {
	const metadata = prepareClassMetadata(characterClass);

	const components = [
		prepareEmbeddedDocumentTooltipHeader(characterClass, metadata),
		prepareEmbeddedDocumentTooltipDescription(
			characterClass.system?.description || 'No description available.',
			'Class Description',
		),
	];

	return components.filter(Boolean).join('');
}
