import type { NimbleAncestryBonusItem } from '../../../documents/item/ancestryBonus.js';

import prepareEmbeddedDocumentTooltipDescription from './prepareEmbeddedDocumentTooltipDescription.js';
import prepareEmbeddedDocumentTooltipHeader from './prepareEmbeddedDocumentTooltipHeader.js';

export default async function prepareAncestryBonusTooltip(
	bonus: NimbleAncestryBonusItem,
): Promise<string> {
	const components = [
		prepareEmbeddedDocumentTooltipHeader(bonus, ''),
		await prepareEmbeddedDocumentTooltipDescription(
			bonus.system?.description || 'No description available.',
			'Ancestry Bonus',
			bonus,
		),
	];

	return components.filter(Boolean).join('');
}
