import type { NimbleSpellItem } from '../../../documents/item/spell';

export default function prepareSpellMetadata(spell: NimbleSpellItem, includeIcon = false): string {
	const { spellSchools, spellSchoolIcons, spellTiers } = CONFIG.NIMBLE;
	const components: string[] = [];

	if (includeIcon && spell.system.school) {
		components.push(
			`<i class="nimble-tooltip__item-metadata-icon ${spellSchoolIcons[spell.system.school]}"></i>`,
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
