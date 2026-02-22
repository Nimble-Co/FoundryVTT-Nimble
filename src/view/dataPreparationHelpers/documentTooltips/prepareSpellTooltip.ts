import type { NimbleSpellItem } from '../../../documents/item/spell.js';
import prepareSpellMetadata from '../metaData/prepareSpellMetadata.js';
import prepareEmbeddedDocumentTooltipDescription from './prepareEmbeddedDocumentTooltipDescription.js';
import prepareEmbeddedDocumentTooltipHeader from './prepareEmbeddedDocumentTooltipHeader.js';
import prepareSpellTooltipTags from './prepareSpellTooltipTags.js';

export default async function prepareSpellTooltip(spell: NimbleSpellItem): Promise<string> {
	const metadata = prepareSpellMetadata(spell, true);
	const properties = spell?.system?.properties?.selected ?? [];

	const higherLevelEffect = spell.system?.description?.higherLevelEffect ?? '';
	const upcastEffect =
		!properties.includes('utilitySpell') && spell?.system?.tier > 0
			? (spell.system?.description?.upcastEffect ?? '')
			: '';

	const components = [
		prepareEmbeddedDocumentTooltipHeader(spell, metadata),
		prepareSpellTooltipTags(spell),
		await prepareEmbeddedDocumentTooltipDescription(
			spell.system?.description?.baseEffect || 'No description available.',
			'Spell Description',
			spell,
		),
		await prepareEmbeddedDocumentTooltipDescription(
			higherLevelEffect,
			'Higher Level Effect',
			spell,
		),
		await prepareEmbeddedDocumentTooltipDescription(upcastEffect, 'Upcast', spell),
	];

	return components.filter(Boolean).join('');
}
