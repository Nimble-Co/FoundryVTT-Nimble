import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
	buildEmbeddedItemEntries,
	buildPackSkeleton,
	buildTableResultEntries,
	deriveBoonFolders,
	deriveClassFeatureFolders,
	deriveFoldersForPack,
	deriveMonsterFolders,
	deriveSubclassFolders,
	extractActivationFields,
	extractEntryFields,
	extractRuleEntries,
	mergeEntry,
	nonEmptyString,
	reconcileEntries,
	sortObjectKeys,
	toTitleCase,
} from './babeleSkeletonsLib.mjs';

// Tests touch path-derived logic; use `path.join` so separators match the
// host platform's `path.sep` (the derivation code splits on `path.sep`).
const PACK_ROOT = path.join('packs', 'pack');
const join = (...parts) => path.join(PACK_ROOT, ...parts);

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

describe('deriveMonsterFolders', () => {
	it('returns the empty list when all sources sit at the pack root', () => {
		expect(deriveMonsterFolders(PACK_ROOT, [{ file: join('dragon.json') }])).toEqual([]);
	});

	it('title-cases the top-level subdirectory', () => {
		expect(
			deriveMonsterFolders(PACK_ROOT, [
				{ file: join('aberrations', 'mind-flayer.json') },
				{ file: join('humanoids', 'orc.json') },
			]),
		).toEqual(['Aberrations', 'Humanoids']);
	});

	it('uses the second segment when the first is "core"', () => {
		expect(
			deriveMonsterFolders(PACK_ROOT, [{ file: join('core', 'beasts', 'wolf.json') }]),
		).toEqual(['Beasts']);
	});

	it('skips a "core" entry with no second segment', () => {
		expect(deriveMonsterFolders(PACK_ROOT, [{ file: join('core', 'wolf.json') }])).toEqual([]);
	});

	it('dedupes entries that share a folder', () => {
		expect(
			deriveMonsterFolders(PACK_ROOT, [
				{ file: join('beasts', 'wolf.json') },
				{ file: join('beasts', 'bear.json') },
			]),
		).toEqual(['Beasts']);
	});

	it('title-cases hyphenated and snake_case folder names', () => {
		expect(
			deriveMonsterFolders(PACK_ROOT, [
				{ file: join('great-old-ones', 'cthulhu.json') },
				{ file: join('cosmic_horrors', 'shoggoth.json') },
			]),
		).toEqual(['Great Old Ones', 'Cosmic Horrors']);
	});
});

describe('deriveBoonFolders', () => {
	it('maps the well-known boon tiers to their canonical labels', () => {
		expect(
			deriveBoonFolders([
				{ data: { system: { boonType: 'minor' } } },
				{ data: { system: { boonType: 'major' } } },
				{ data: { system: { boonType: 'epic' } } },
			]),
		).toEqual(['Minor Boons', 'Major Boons', 'Epic Boons']);
	});

	it('title-cases unrecognised boon types', () => {
		expect(deriveBoonFolders([{ data: { system: { boonType: 'legendary' } } }])).toEqual([
			'Legendary Boons',
		]);
	});

	it('normalises case and surrounding whitespace before grouping', () => {
		expect(
			deriveBoonFolders([
				{ data: { system: { boonType: '  MINOR  ' } } },
				{ data: { system: { boonType: 'Minor' } } },
			]),
		).toEqual(['Minor Boons']);
	});

	it('skips entries with no boonType', () => {
		expect(
			deriveBoonFolders([
				{ data: { system: {} } },
				{ data: { system: { boonType: '' } } },
				{ data: {} },
			]),
		).toEqual([]);
	});
});

describe('deriveSubclassFolders', () => {
	it('title-cases each unique parentClass', () => {
		expect(
			deriveSubclassFolders([
				{ data: { system: { parentClass: 'fighter' } } },
				{ data: { system: { parentClass: 'wizard' } } },
			]),
		).toEqual(['Fighter', 'Wizard']);
	});

	it('dedupes after normalising case and whitespace', () => {
		expect(
			deriveSubclassFolders([
				{ data: { system: { parentClass: '  FIGHTER  ' } } },
				{ data: { system: { parentClass: 'fighter' } } },
			]),
		).toEqual(['Fighter']);
	});

	it('ignores entries without a parentClass', () => {
		expect(
			deriveSubclassFolders([{ data: { system: {} } }, { data: { system: { parentClass: '' } } }]),
		).toEqual([]);
	});
});

describe('deriveClassFeatureFolders', () => {
	it('emits a Class and Class Progression folder for every class seen', () => {
		expect(
			deriveClassFeatureFolders(PACK_ROOT, [
				{ file: join('classes', 'fighter', 'second-wind.json'), data: {} },
			]),
		).toEqual(['Fighter', 'Fighter Progression']);
	});

	it('detects subclasses from a "*-subclasses" path segment and adds a plural folder', () => {
		const folders = deriveClassFeatureFolders(PACK_ROOT, [
			{
				file: join('classes', 'fighter', 'fighter-subclasses', 'champion', 'critical.json'),
				data: {},
			},
		]);
		expect(folders).toContain('Fighter');
		expect(folders).toContain('Fighter Progression');
		expect(folders).toContain('Fighter Subclasses');
		expect(folders).toContain('Champion');
	});

	it('detects subclasses from system.subclass when the path lacks a marker', () => {
		const folders = deriveClassFeatureFolders(PACK_ROOT, [
			{
				file: join('classes', 'wizard', 'evocation-overload.json'),
				data: { system: { subclass: 'Evoker' } },
			},
		]);
		expect(folders).toContain('Wizard Subclasses');
		expect(folders).toContain('Evoker');
	});

	it('groups features under system.group using groupLabel when present', () => {
		const folders = deriveClassFeatureFolders(PACK_ROOT, [
			{
				file: join('classes', 'wizard', 'arcane-tradition.json'),
				data: { system: { group: 'arcane-tradition', groupLabel: 'Arcane Tradition' } },
			},
		]);
		expect(folders).toContain('Arcane Tradition');
	});

	it('title-cases the group slug when no groupLabel is provided', () => {
		const folders = deriveClassFeatureFolders(PACK_ROOT, [
			{
				file: join('classes', 'wizard', 'arcane-tradition.json'),
				data: { system: { group: 'arcane-tradition' } },
			},
		]);
		expect(folders).toContain('Arcane Tradition');
	});

	it('does not emit a group folder for a "-progression" slug', () => {
		const folders = deriveClassFeatureFolders(PACK_ROOT, [
			{
				file: join('classes', 'fighter', 'level-up.json'),
				data: { system: { group: 'fighter-progression' } },
			},
		]);
		expect(folders).toEqual(['Fighter', 'Fighter Progression']);
	});

	it('falls back to system.class when the path is too shallow to derive a class id', () => {
		const folders = deriveClassFeatureFolders(PACK_ROOT, [
			{ file: join('orphan.json'), data: { system: { class: 'Sorcerer' } } },
		]);
		expect(folders).toContain('Sorcerer');
		expect(folders).toContain('Sorcerer Progression');
	});

	it('skips entries with neither a path-derived class nor system.class', () => {
		expect(
			deriveClassFeatureFolders(PACK_ROOT, [{ file: join('orphan.json'), data: {} }]),
		).toEqual([]);
	});
});

describe('deriveFoldersForPack', () => {
	it('dispatches monsters and legendaryMonsters through deriveMonsterFolders', () => {
		const sources = [{ file: join('beasts', 'wolf.json') }];
		expect(deriveFoldersForPack('monsters', PACK_ROOT, sources)).toEqual(['Beasts']);
		expect(deriveFoldersForPack('legendaryMonsters', PACK_ROOT, sources)).toEqual(['Beasts']);
	});

	it('dispatches boons, subclasses, and classFeatures to their respective derivers', () => {
		expect(
			deriveFoldersForPack('boons', PACK_ROOT, [{ data: { system: { boonType: 'minor' } } }]),
		).toEqual(['Minor Boons']);
		expect(
			deriveFoldersForPack('subclasses', PACK_ROOT, [
				{ data: { system: { parentClass: 'rogue' } } },
			]),
		).toEqual(['Rogue']);
		expect(
			deriveFoldersForPack('classFeatures', PACK_ROOT, [
				{ file: join('classes', 'rogue', 'sneak-attack.json'), data: {} },
			]),
		).toEqual(['Rogue', 'Rogue Progression']);
	});

	it('returns the empty list for pack types with no folder structure', () => {
		expect(deriveFoldersForPack('ancestries', PACK_ROOT, [])).toEqual([]);
		expect(deriveFoldersForPack('items', PACK_ROOT, [])).toEqual([]);
	});
});

describe('buildPackSkeleton', () => {
	const itemPackMeta = { name: 'nimble-items', label: 'Nimble Items', type: 'Item' };
	const monsterPackMeta = { name: 'nimble-monsters', label: 'Nimble Monsters', type: 'Actor' };
	const tablePackMeta = { name: 'nimble-tables', label: 'Nimble Tables', type: 'RollTable' };

	it('builds entries from each named source and reports them as added when none existed', () => {
		const sources = [
			{ data: { name: 'Dagger', type: 'object', system: { description: 'small blade' } } },
			{ data: { name: 'Sword', type: 'object', system: { description: 'long blade' } } },
		];
		const result = buildPackSkeleton(itemPackMeta, 'items', PACK_ROOT, sources, null);
		expect(result.skeleton.label).toBe('Nimble Items');
		expect(result.skeleton.entries).toEqual({
			Dagger: { name: 'Dagger', description: 'small blade' },
			Sword: { name: 'Sword', description: 'long blade' },
		});
		expect(result.added).toEqual(['Dagger', 'Sword']);
		expect(result.stale).toEqual([]);
		expect(result.foldersAdded).toBe(0);
		expect(result.collisions).toEqual([]);
		expect(result.skeleton.folders).toBeUndefined();
	});

	it('sorts entries and folders alphabetically (case-insensitive)', () => {
		const sources = [
			{ data: { name: 'zebra', type: 'object', system: { description: 'z' } } },
			{ data: { name: 'Apple', type: 'object', system: { description: 'a' } } },
		];
		const result = buildPackSkeleton(itemPackMeta, 'items', PACK_ROOT, sources, null);
		expect(Object.keys(result.skeleton.entries)).toEqual(['Apple', 'zebra']);
	});

	it('skips sources with no name or no extractable fields', () => {
		const sources = [
			{ data: { name: '', type: 'object', system: { description: 'x' } } },
			{ data: { name: 'Blank', type: 'object' } },
		];
		const result = buildPackSkeleton(itemPackMeta, 'items', PACK_ROOT, sources, null);
		expect(result.skeleton.entries).toEqual({ Blank: { name: 'Blank' } });
	});

	it('preserves translator edits while adding newly-discovered entries', () => {
		const existing = {
			label: 'Custom Label',
			entries: {
				Dagger: { name: 'Daga' },
			},
		};
		const sources = [
			{ data: { name: 'Dagger', type: 'object', system: { description: 'small blade' } } },
			{ data: { name: 'Sword', type: 'object', system: { description: 'long blade' } } },
		];
		const result = buildPackSkeleton(itemPackMeta, 'items', PACK_ROOT, sources, existing);
		// Existing translation is kept, new entry is added.
		expect(result.skeleton.entries.Dagger).toEqual({ name: 'Daga', description: 'small blade' });
		expect(result.skeleton.entries.Sword).toEqual({ name: 'Sword', description: 'long blade' });
		// Existing label and mapping are preserved.
		expect(result.skeleton.label).toBe('Custom Label');
		expect(result.added).toEqual(['Sword']);
	});

	it('reports — but retains — entries no longer in the source pack', () => {
		const existing = {
			entries: { OldName: { name: 'Antiguo' } },
		};
		const sources = [{ data: { name: 'NewName', type: 'object', system: { description: 'n' } } }];
		const result = buildPackSkeleton(itemPackMeta, 'items', PACK_ROOT, sources, existing);
		expect(result.stale).toEqual(['OldName']);
		expect(result.skeleton.entries.OldName).toEqual({ name: 'Antiguo' });
		expect(result.skeleton.entries.NewName).toEqual({ name: 'NewName', description: 'n' });
	});

	it('carries an existing mapping block through to the regenerated skeleton', () => {
		const existing = {
			entries: {},
			mapping: { foo: 'system.foo' },
		};
		const sources = [{ data: { name: 'X', type: 'object', system: { description: 'x' } } }];
		const result = buildPackSkeleton(itemPackMeta, 'items', PACK_ROOT, sources, existing);
		expect(result.skeleton.mapping).toEqual({ foo: 'system.foo' });
	});

	it('attaches embedded actor items keyed by item name and reports collisions', () => {
		const sources = [
			{
				file: join('humanoids', 'goblin.json'),
				data: {
					name: 'Goblin',
					type: 'npc',
					system: { description: 'mean and green' },
					items: [
						{ name: 'Bite', type: 'feature', system: { description: 'chomp' } },
						{ name: 'Bite', type: 'feature', system: { description: 'second chomp' } },
					],
				},
			},
		];
		const result = buildPackSkeleton(monsterPackMeta, 'monsters', PACK_ROOT, sources, null);
		expect(result.skeleton.entries.Goblin.items).toEqual({
			Bite: { name: 'Bite', description: 'second chomp' },
		});
		expect(result.collisions).toEqual(['Goblin → Bite']);
	});

	it('attaches RollTable results keyed by _id', () => {
		const sources = [
			{
				data: {
					name: 'Loot Table',
					description: 'roll for loot',
					results: [
						{ _id: 'r1', name: 'Coin', description: 'gold' },
						{ _id: 'r2', name: 'Gem' },
					],
				},
			},
		];
		const result = buildPackSkeleton(tablePackMeta, 'tables', PACK_ROOT, sources, null);
		expect(result.skeleton.entries['Loot Table'].results).toEqual({
			r1: { name: 'Coin', description: 'gold' },
			r2: { name: 'Gem' },
		});
	});

	it('emits folder names for derivable pack types and counts only newly added folders', () => {
		const sources = [
			{
				file: join('beasts', 'wolf.json'),
				data: {
					name: 'Wolf',
					type: 'npc',
					system: { description: 'howls' },
				},
			},
			{
				file: join('humanoids', 'orc.json'),
				data: {
					name: 'Orc',
					type: 'npc',
					system: { description: 'roars' },
				},
			},
		];
		const existing = { entries: {}, folders: { Beasts: 'Beasts' } };
		const result = buildPackSkeleton(monsterPackMeta, 'monsters', PACK_ROOT, sources, existing);
		expect(result.skeleton.folders).toEqual({ Beasts: 'Beasts', Humanoids: 'Humanoids' });
		// Beasts already existed; only Humanoids is newly added.
		expect(result.foldersAdded).toBe(1);
	});

	it('omits the folders block when the pack type has no folder structure', () => {
		const sources = [{ data: { name: 'A', type: 'object', system: { description: 'a' } } }];
		const result = buildPackSkeleton(itemPackMeta, 'items', PACK_ROOT, sources, null);
		expect(result.skeleton.folders).toBeUndefined();
	});
});
