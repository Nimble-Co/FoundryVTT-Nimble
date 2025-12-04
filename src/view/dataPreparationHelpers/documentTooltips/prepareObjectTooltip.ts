import prepareObjectMetadata from '../metaData/prepareObjectMetadata.js';
import prepareEmbeddedDocumentTooltipDescription from './prepareEmbeddedDocumentTooltipDescription.js';
import prepareEmbeddedDocumentTooltipHeader from './prepareEmbeddedDocumentTooltipHeader.js';
import prepareWeaponTooltipTags from './prepareWeaponTooltipTags.js';

import type { NimbleObjectItem } from '../../../documents/item/object.js';

export default async function prepareObjectTooltip(item: NimbleObjectItem): Promise<string> {
	const metadata = prepareObjectMetadata(item);

	const components: (string | null)[] = [prepareEmbeddedDocumentTooltipHeader(item, metadata)];

	if (item.system.objectType === 'weapon') components.push(prepareWeaponTooltipTags(item));

	components.push(
		await prepareEmbeddedDocumentTooltipDescription(
			item.system?.description?.public || 'No description available.',
			'Item Description',
			item,
		),
	);

	return components.filter(Boolean).join('');
}
