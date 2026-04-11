import type { SpellIndex, SpellIndexEntry } from '#utils/getSpells.js';
import { getSpellsFromIndex } from '#utils/getSpellsFromIndex.ts';
import localize from '#utils/localize.ts';

import type { SchoolSelectionGroup } from './characterCreation/types.js';

/** Result of processing grantSpells rules */
export interface SpellGrantResult {
	autoGrant: SpellIndexEntry[];
	schoolSelections: SchoolSelectionGroup[];
}

export type RulesArray = Array<{
	type: string;
	predicate?: Record<string, unknown>;
	[key: string]: unknown;
}>;

/**
 * Checks if a rule's level predicate passes at the given level.
 * For selection modes (selectSchool/selectSpell), uses exact match on min
 * since those are one-time choices. For auto mode, uses >= behavior.
 */
export function predicatePassesAtLevel(
	rule: { predicate?: Record<string, unknown>; mode?: unknown },
	level: number,
): boolean {
	const predicate = rule.predicate;
	if (!predicate) return true;

	const levelPred = predicate.level;
	if (!levelPred || typeof levelPred !== 'object') return true;

	const { min, max } = levelPred as { min?: number; max?: number };

	const mode = (rule.mode as string) ?? 'auto';
	if (mode === 'selectSchool' || mode === 'selectSpell') {
		// Selection modes fire only at the exact level they become available
		if (min !== undefined && level !== min) return false;
	} else {
		// Auto mode fires at min level and above
		if (min !== undefined && level < min) return false;
	}

	if (max !== undefined && level > max) return false;

	return true;
}

/**
 * Resolves the schools array for a rule. If the array contains "known",
 * it is replaced with the character's known spell schools.
 */
export function resolveSchools(schools: string[], knownSchools: Set<string>): string[] {
	if (!schools.includes('known')) return schools;
	return [...new Set([...schools.filter((s) => s !== 'known'), ...knownSchools])];
}

/**
 * Collects spell grants from grantSpells rules, filtered by level predicate.
 * Returns auto-granted spells (filtered by ownership) and school selection groups.
 */
export function collectSpellGrants(
	rulesArrays: RulesArray[],
	spellIndex: SpellIndex,
	classIdentifier: string,
	targetLevel: number,
	ownedSpellUuids: Set<string>,
	knownSchools: Set<string>,
): SpellGrantResult {
	const autoGrant: SpellIndexEntry[] = [];
	const schoolSelections: SchoolSelectionGroup[] = [];
	const seenUuids = new Set<string>();

	for (const rules of rulesArrays) {
		for (const rule of rules) {
			if (rule.type !== 'grantSpells') continue;
			if (!predicatePassesAtLevel(rule, targetLevel)) continue;

			const mode = (rule.mode as string) ?? 'auto';
			const tiers = (rule.tiers as number[]) ?? [0];
			const utilityOnly = (rule.utilityOnly as boolean) ?? false;
			const schools = Array.isArray(rule.schools) ? (rule.schools as string[]) : [];
			const resolvedSchools = resolveSchools(schools, knownSchools);

			if (mode === 'auto') {
				if (Array.isArray(rule.uuids) && rule.uuids.length > 0) {
					for (const uuid of rule.uuids as string[]) {
						if (seenUuids.has(uuid) || ownedSpellUuids.has(uuid)) continue;
						seenUuids.add(uuid);
						for (const tierMap of spellIndex.values()) {
							for (const spells of tierMap.values()) {
								const spell = spells.find((s) => s.uuid === uuid);
								if (spell) autoGrant.push(spell);
							}
						}
					}
				} else if (resolvedSchools.length > 0) {
					const spells = getSpellsFromIndex(spellIndex, resolvedSchools, tiers, {
						utilityOnly,
						forClass: classIdentifier,
					});
					for (const spell of spells) {
						if (seenUuids.has(spell.uuid) || ownedSpellUuids.has(spell.uuid)) continue;
						seenUuids.add(spell.uuid);
						autoGrant.push(spell);
					}
				}
			} else if (mode === 'selectSchool' && resolvedSchools.length > 0) {
				// Filter out schools where the character already owns all matching spells
				// (i.e., that school was already selected at a previous level)
				const availableSchools = resolvedSchools.filter((school) => {
					const schoolSpells = getSpellsFromIndex(spellIndex, [school], tiers, {
						utilityOnly,
						forClass: classIdentifier,
					});
					return schoolSpells.some((s) => !ownedSpellUuids.has(s.uuid));
				});

				if (availableSchools.length > 0) {
					schoolSelections.push({
						ruleId: (rule.id as string) ?? '',
						label: (rule.label as string) || localize('NIMBLE.spellGrants.chooseSchoolsFallback'),
						availableSchools,
						tiers,
						count: (rule.count as number) ?? 1,
						utilityOnly,
						forClass: classIdentifier,
						source: 'class',
					});
				}
			}
		}
	}

	return { autoGrant, schoolSelections };
}
