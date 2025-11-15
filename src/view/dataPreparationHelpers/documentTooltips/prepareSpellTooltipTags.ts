import prepareEmbeddedDocumentTooltipTags from './prepareEmbeddedDocumentTooltipTags';
import prepareRangeTooltipTag from './prepareRangeTooltipTag';
import prepareReachTooltipTag from './prepareReachTooltipTag';

export default function prepareSpellTooltipTags(spell) {
	const { spellProperties } = CONFIG.NIMBLE;

	const properties = spell?.system?.properties?.selected ?? [];

	const tags = properties.reduce((acc: TooltipTag[], property: string): TooltipTag[] => {
		const propertyLabel: string = spellProperties[property] ?? property;

		if (property === 'range') acc.push(prepareRangeTooltipTag(spell));
		else if (property === 'reach') acc.push(prepareReachTooltipTag(spell));
		else acc.push({ label: propertyLabel });

		return acc;
	}, []);

	return prepareEmbeddedDocumentTooltipTags(tags);
}
