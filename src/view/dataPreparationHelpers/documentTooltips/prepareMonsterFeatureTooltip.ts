import prepareMonsterFeatureMetadata from '../metaData/prepareMonsterFeatureMetadata.js';
import prepareEmbeddedDocumentTooltipDescription from './prepareEmbeddedDocumentTooltipDescription.js';
import prepareEmbeddedDocumentTooltipHeader from './prepareEmbeddedDocumentTooltipHeader.js';

import type { NimbleMonsterFeatureItem } from '../../../documents/item/monsterFeature.js';

export default function prepareMonsterFeatureTooltip(
	monsterFeature: NimbleMonsterFeatureItem,
): string {
	const metadata = prepareMonsterFeatureMetadata(monsterFeature);

	const components = [
		prepareEmbeddedDocumentTooltipHeader(monsterFeature, metadata),
		prepareEmbeddedDocumentTooltipDescription(
			monsterFeature.system?.description || 'No description available.',
			'Monster Feature Description',
		),
	];

	return components.filter(Boolean).join('');
}
