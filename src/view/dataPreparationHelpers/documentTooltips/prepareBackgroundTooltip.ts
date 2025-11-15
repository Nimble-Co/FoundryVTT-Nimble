import prepareBackgroundMetadata from '../metaData/prepareBackgroundMetadata';
import prepareEmbeddedDocumentTooltipDescription from './prepareEmbeddedDocumentTooltipDescription';
import prepareEmbeddedDocumentTooltipHeader from './prepareEmbeddedDocumentTooltipHeader';

import type { NimbleBackgroundItem } from '../../../documents/item/background';

export default function prepareBackgroundTooltip(background: NimbleBackgroundItem): string {
	const metadata = prepareBackgroundMetadata(background);

	const components = [
		prepareEmbeddedDocumentTooltipHeader(background, metadata),
		prepareEmbeddedDocumentTooltipDescription(
			background.system?.description || 'No description available.',
			'Background Description',
		),
	];

	return components.filter(Boolean).join('');
}
