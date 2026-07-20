import type { SpellIndex, SpellIndexEntry } from '#utils/getSpells.js';
import { getSpellsFromIndex } from '#utils/getSpellsFromIndex.ts';
import localize from '#utils/localize.ts';

import type { SchoolSelectionGroup, SpellSelectionGroup } from './characterCreation/types.js';

/** A spell that will be removed during subclass selection */
export interface SpellRemovalEntry {
	uuid: string;
	name: string;
	img: string;
}

/**
 * Maps a spell school to the damage type its spells deal. Used when retagging a
 * "keep and convert" exception spell so its elemental damage matches the new
 * school. Note the mapping is not identity: the Ice school deals `cold` damage.
 */
export const SCHOOL_TO_DAMAGE_TYPE: Record<string, string> = {
	fire: 'fire',
	ice: 'cold',
	lightning: 'lightning',
};

/** The elemental damage types that a conversion may rewrite. */
const ELEMENTAL_DAMAGE_TYPES = new Set(Object.values(SCHOOL_TO_DAMAGE_TYPE));

/** Resolves the damage type for a school, or null when the school is non-elemental. */
export function schoolToDamageType(school: string): string | null {
	return SCHOOL_TO_DAMAGE_TYPE[school] ?? null;
}

/**
 * Active spell-school restriction collected from restrictSpellSchools rules.
 * `allowedSchools` persists across levels (derived from all active rules), while
 * the exception fields describe the one-time "keep and convert" choice.
 */
export interface SpellRestriction {
	active: boolean;
	allowedSchools: Set<string>;
	exceptionFromSchools: string[];
	exceptionCount: number;
}

/**
 * Collects the active spell-school restriction from restrictSpellSchools rules.
 * Multiple rules union their allowed/exception schools; exception counts sum.
 */
export function collectSpellRestrictions(rulesArrays: RulesArray[]): SpellRestriction {
	const allowedSchools = new Set<string>();
	const exceptionFromSchools = new Set<string>();
	let exceptionCount = 0;
	let active = false;

	for (const rules of rulesArrays) {
		for (const rule of rules) {
			if (rule.type !== 'restrictSpellSchools') continue;
			active = true;
			for (const s of (rule.allowedSchools as string[] | undefined) ?? []) allowedSchools.add(s);
			for (const s of (rule.exceptionFromSchools as string[] | undefined) ?? [])
				exceptionFromSchools.add(s);
			exceptionCount += (rule.exceptionCount as number | undefined) ?? 0;
		}
	}

	return {
		active,
		allowedSchools,
		exceptionFromSchools: [...exceptionFromSchools],
		exceptionCount,
	};
}

/**
 * Deep-clones a spell's `activation.effects` array, remapping any elemental
 * damage type (fire/cold/lightning) to `toDamageType`. Non-elemental damage
 * (radiant, necrotic, physical, …) is left untouched. Recurses into the nested
 * `on.<outcome>` effect arrays produced by saving-throw and attack effects.
 */
export function retagEffectsDamageType(effects: unknown, toDamageType: string): unknown[] {
	if (!Array.isArray(effects)) return [];

	const remapNode = (node: unknown): unknown => {
		if (!node || typeof node !== 'object') return node;
		const clone: Record<string, unknown> = { ...(node as Record<string, unknown>) };

		if (
			typeof clone.damageType === 'string' &&
			ELEMENTAL_DAMAGE_TYPES.has(clone.damageType as string)
		) {
			clone.damageType = toDamageType;
		}

		if (clone.on && typeof clone.on === 'object') {
			const on = clone.on as Record<string, unknown>;
			const newOn: Record<string, unknown> = { ...on };
			for (const [outcome, children] of Object.entries(on)) {
				if (Array.isArray(children)) {
					newOn[outcome] = children.map(remapNode);
				}
			}
			clone.on = newOn;
		}

		return clone;
	};

	return effects.map(remapNode);
}

/** Result of processing grantSpells rules */
export interface SpellGrantResult {
	autoGrant: SpellIndexEntry[];
	schoolSelections: SchoolSelectionGroup[];
	spellSelections: SpellSelectionGroup[];
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
 * Collects known schools from auto-mode grantSpells rules.
 * Only considers schools explicitly listed in auto-mode rules (not "known" sentinels).
 */
export function collectKnownSchools(rules: RulesArray, knownSchools: Set<string>): void {
	for (const rule of rules) {
		if (rule.type !== 'grantSpells') continue;
		if ((rule.mode as string) !== 'auto' && rule.mode !== undefined) continue;
		const schools = rule.schools as string[] | undefined;
		if (schools) {
			for (const school of schools) {
				if (school !== 'known') knownSchools.add(school);
			}
		}
	}
}

/** Builds a flat UUID→SpellIndexEntry map for O(1) lookups */
function buildUuidLookup(spellIndex: SpellIndex): Map<string, SpellIndexEntry> {
	const lookup = new Map<string, SpellIndexEntry>();
	for (const tierMap of spellIndex.values()) {
		for (const spells of tierMap.values()) {
			for (const spell of spells) {
				lookup.set(spell.uuid, spell);
			}
		}
	}
	return lookup;
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
	allowedSchools?: Set<string>,
): SpellGrantResult {
	const autoGrant: SpellIndexEntry[] = [];
	const schoolSelections: SchoolSelectionGroup[] = [];
	const spellSelections: SpellSelectionGroup[] = [];
	const seenUuids = new Set<string>();
	const uuidLookup = buildUuidLookup(spellIndex);

	// An active school restriction ("you can only cast fire spells from now on")
	// filters every grant down to the allowed schools, so disallowed schools are
	// never re-granted at later levels.
	const restricted = !!allowedSchools && allowedSchools.size > 0;
	const schoolAllowed = (school: string) => !restricted || allowedSchools!.has(school);

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
						const spell = uuidLookup.get(uuid);
						if (spell && schoolAllowed(spell.school)) autoGrant.push(spell);
					}
				} else if (resolvedSchools.length > 0) {
					const spells = getSpellsFromIndex(spellIndex, resolvedSchools, tiers, {
						utilityOnly,
						forClass: classIdentifier,
					});
					for (const spell of spells) {
						if (seenUuids.has(spell.uuid) || ownedSpellUuids.has(spell.uuid)) continue;
						if (!schoolAllowed(spell.school)) continue;
						seenUuids.add(spell.uuid);
						autoGrant.push(spell);
					}
				}
			} else if (mode === 'selectSchool' && resolvedSchools.length > 0) {
				// Filter out schools where the character already owns all matching spells
				// (i.e., that school was already selected at a previous level), and any
				// school excluded by an active restriction.
				const availableSchools = resolvedSchools.filter((school) => {
					if (!schoolAllowed(school)) return false;
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
			} else if (mode === 'selectSpell' && resolvedSchools.length > 0) {
				const ruleId = (rule.id as string) ?? '';
				const label = (rule.label as string) || localize('NIMBLE.spellGrants.chooseSpellsFallback');
				const count = (rule.count as number) ?? 1;

				// Create one selection group per school so the player picks count from each
				for (const school of resolvedSchools) {
					if (!schoolAllowed(school)) continue;
					const availableSpells = getSpellsFromIndex(spellIndex, [school], tiers, {
						utilityOnly,
						forClass: classIdentifier,
					}).filter((s) => !ownedSpellUuids.has(s.uuid));

					if (availableSpells.length > 0) {
						spellSelections.push({
							ruleId: `${ruleId}-${school}`,
							label,
							availableSpells,
							count,
							utilityOnly,
							forClass: classIdentifier,
							source: 'class',
						});
					}
				}
			}
		}
	}

	return { autoGrant, schoolSelections, spellSelections };
}

/**
 * Collects spells to remove based on removeSpells rules on features being granted.
 * Only matches spells that came from automation (have a compendiumSource matching a rule UUID).
 * Manual player spells without a compendiumSource are never targeted.
 */
export function collectSpellRemovals(
	rulesArrays: RulesArray[],
	ownedSpells: Array<{
		name?: string;
		img?: string;
		_stats?: { compendiumSource?: string };
	}>,
): SpellRemovalEntry[] {
	const removalUuids = new Set<string>();

	for (const rules of rulesArrays) {
		for (const rule of rules) {
			if (rule.type !== 'removeSpells') continue;
			const uuids = rule.uuids as string[] | undefined;
			if (!uuids) continue;
			for (const uuid of uuids) {
				removalUuids.add(uuid);
			}
		}
	}

	if (removalUuids.size === 0) return [];

	const spellsToRemove: SpellRemovalEntry[] = [];
	const seenUuids = new Set<string>();

	for (const spell of ownedSpells) {
		const source = spell._stats?.compendiumSource;
		if (!source || !removalUuids.has(source)) continue;
		if (seenUuids.has(source)) continue;
		seenUuids.add(source);
		spellsToRemove.push({
			uuid: source,
			name: spell.name ?? '',
			img: spell.img ?? 'icons/svg/item-bag.svg',
		});
	}

	return spellsToRemove;
}

/** Owned-spell shape used for school-based removal (needs the spell's school). */
export interface OwnedSpellForRemoval {
	name?: string;
	img?: string;
	system?: { school?: string };
	_stats?: { compendiumSource?: string };
}

/**
 * Collects automation-granted spells to remove because their school is not in
 * `allowedSchools` (the persistent restriction). Spells whose compendiumSource
 * is in `keepUuids` — the player's chosen "keep and convert" exceptions — are
 * spared. Manual spells (no compendiumSource) are never targeted.
 */
export function collectSchoolRemovals(
	ownedSpells: OwnedSpellForRemoval[],
	allowedSchools: Set<string>,
	keepUuids: Set<string> = new Set(),
): SpellRemovalEntry[] {
	if (allowedSchools.size === 0) return [];

	const spellsToRemove: SpellRemovalEntry[] = [];
	const seenUuids = new Set<string>();

	for (const spell of ownedSpells) {
		const source = spell._stats?.compendiumSource;
		if (!source || keepUuids.has(source) || seenUuids.has(source)) continue;
		const school = spell.system?.school ?? '';
		if (allowedSchools.has(school)) continue;
		seenUuids.add(source);
		spellsToRemove.push({
			uuid: source,
			name: spell.name ?? '',
			img: spell.img ?? 'icons/svg/item-bag.svg',
		});
	}

	return spellsToRemove;
}
