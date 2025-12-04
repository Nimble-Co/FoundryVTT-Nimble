import prepareEmbeddedDocumentTooltipDescription from './prepareEmbeddedDocumentTooltipDescription.js';
import prepareEmbeddedDocumentTooltipHeader from './prepareEmbeddedDocumentTooltipHeader.js';
import prepareSpellMetadata from '../metaData/prepareSpellMetadata.js';
import prepareSpellTooltipTags from './prepareSpellTooltipTags.js';

import type { NimbleSpellItem } from '../../../documents/item/spell.js';

export default async function prepareSpellTooltip(spell: NimbleSpellItem): Promise<string> {
	const metadata = prepareSpellMetadata(spell, true);
	const properties = spell?.system?.properties?.selected ?? [];

	const components = [
		prepareEmbeddedDocumentTooltipHeader(spell, metadata),
		prepareSpellTooltipTags(spell),
		await prepareEmbeddedDocumentTooltipDescription(
			spell.system?.description?.baseEffect || 'No description available.',
			'Spell Description',
			spell,
		),
		await prepareEmbeddedDocumentTooltipDescription(
			properties.includes('utilitySpell') ? '' : spell.system?.description?.higherLevelEffect,
			spell?.system?.tier > 0 ? 'Upcast' : 'Higher Level Effect',
			spell,
		),
	];

	return components.filter(Boolean).join('');
}
