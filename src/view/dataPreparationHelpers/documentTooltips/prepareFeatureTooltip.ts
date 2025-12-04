import prepareFeatureMetadata from '../metaData/prepareFeatureMetadata.js';
import prepareEmbeddedDocumentTooltipDescription from './prepareEmbeddedDocumentTooltipDescription.js';
import prepareEmbeddedDocumentTooltipHeader from './prepareEmbeddedDocumentTooltipHeader.js';

import type { NimbleFeatureItem } from '../../../documents/item/feature.js';

export default async function prepareFeatureTooltip(feature: NimbleFeatureItem): Promise<string> {
	const metadata = prepareFeatureMetadata(feature);

	const components = [
		prepareEmbeddedDocumentTooltipHeader(feature, metadata),
		await prepareEmbeddedDocumentTooltipDescription(
			feature.system?.description || 'No description available.',
			'Feature Description',
			feature,
		),
	];

	return components.filter(Boolean).join('');
}
