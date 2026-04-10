import type { SpellIndex, SpellIndexEntry } from '#utils/getSpells.js';
import { getSpellsFromIndex } from '#utils/getSpellsFromIndex.js';
import localize from '#utils/localize.js';
import type { SchoolSelectionGroup, SpellGrantSource, SpellSelectionGroup } from '../types.js';

// Type for grantSpells rule properties
interface GrantSpellsRuleData {
	id: string;
	label: string;
	schools?: string[];
	tiers?: number[];
	utilityOnly?: boolean;
	uuids?: string[];
	mode?: 'auto' | 'selectSchool' | 'selectSpell';
	count?: number | null;
}

/**
 * Processes grantSpells rules from class features or backgrounds and populates
 * the output arrays with auto-granted spells and selection groups.
 */
export function processGrantSpellsRules(
	rules: Array<{ type: string; [key: string]: unknown }>,
	spellIndex: SpellIndex,
	classIdentifier: string,
	source: SpellGrantSource,
	autoGrant: SpellIndexEntry[],
	schoolSelections: SchoolSelectionGroup[],
	spellSelections: SpellSelectionGroup[],
): void {
	for (const rule of rules) {
		if (rule.type !== 'grantSpells') continue;

		const grantRule = rule as unknown as GrantSpellsRuleData;

		const mode = grantRule.mode ?? 'auto';
		const tiers = grantRule.tiers ?? [0];
		const utilityOnly = grantRule.utilityOnly ?? false;

		if (mode === 'auto') {
			// Auto-grant mode: add spells directly
			if (grantRule.uuids && grantRule.uuids.length > 0) {
				for (const uuid of grantRule.uuids) {
					// Try to find spell in index by UUID
					for (const tierMap of spellIndex.values()) {
						for (const spells of tierMap.values()) {
							const spell = spells.find((s) => s.uuid === uuid);
							if (spell) {
								autoGrant.push(spell);
							}
						}
					}
				}
			} else if (grantRule.schools && grantRule.schools.length > 0) {
				// Grant by school + tier
				const spells = getSpellsFromIndex(spellIndex, grantRule.schools, tiers, {
					utilityOnly,
					forClass: classIdentifier,
				});
				autoGrant.push(...spells);
			}
		} else if (mode === 'selectSchool') {
			// School selection mode: add to selection groups
			schoolSelections.push({
				ruleId: grantRule.id,
				label: grantRule.label || localize('NIMBLE.spellGrants.chooseSchoolsFallback'),
				availableSchools: grantRule.schools ?? [],
				tiers,
				count: grantRule.count ?? 1,
				utilityOnly,
				forClass: classIdentifier,
				source,
			});
		} else if (mode === 'selectSpell') {
			// Spell selection mode: user picks individual spells from the pool
			const availableSpells = getSpellsFromIndex(spellIndex, grantRule.schools ?? [], tiers, {
				utilityOnly,
				forClass: classIdentifier,
			});
			spellSelections.push({
				ruleId: grantRule.id,
				label: grantRule.label || localize('NIMBLE.spellGrants.chooseSpellsFallback'),
				availableSpells,
				count: grantRule.count ?? 1,
				utilityOnly,
				forClass: classIdentifier,
				source,
			});
		}
	}
}
