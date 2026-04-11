import { describe, expect, it } from 'vitest';

import type { SpellIndex, SpellIndexEntry } from '#utils/getSpells.js';

import type { RulesArray } from './spellGrantUtils.js';
import { collectSpellGrants, predicatePassesAtLevel, resolveSchools } from './spellGrantUtils.js';

function createSpellEntry(
	overrides: Partial<SpellIndexEntry> & { uuid: string; name: string },
): SpellIndexEntry {
	return {
		img: 'icons/svg/item-bag.svg',
		school: 'fire',
		tier: 0,
		isUtility: false,
		classes: [],
		...overrides,
	};
}

function createSpellIndex(entries: SpellIndexEntry[]): SpellIndex {
	const index: SpellIndex = new Map();
	for (const entry of entries) {
		if (!index.has(entry.school)) {
			index.set(entry.school, new Map());
		}
		const tierMap = index.get(entry.school)!;
		if (!tierMap.has(entry.tier)) {
			tierMap.set(entry.tier, []);
		}
		tierMap.get(entry.tier)!.push(entry);
	}
	return index;
}

describe('predicatePassesAtLevel', () => {
	it('returns true when rule has no predicate', () => {
		expect(predicatePassesAtLevel({}, 5)).toBe(true);
	});

	it('returns true when predicate has no level field', () => {
		expect(predicatePassesAtLevel({ predicate: { something: 'else' } }, 5)).toBe(true);
	});

	it('returns true when level predicate is not an object', () => {
		expect(predicatePassesAtLevel({ predicate: { level: 'invalid' } }, 5)).toBe(true);
	});

	describe('auto mode (default)', () => {
		it('passes at exactly the min level', () => {
			const rule = { predicate: { level: { min: 3 } } };
			expect(predicatePassesAtLevel(rule, 3)).toBe(true);
		});

		it('passes above the min level', () => {
			const rule = { predicate: { level: { min: 3 } } };
			expect(predicatePassesAtLevel(rule, 5)).toBe(true);
		});

		it('fails below the min level', () => {
			const rule = { predicate: { level: { min: 3 } } };
			expect(predicatePassesAtLevel(rule, 2)).toBe(false);
		});

		it('respects max level', () => {
			const rule = { predicate: { level: { min: 2, max: 5 } } };
			expect(predicatePassesAtLevel(rule, 5)).toBe(true);
			expect(predicatePassesAtLevel(rule, 6)).toBe(false);
		});

		it('uses auto mode when mode is explicitly set', () => {
			const rule = { mode: 'auto', predicate: { level: { min: 2 } } };
			expect(predicatePassesAtLevel(rule, 4)).toBe(true);
		});
	});

	describe('selectSchool mode', () => {
		it('passes only at the exact min level', () => {
			const rule = { mode: 'selectSchool', predicate: { level: { min: 3 } } };
			expect(predicatePassesAtLevel(rule, 3)).toBe(true);
		});

		it('fails above the min level', () => {
			const rule = { mode: 'selectSchool', predicate: { level: { min: 3 } } };
			expect(predicatePassesAtLevel(rule, 4)).toBe(false);
		});

		it('fails below the min level', () => {
			const rule = { mode: 'selectSchool', predicate: { level: { min: 3 } } };
			expect(predicatePassesAtLevel(rule, 2)).toBe(false);
		});

		it('respects max level', () => {
			const rule = { mode: 'selectSchool', predicate: { level: { min: 3, max: 3 } } };
			expect(predicatePassesAtLevel(rule, 3)).toBe(true);
		});
	});

	describe('selectSpell mode', () => {
		it('passes only at the exact min level', () => {
			const rule = { mode: 'selectSpell', predicate: { level: { min: 5 } } };
			expect(predicatePassesAtLevel(rule, 5)).toBe(true);
			expect(predicatePassesAtLevel(rule, 6)).toBe(false);
			expect(predicatePassesAtLevel(rule, 4)).toBe(false);
		});
	});
});

describe('resolveSchools', () => {
	it('returns schools unchanged when "known" is not present', () => {
		const result = resolveSchools(['fire', 'ice'], new Set(['radiant']));
		expect(result).toEqual(['fire', 'ice']);
	});

	it('replaces "known" with known schools', () => {
		const result = resolveSchools(['known'], new Set(['fire', 'ice']));
		expect(result.sort()).toEqual(['fire', 'ice']);
	});

	it('merges explicit schools with known schools, deduplicating', () => {
		const result = resolveSchools(['fire', 'known'], new Set(['fire', 'lightning']));
		expect(result.sort()).toEqual(['fire', 'lightning']);
	});

	it('returns empty array when "known" is the only entry and knownSchools is empty', () => {
		const result = resolveSchools(['known'], new Set());
		expect(result).toEqual([]);
	});
});

describe('collectSpellGrants', () => {
	const fireSpells = [
		createSpellEntry({ uuid: 'fire-cantrip-1', name: 'Ember', school: 'fire', tier: 0 }),
		createSpellEntry({ uuid: 'fire-cantrip-2', name: 'Spark', school: 'fire', tier: 0 }),
		createSpellEntry({ uuid: 'fire-t1-1', name: 'Fireball', school: 'fire', tier: 1 }),
	];
	const iceSpells = [
		createSpellEntry({ uuid: 'ice-cantrip-1', name: 'Frost', school: 'ice', tier: 0 }),
		createSpellEntry({ uuid: 'ice-t1-1', name: 'Ice Shard', school: 'ice', tier: 1 }),
	];
	const utilitySpells = [
		createSpellEntry({
			uuid: 'fire-util-1',
			name: 'Warm Hands',
			school: 'fire',
			tier: 0,
			isUtility: true,
		}),
	];

	function buildTestIndex() {
		return createSpellIndex([...fireSpells, ...iceSpells, ...utilitySpells]);
	}

	it('grants spells matching school and tier for auto mode rules', () => {
		const index = buildTestIndex();
		const rules: RulesArray = [
			{
				type: 'grantSpells',
				schools: ['fire'],
				tiers: [0],
				mode: 'auto',
				predicate: { level: { min: 2 } },
			},
		];

		const result = collectSpellGrants([rules], index, 'mage', 2, new Set(), new Set());

		expect(result.autoGrant.map((s) => s.uuid)).toEqual(['fire-cantrip-1', 'fire-cantrip-2']);
		expect(result.schoolSelections).toHaveLength(0);
	});

	it('skips already-owned spells', () => {
		const index = buildTestIndex();
		const rules: RulesArray = [
			{
				type: 'grantSpells',
				schools: ['fire'],
				tiers: [0],
				mode: 'auto',
				predicate: { level: { min: 2 } },
			},
		];

		const owned = new Set(['fire-cantrip-1']);
		const result = collectSpellGrants([rules], index, 'mage', 2, owned, new Set());

		expect(result.autoGrant.map((s) => s.uuid)).toEqual(['fire-cantrip-2']);
	});

	it('deduplicates spells across multiple rule arrays', () => {
		const index = buildTestIndex();
		const rules1: RulesArray = [
			{
				type: 'grantSpells',
				schools: ['fire'],
				tiers: [0],
				mode: 'auto',
				predicate: { level: { min: 2 } },
			},
		];
		const rules2: RulesArray = [
			{
				type: 'grantSpells',
				schools: ['fire'],
				tiers: [0],
				mode: 'auto',
				predicate: { level: { min: 2 } },
			},
		];

		const result = collectSpellGrants([rules1, rules2], index, 'mage', 2, new Set(), new Set());

		expect(result.autoGrant.map((s) => s.uuid)).toEqual(['fire-cantrip-1', 'fire-cantrip-2']);
	});

	it('skips rules whose level predicate does not pass', () => {
		const index = buildTestIndex();
		const rules: RulesArray = [
			{
				type: 'grantSpells',
				schools: ['fire'],
				tiers: [1],
				mode: 'auto',
				predicate: { level: { min: 4 } },
			},
		];

		const result = collectSpellGrants([rules], index, 'mage', 2, new Set(), new Set());

		expect(result.autoGrant).toHaveLength(0);
	});

	it('skips non-grantSpells rules', () => {
		const index = buildTestIndex();
		const rules: RulesArray = [
			{
				type: 'someOtherRule',
				schools: ['fire'],
				tiers: [0],
				mode: 'auto',
				predicate: { level: { min: 1 } },
			},
		];

		const result = collectSpellGrants([rules], index, 'mage', 2, new Set(), new Set());

		expect(result.autoGrant).toHaveLength(0);
	});

	it('handles auto mode with explicit uuids', () => {
		const index = buildTestIndex();
		const rules: RulesArray = [
			{
				type: 'grantSpells',
				uuids: ['fire-cantrip-2', 'ice-cantrip-1'],
				mode: 'auto',
				predicate: { level: { min: 2 } },
			},
		];

		const result = collectSpellGrants([rules], index, 'mage', 2, new Set(), new Set());

		expect(result.autoGrant.map((s) => s.uuid)).toEqual(['fire-cantrip-2', 'ice-cantrip-1']);
	});

	it('resolves "known" schools from knownSchools set', () => {
		const index = buildTestIndex();
		const rules: RulesArray = [
			{
				type: 'grantSpells',
				schools: ['known'],
				tiers: [1],
				mode: 'auto',
				predicate: { level: { min: 2 } },
			},
		];

		const knownSchools = new Set(['fire', 'ice']);
		const result = collectSpellGrants([rules], index, 'mage', 2, new Set(), knownSchools);

		const grantedUuids = result.autoGrant.map((s) => s.uuid);
		expect(grantedUuids).toContain('fire-t1-1');
		expect(grantedUuids).toContain('ice-t1-1');
	});

	describe('selectSchool mode', () => {
		it('creates a school selection group at the exact target level', () => {
			const index = buildTestIndex();
			const rules: RulesArray = [
				{
					id: 'school-choice-1',
					type: 'grantSpells',
					schools: ['fire', 'ice'],
					tiers: [0],
					mode: 'selectSchool',
					count: 1,
					predicate: { level: { min: 3 } },
				},
			];

			const result = collectSpellGrants([rules], index, 'mage', 3, new Set(), new Set());

			expect(result.autoGrant).toHaveLength(0);
			expect(result.schoolSelections).toHaveLength(1);
			expect(result.schoolSelections[0].ruleId).toBe('school-choice-1');
			expect(result.schoolSelections[0].availableSchools).toEqual(['fire', 'ice']);
			expect(result.schoolSelections[0].count).toBe(1);
		});

		it('does not create a school selection above the exact level', () => {
			const index = buildTestIndex();
			const rules: RulesArray = [
				{
					id: 'school-choice-1',
					type: 'grantSpells',
					schools: ['fire', 'ice'],
					tiers: [0],
					mode: 'selectSchool',
					count: 1,
					predicate: { level: { min: 3 } },
				},
			];

			const result = collectSpellGrants([rules], index, 'mage', 4, new Set(), new Set());

			expect(result.schoolSelections).toHaveLength(0);
		});

		it('filters out schools where character already owns all spells', () => {
			const index = buildTestIndex();
			const rules: RulesArray = [
				{
					id: 'school-choice-1',
					type: 'grantSpells',
					schools: ['fire', 'ice'],
					tiers: [0],
					mode: 'selectSchool',
					count: 1,
					predicate: { level: { min: 3 } },
				},
			];

			// Character already owns all fire cantrips
			const owned = new Set(['fire-cantrip-1', 'fire-cantrip-2']);
			const result = collectSpellGrants([rules], index, 'mage', 3, owned, new Set());

			expect(result.schoolSelections).toHaveLength(1);
			expect(result.schoolSelections[0].availableSchools).toEqual(['ice']);
		});

		it('omits the group entirely when all schools are fully owned', () => {
			const index = buildTestIndex();
			const rules: RulesArray = [
				{
					id: 'school-choice-1',
					type: 'grantSpells',
					schools: ['fire', 'ice'],
					tiers: [0],
					mode: 'selectSchool',
					count: 1,
					predicate: { level: { min: 3 } },
				},
			];

			const owned = new Set(['fire-cantrip-1', 'fire-cantrip-2', 'ice-cantrip-1']);
			const result = collectSpellGrants([rules], index, 'mage', 3, owned, new Set());

			expect(result.schoolSelections).toHaveLength(0);
		});
	});

	it('handles utilityOnly filtering', () => {
		const index = buildTestIndex();
		const rules: RulesArray = [
			{
				type: 'grantSpells',
				schools: ['fire'],
				tiers: [0],
				mode: 'auto',
				utilityOnly: true,
				predicate: { level: { min: 2 } },
			},
		];

		const result = collectSpellGrants([rules], index, 'mage', 2, new Set(), new Set());

		expect(result.autoGrant).toHaveLength(1);
		expect(result.autoGrant[0].uuid).toBe('fire-util-1');
	});

	it('handles multiple tiers in a single rule', () => {
		const index = buildTestIndex();
		const rules: RulesArray = [
			{
				type: 'grantSpells',
				schools: ['fire'],
				tiers: [0, 1],
				mode: 'auto',
				predicate: { level: { min: 2 } },
			},
		];

		const result = collectSpellGrants([rules], index, 'mage', 2, new Set(), new Set());

		const grantedUuids = result.autoGrant.map((s) => s.uuid);
		expect(grantedUuids).toContain('fire-cantrip-1');
		expect(grantedUuids).toContain('fire-cantrip-2');
		expect(grantedUuids).toContain('fire-t1-1');
	});

	it('returns empty results for empty rules arrays', () => {
		const index = buildTestIndex();
		const result = collectSpellGrants([], index, 'mage', 2, new Set(), new Set());

		expect(result.autoGrant).toHaveLength(0);
		expect(result.schoolSelections).toHaveLength(0);
	});
});
