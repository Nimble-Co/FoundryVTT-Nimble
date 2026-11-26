import localize from '#utils/localize.js';
import type { NimbleObjectItem } from '../../../documents/item/object.js';
import prepareEmbeddedDocumentTooltipTags from './prepareEmbeddedDocumentTooltipTags.js';
import prepareRangeTooltipTag from './prepareRangeTooltipTag.js';
import prepareReachTooltipTag from './prepareReachTooltipTag.js';

export default function prepareWeaponTooltipTags(weapon: NimbleObjectItem): string | null {
	if (foundry.utils.isEmpty(weapon)) return null;
	if (weapon.system.objectType !== 'weapon') return null;
	if (!weapon.system?.properties?.selected?.length) return null;

	const { selected, thrownRange, strengthRequirement } = weapon.system.properties;
	const { weaponProperties } = CONFIG.NIMBLE;

	const tags = selected.reduce((acc: TooltipTag[], curr: string): TooltipTag[] => {
		const propertyLabel: string = weaponProperties[curr] ?? curr;

		if (curr === 'range') acc.push(prepareRangeTooltipTag(weapon));
		else if (curr === 'reach') acc.push(prepareReachTooltipTag(weapon));
		else if (curr === 'thrown') {
			acc.push({ label: thrownRange ? `${propertyLabel}: ${thrownRange} spaces` : propertyLabel });
		} else if (curr === 'twoHanded') {
			// Mirrors the book: the override reads as "2-handed (1-handed: Req. N
			// STR)", a bare requirement as two separate constraints that both apply.
			if (strengthRequirement.overridesTwoHanded && strengthRequirement.value) {
				acc.push({
					label: localize('NIMBLE.weapons.tags.twoHandedOneHandedOption', {
						value: String(strengthRequirement.value),
					}),
				});
			} else if (strengthRequirement.value) {
				acc.push({ label: propertyLabel });
				acc.push({
					label: localize('NIMBLE.weapons.tags.strengthRequirement', {
						value: String(strengthRequirement.value),
					}),
				});
			} else {
				acc.push({ label: propertyLabel });
			}
		} else {
			acc.push({ label: propertyLabel });
		}

		return acc;
	}, []);

	return prepareEmbeddedDocumentTooltipTags(tags);
}
