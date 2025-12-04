import prepareBoonMetadata from '../metaData/prepareBoonMetadata.js';
import prepareEmbeddedDocumentTooltipDescription from './prepareEmbeddedDocumentTooltipDescription.js';
import prepareEmbeddedDocumentTooltipHeader from './prepareEmbeddedDocumentTooltipHeader.js';

import type { NimbleBoonItem } from '../../../documents/item/boon.js';

export default async function prepareBoonTooltip(boon: NimbleBoonItem): Promise<string> {
	const components: (string | null)[] = [];
	const metadata = prepareBoonMetadata(boon);

	components.push(
		prepareEmbeddedDocumentTooltipHeader(boon, metadata),
		await prepareEmbeddedDocumentTooltipDescription(
			boon.system?.description || 'No description available.',
			'Boon Description',
			boon,
		),
	);

	return components.filter(Boolean).join('');
}
