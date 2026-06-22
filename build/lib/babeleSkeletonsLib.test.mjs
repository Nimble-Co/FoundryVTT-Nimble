import { describe, expect, it } from 'vitest';
import {
	buildEmbeddedItemEntries,
	buildTableResultEntries,
	extractActivationFields,
	extractEntryFields,
	extractRuleEntries,
	mergeEntry,
	nonEmptyString,
	reconcileEntries,
	sortObjectKeys,
	toTitleCase,
} from './babeleSkeletonsLib.mjs';

describe('nonEmptyString', () => {
	it('accepts strings with non-whitespace content', () => {
		expect(nonEmptyString('hi')).toBe(true);
		expect(nonEmptyString('  a  ')).toBe(true);
	});

	it('rejects empty, whitespace, and non-string values', () => {
		expect(nonEmptyString('')).toBe(false);
		expect(nonEmptyString('   ')).toBe(false);
		expect(nonEmptyString(null)).toBe(false);
		expect(nonEmptyString(undefined)).toBe(false);
		expect(nonEmptyString(0)).toBe(false);
		expect(nonEmptyString(false)).toBe(false);
		expect(nonEmptyString({})).toBe(false);
	});
});

describe('toTitleCase', () => {
	it('splits on hyphens and underscores, capitalising each word', () => {
		expect(toTitleCase('way-of-flame')).toBe('Way Of Flame');
		expect(toTitleCase('the_cheat')).toBe('The Cheat');
	});

	it('collapses repeated separators', () => {
		expect(toTitleCase('foo--bar__baz')).toBe('Foo Bar Baz');
	});
});

describe('extractRuleEntries', () => {
	it('keys by rule.id when present', () => {
		expect(extractRuleEntries([{ id: 'r1', label: 'Stout' }])).toEqual({
			r1: { label: 'Stout' },
		});
	});

	it('falls back to index:N when rule.id is missing or empty', () => {
		expect(extractRuleEntries([{ label: 'Optimistic' }, { id: '', label: 'Lithe' }])).toEqual({
			'index:0': { label: 'Optimistic' },
			'index:1': { label: 'Lithe' },
		});
	});

	it('skips rules without a label', () => {
		expect(extractRuleEntries([{ id: 'r1' }, { id: 'r2', label: '' }])).toBe(null);
	});

	it('returns null when rules is not an array', () => {
		expect(extractRuleEntries(undefined)).toBe(null);
		expect(extractRuleEntries({})).toBe(null);
	});
});

describe('extractActivationFields', () => {
	it('extracts present strings; omits empty ones', () => {
		expect(
			extractActivationFields({
				cost: { details: 'c' },
				duration: { details: '' },
				targets: { restrictions: 'r' },
			}),
		).toEqual({ costDetails: 'c', targetsRestrictions: 'r' });
	});

	it('returns null when activation is missing or empty', () => {
		expect(extractActivationFields(null)).toBe(null);
		expect(extractActivationFields({})).toBe(null);
	});
});

describe('extractEntryFields', () => {
	it('reads name and system.description for items', () => {
		expect(
			extractEntryFields({
				name: 'Dagger',
				type: 'object',
				system: { description: 'a small blade' },
			}),
		).toEqual({ name: 'Dagger', description: 'a small blade' });
	});

	it('reads top-level description for roll tables', () => {
		expect(
			extractEntryFields(
				{ name: 'Table', description: 'roll me', system: { description: 'ignored' } },
				{ isRollTable: true },
			),
		).toEqual({ name: 'Table', description: 'roll me' });
	});

	it('extracts actor-only fields for actor documents', () => {
		const result = extractEntryFields({
			name: 'Skeleton',
			type: 'npc',
			system: {
				description: 'spooky',
				details: { creatureType: 'Undead' },
			},
			prototypeToken: { name: 'Skeleton Token' },
		});
		expect(result).toEqual({
			name: 'Skeleton',
			description: 'spooky',
			creatureType: 'Undead',
			tokenName: 'Skeleton Token',
		});
	});

	it('omits tokenName when it matches the actor name', () => {
		expect(
			extractEntryFields({
				name: 'Skeleton',
				type: 'npc',
				prototypeToken: { name: 'Skeleton' },
			}),
		).toEqual({ name: 'Skeleton' });
	});

	it('rolls activation fields and rules up onto the entry', () => {
		expect(
			extractEntryFields({
				name: 'Spell',
				type: 'spell',
				system: {
					description: 'desc',
					activation: { cost: { details: 'CD' } },
					rules: [{ id: 'r1', label: 'tag' }],
				},
			}),
		).toEqual({
			name: 'Spell',
			description: 'desc',
			costDetails: 'CD',
			rules: { r1: { label: 'tag' } },
		});
	});
});

describe('buildEmbeddedItemEntries', () => {
	it('returns null when the actor has no items array', () => {
		expect(buildEmbeddedItemEntries({})).toBe(null);
	});

	it('keys embedded items by name (Babele convention)', () => {
		const result = buildEmbeddedItemEntries({
			name: 'Goblin',
			items: [
				{ _id: 'a', name: 'Bite', type: 'feature', system: { description: 'chomp' } },
				{ _id: 'b', name: 'Sneak', type: 'feature' },
			],
		});
		expect(result).toEqual({
			Bite: { name: 'Bite', description: 'chomp' },
			Sneak: { name: 'Sneak' },
		});
	});

	it('records duplicates onto a caller-supplied collisions array', () => {
		const collisions = [];
		const result = buildEmbeddedItemEntries(
			{
				name: 'Goblin',
				items: [
					{ _id: 'a', name: 'Bite', type: 'feature' },
					{ _id: 'b', name: 'Bite', type: 'feature', system: { description: 'second' } },
				],
			},
			collisions,
		);
		expect(collisions).toEqual(['Goblin → Bite']);
		// Second occurrence wins (documented behaviour).
		expect(result?.Bite).toEqual({ name: 'Bite', description: 'second' });
	});

	it('skips items without a name or with no extractable fields', () => {
		const result = buildEmbeddedItemEntries({
			items: [{ name: '' }, { name: 'Bite', type: 'feature' }],
		});
		expect(result).toEqual({ Bite: { name: 'Bite' } });
	});
});

describe('buildTableResultEntries', () => {
	it('keys results by _id and captures name + description', () => {
		expect(
			buildTableResultEntries({
				results: [
					{ _id: 'r1', name: 'A', description: 'one' },
					{ _id: 'r2', name: 'B' },
				],
			}),
		).toEqual({
			r1: { name: 'A', description: 'one' },
			r2: { name: 'B' },
		});
	});

	it('skips results without an _id', () => {
		expect(buildTableResultEntries({ results: [{ name: 'no id' }] })).toBe(null);
	});

	it('returns null when results is not an array', () => {
		expect(buildTableResultEntries({})).toBe(null);
	});
});

describe('mergeEntry', () => {
	it('keeps an existing translation that differs from source', () => {
		expect(mergeEntry({ name: 'Daga' }, { name: 'Dagger' })).toEqual({ name: 'Daga' });
	});

	it('falls back to source when the existing value is empty string (treated as not yet translated)', () => {
		expect(mergeEntry({ name: '' }, { name: 'Dagger' })).toEqual({ name: 'Dagger' });
	});

	it('falls back to source when existing matches source verbatim (placeholder)', () => {
		expect(mergeEntry({ name: 'Dagger' }, { name: 'Dagger' })).toEqual({ name: 'Dagger' });
	});

	it('recurses into nested objects', () => {
		expect(
			mergeEntry({ rules: { r1: { label: 'Vigoroso' } } }, { rules: { r1: { label: 'Stout' } } }),
		).toEqual({ rules: { r1: { label: 'Vigoroso' } } });
	});

	it('falls back to source when shapes disagree (string → object)', () => {
		const existing = { items: 'previously a string' };
		const source = { items: { Bite: { name: 'Bite' } } };
		expect(mergeEntry(existing, source)).toEqual({ items: { Bite: { name: 'Bite' } } });
	});

	it('falls back to source when shapes disagree (object → string)', () => {
		const existing = { name: { old: 'shape' } };
		const source = { name: 'Dagger' };
		expect(mergeEntry(existing, source)).toEqual({ name: 'Dagger' });
	});

	it('preserves keys in existing that are no longer in source (stale at this level)', () => {
		expect(mergeEntry({ legacy: 'kept' }, { name: 'Dagger' })).toEqual({
			name: 'Dagger',
			legacy: 'kept',
		});
	});

	it('handles undefined existing', () => {
		expect(mergeEntry(undefined, { name: 'Dagger' })).toEqual({ name: 'Dagger' });
	});
});

describe('reconcileEntries', () => {
	it('reports added entries and merges with existing translations', () => {
		const existing = { Dagger: { name: 'Daga' } };
		const source = {
			Dagger: { name: 'Dagger', description: 'small blade' },
			Sword: { name: 'Sword' },
		};
		const { merged, added, stale } = reconcileEntries(existing, source);
		expect(merged).toEqual({
			Dagger: { name: 'Daga', description: 'small blade' },
			Sword: { name: 'Sword' },
		});
		expect(added).toEqual(['Sword']);
		expect(stale).toEqual([]);
	});

	it('flags entries no longer in source as stale but retains them', () => {
		const existing = { OldName: { name: 'Antiguo' } };
		const source = { NewName: { name: 'NewName' } };
		const { merged, stale } = reconcileEntries(existing, source);
		expect(stale).toEqual(['OldName']);
		expect(merged.OldName).toEqual({ name: 'Antiguo' });
		expect(merged.NewName).toEqual({ name: 'NewName' });
	});

	it('handles a fresh skeleton (no existing entries)', () => {
		const { merged, added, stale } = reconcileEntries(undefined, { A: { name: 'A' } });
		expect(merged).toEqual({ A: { name: 'A' } });
		expect(added).toEqual(['A']);
		expect(stale).toEqual([]);
	});
});

describe('sortObjectKeys', () => {
	it('sorts top-level keys alphabetically', () => {
		expect(Object.keys(sortObjectKeys({ b: 1, a: 2, c: 3 }))).toEqual(['a', 'b', 'c']);
	});

	it('sorts recursively into nested objects', () => {
		const sorted = sortObjectKeys({ z: { b: 1, a: 2 }, a: { d: 3, c: 4 } });
		expect(Object.keys(sorted)).toEqual(['a', 'z']);
		expect(Object.keys(sorted.a)).toEqual(['c', 'd']);
		expect(Object.keys(sorted.z)).toEqual(['a', 'b']);
	});

	it('leaves arrays in original order', () => {
		const sorted = sortObjectKeys({ list: ['z', 'a', 'm'] });
		expect(sorted.list).toEqual(['z', 'a', 'm']);
	});

	it('returns primitives unchanged', () => {
		expect(sortObjectKeys('hi')).toBe('hi');
		expect(sortObjectKeys(null)).toBe(null);
		expect(sortObjectKeys(5)).toBe(5);
	});
});
