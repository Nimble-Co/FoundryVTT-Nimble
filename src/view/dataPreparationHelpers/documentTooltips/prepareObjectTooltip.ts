import prepareObjectMetadata from '../metaData/prepareObjectMetadata';
import prepareEmbeddedDocumentTooltipDescription from './prepareEmbeddedDocumentTooltipDescription';
import prepareEmbeddedDocumentTooltipHeader from './prepareEmbeddedDocumentTooltipHeader';
import prepareWeaponTooltipTags from './prepareWeaponTooltipTags';

import type { NimbleObjectItem } from '../../../documents/item/object';

export default function prepareObjectTooltip(item: NimbleObjectItem): string {
	const metadata = prepareObjectMetadata(item);

	const components: (string | null)[] = [prepareEmbeddedDocumentTooltipHeader(item, metadata)];

	if (item.system.objectType === 'weapon') components.push(prepareWeaponTooltipTags(item));

	components.push(
		prepareEmbeddedDocumentTooltipDescription(
			item.system?.description?.public || 'No description available.',
			'Item Description',
		),
	);

	return components.filter(Boolean).join('');
}
