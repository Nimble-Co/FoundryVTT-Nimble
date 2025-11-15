import prepareFeatureMetadata from '../metaData/prepareFeatureMetadata';
import prepareEmbeddedDocumentTooltipDescription from './prepareEmbeddedDocumentTooltipDescription';
import prepareEmbeddedDocumentTooltipHeader from './prepareEmbeddedDocumentTooltipHeader';

import type { NimbleFeatureItem } from '../../../documents/item/feature';

export default function prepareFeatureTooltip(feature: NimbleFeatureItem): string {
	const metadata = prepareFeatureMetadata(feature);

	const components = [
		prepareEmbeddedDocumentTooltipHeader(feature, metadata),
		prepareEmbeddedDocumentTooltipDescription(
			feature.system?.description || 'No description available.',
			'Feature Description',
		),
	];

	return components.filter(Boolean).join('');
}
