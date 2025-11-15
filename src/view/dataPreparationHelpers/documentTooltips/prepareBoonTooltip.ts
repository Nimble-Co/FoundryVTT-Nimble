import prepareBoonMetadata from '../metaData/prepareBoonMetadata';
import prepareEmbeddedDocumentTooltipDescription from './prepareEmbeddedDocumentTooltipDescription';
import prepareEmbeddedDocumentTooltipHeader from './prepareEmbeddedDocumentTooltipHeader';

import type { NimbleBoonItem } from '../../../documents/item/boon';

export default function prepareBoonTooltip(boon: NimbleBoonItem): string {
	const components: (string | null)[] = [];
	const metadata = prepareBoonMetadata(boon);

	components.push(
		prepareEmbeddedDocumentTooltipHeader(boon, metadata),
		prepareEmbeddedDocumentTooltipDescription(
			boon.system?.description || 'No description available.',
			'Boon Description',
		),
	);

	return components.filter(Boolean).join('');
}
