import prepareBackgroundMetadata from '../metaData/prepareBackgroundMetadata.js';
import prepareEmbeddedDocumentTooltipDescription from './prepareEmbeddedDocumentTooltipDescription.js';
import prepareEmbeddedDocumentTooltipHeader from './prepareEmbeddedDocumentTooltipHeader.js';

import type { NimbleBackgroundItem } from '../../../documents/item/background.js';

export default async function prepareBackgroundTooltip(
	background: NimbleBackgroundItem,
): Promise<string> {
	const metadata = prepareBackgroundMetadata(background);

	const components = [
		prepareEmbeddedDocumentTooltipHeader(background, metadata),
		await prepareEmbeddedDocumentTooltipDescription(
			background.system?.description || 'No description available.',
			'Background Description',
			background,
		),
	];

	return components.filter(Boolean).join('');
}
