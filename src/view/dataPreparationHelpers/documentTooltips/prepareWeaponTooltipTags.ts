import prepareEmbeddedDocumentTooltipTags from './prepareEmbeddedDocumentTooltipTags';
import prepareRangeTooltipTag from './prepareRangeTooltipTag';

import type { NimbleObjectItem } from '../../../documents/item/object';
import prepareReachTooltipTag from './prepareReachTooltipTag';

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
			if (strengthRequirement.overridesTwoHanded) {
				acc.push({
					label: `Requires Strength ${strengthRequirement.value ?? 0} or ${propertyLabel}`,
				});
			} else if (strengthRequirement.value) {
				acc.push({ label: `Requires Strength ${strengthRequirement.value}` });
				acc.push({ label: propertyLabel });
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
