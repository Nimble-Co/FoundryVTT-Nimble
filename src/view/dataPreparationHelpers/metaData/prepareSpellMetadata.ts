import isImageIcon from '#utils/isImageIcon.js';
import type { NimbleSpellItem } from '../../../documents/item/spell.js';

export default function prepareSpellMetadata(spell: NimbleSpellItem, includeIcon = false): string {
	const { spellSchools, spellSchoolIcons, spellTiers } = CONFIG.NIMBLE;
	const components: string[] = [];

	if (includeIcon && spell.system.school) {
		const icon = spellSchoolIcons[spell.system.school];
		components.push(
			isImageIcon(icon)
				? `<img class="nimble-tooltip__item-metadata-icon" src="${icon}" alt="" />`
				: `<i class="nimble-tooltip__item-metadata-icon ${icon}"></i>`,
		);
	}

	if (spell.system.properties.selected.includes('utilitySpell')) {
		components.push(spellSchools[spell.system.school] ?? null);
		components.push('Utility Spell');
	} else if (spellTiers[spell.system.tier] && spell.system.tier > 0) {
		components.push(spellTiers[spell.system.tier ?? 0]);
		components.push(spellSchools[spell.system.school] ?? null);
		components.push('Spell');
	} else {
		components.push(spellSchools[spell.system.school] ?? null);
		components.push(spellTiers[0]);
	}

	return components.filter(Boolean).join(' ');
}
