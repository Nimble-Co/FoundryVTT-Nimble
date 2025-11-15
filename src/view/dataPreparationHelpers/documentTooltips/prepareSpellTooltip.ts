import prepareEmbeddedDocumentTooltipDescription from './prepareEmbeddedDocumentTooltipDescription';
import prepareEmbeddedDocumentTooltipHeader from './prepareEmbeddedDocumentTooltipHeader';
import prepareSpellMetadata from '../metaData/prepareSpellMetadata';
import prepareSpellTooltipTags from './prepareSpellTooltipTags';

import type { NimbleSpellItem } from '../../../documents/item/spell';

export default function prepareSpellTooltip(spell: NimbleSpellItem): string {
	const metadata = prepareSpellMetadata(spell, true);
	const properties = spell?.system?.properties?.selected ?? [];

	const components = [
		prepareEmbeddedDocumentTooltipHeader(spell, metadata),
		prepareSpellTooltipTags(spell),
		prepareEmbeddedDocumentTooltipDescription(
			spell.system?.description?.baseEffect || 'No description available.',
			'Spell Description',
		),
		prepareEmbeddedDocumentTooltipDescription(
			properties.includes('utilitySpell') ? '' : spell.system?.description?.higherLevelEffect,
			spell?.system?.tier > 0 ? 'Upcast' : 'Higher Level Effect',
		),
	];

	return components.filter(Boolean).join('');
}
