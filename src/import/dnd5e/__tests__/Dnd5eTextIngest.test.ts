import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DRAGON_TEXT, WOLF_TEXT } from '../../../../tests/fixtures/dnd5eImporter.js';
import { ingestText, ingestTextBatch, splitTextBlocks } from '../Dnd5eTextIngest.js';

let idCounter = 0;
beforeEach(() => {
	idCounter = 0;
	vi.stubGlobal('foundry', {
		utils: { randomID: () => `mock-id-${++idCounter}` },
	});
});

// ─── ingestText — Wolf ───────────────────────────────────────────────────────

describe('ingestText — Wolf', () => {
	it('parses name', () => {
		const result = ingestText(WOLF_TEXT);
		expect(result.name).toBe('Wolf');
	});

	it('parses size', () => {
		const result = ingestText(WOLF_TEXT);
		expect(result.size).toBe('medium');
	});

	it('parses creature type', () => {
		const result = ingestText(WOLF_TEXT);
		expect(result.creatureType.toLowerCase()).toBe('beast');
	});

	it('parses alignment', () => {
		const result = ingestText(WOLF_TEXT);
		expect(result.alignment).toBeDefined();
		expect(result.alignment!.toLowerCase()).toContain('unaligned');
	});

	it('parses AC and source', () => {
		const result = ingestText(WOLF_TEXT);
		expect(result.ac).toBe(13);
		expect(result.acSource).toBe('natural armor');
	});

	it('parses HP and hit dice', () => {
		const result = ingestText(WOLF_TEXT);
		expect(result.hp).toBe(11);
		expect(result.hitDice).toBe('2d8 + 2');
	});

	it('parses speed', () => {
		const result = ingestText(WOLF_TEXT);
		expect(result.movement.walk).toBe(40);
	});

	it('parses ability scores', () => {
		const result = ingestText(WOLF_TEXT);
		expect(result.abilities.str).toEqual({ score: 12, mod: 1 });
		expect(result.abilities.dex).toEqual({ score: 15, mod: 2 });
		expect(result.abilities.con).toEqual({ score: 12, mod: 1 });
		expect(result.abilities.int).toEqual({ score: 3, mod: -4 });
		expect(result.abilities.wis).toEqual({ score: 12, mod: 1 });
		expect(result.abilities.cha).toEqual({ score: 6, mod: -2 });
	});

	it('parses languages (dash means none)', () => {
		const result = ingestText(WOLF_TEXT);
		expect(result.languages).toEqual([]);
	});

	it('parses senses', () => {
		const result = ingestText(WOLF_TEXT);
		expect(result.senses.length).toBeGreaterThanOrEqual(1);
		expect(result.senses.join(', ').toLowerCase()).toContain('passive perception');
	});

	it('parses challenge rating', () => {
		const result = ingestText(WOLF_TEXT);
		expect(result.cr).toBe(0.25);
	});

	it('parses XP', () => {
		const result = ingestText(WOLF_TEXT);
		expect(result.xp).toBe(50);
	});

	it('parses traits (Keen Hearing and Smell, Pack Tactics)', () => {
		const result = ingestText(WOLF_TEXT);
		const traitNames = result.traits.map((t) => t.name);
		expect(traitNames).toContain('Keen Hearing and Smell');
		expect(traitNames).toContain('Pack Tactics');
	});

	it('parses Bite as an action', () => {
		const result = ingestText(WOLF_TEXT);
		const bite = result.actions.find((a) => a.name === 'Bite');
		expect(bite).toBeDefined();
	});

	it('parses Bite attack data', () => {
		const result = ingestText(WOLF_TEXT);
		const bite = result.actions.find((a) => a.name === 'Bite');
		expect(bite!.parsed).toBeDefined();
		expect(bite!.parsed!.type).toBe('melee');
		expect(bite!.parsed!.toHit).toBe(4);
		expect(bite!.parsed!.reach).toBe(5);
		expect(bite!.parsed!.damage).toHaveLength(1);
		expect(bite!.parsed!.damage[0].formula).toBe('2d4+2');
		expect(bite!.parsed!.damage[0].damageType).toBe('piercing');
	});

	it('preserves sourceRaw', () => {
		const result = ingestText(WOLF_TEXT);
		expect(result.sourceRaw).toBe(WOLF_TEXT);
	});
});

// ─── ingestText — Dragon ─────────────────────────────────────────────────────

describe('ingestText — Dragon', () => {
	it('parses name', () => {
		const result = ingestText(DRAGON_TEXT);
		expect(result.name).toBe('Adult Red Dragon');
	});

	it('parses size (huge)', () => {
		const result = ingestText(DRAGON_TEXT);
		expect(result.size).toBe('huge');
	});

	it('parses AC', () => {
		const result = ingestText(DRAGON_TEXT);
		expect(result.ac).toBe(19);
	});

	it('parses HP', () => {
		const result = ingestText(DRAGON_TEXT);
		expect(result.hp).toBe(256);
	});

	it('parses multiple movement modes', () => {
		const result = ingestText(DRAGON_TEXT);
		expect(result.movement.walk).toBe(40);
		expect(result.movement.climb).toBe(40);
		expect(result.movement.fly).toBe(80);
	});

	it('parses saving throw proficiencies', () => {
		const result = ingestText(DRAGON_TEXT);
		expect(result.saveProficiencies).toContain('dex');
		expect(result.saveProficiencies).toContain('con');
		expect(result.saveProficiencies).toContain('wis');
		expect(result.saveProficiencies).toContain('cha');
	});

	it('parses damage immunities', () => {
		const result = ingestText(DRAGON_TEXT);
		expect(result.damageImmunities).toContain('fire');
	});

	it('parses senses (blindsight, darkvision)', () => {
		const result = ingestText(DRAGON_TEXT);
		const sensesText = result.senses.join(', ').toLowerCase();
		expect(sensesText).toContain('blindsight');
		expect(sensesText).toContain('darkvision');
	});

	it('parses languages', () => {
		const result = ingestText(DRAGON_TEXT);
		expect(result.languages).toContain('Common');
		expect(result.languages).toContain('Draconic');
	});

	it('parses challenge rating (17)', () => {
		const result = ingestText(DRAGON_TEXT);
		expect(result.cr).toBe(17);
	});

	it('parses XP (18000)', () => {
		const result = ingestText(DRAGON_TEXT);
		expect(result.xp).toBe(18000);
	});

	it('parses legendary actions', () => {
		const result = ingestText(DRAGON_TEXT);
		expect(result.legendaryActions).toBeDefined();
		expect(result.legendaryActions!.entries.length).toBeGreaterThanOrEqual(1);
	});

	it('extracts legendary preamble text', () => {
		const result = ingestText(DRAGON_TEXT);
		expect(result.legendaryActions!.preamble).toBeDefined();
		expect(result.legendaryActions!.preamble).toContain('3 legendary actions');
	});

	it('parses legendary action entries', () => {
		const result = ingestText(DRAGON_TEXT);
		const entryNames = result.legendaryActions!.entries.map((e) => e.name);
		expect(entryNames).toContain('Detect');
		expect(entryNames).toContain('Tail Attack');
	});

	it('parses Multiattack as an action', () => {
		const result = ingestText(DRAGON_TEXT);
		const multi = result.actions.find((a) => a.name === 'Multiattack');
		expect(multi).toBeDefined();
	});

	it('parses Bite attack with damage data', () => {
		const result = ingestText(DRAGON_TEXT);
		const bite = result.actions.find((a) => a.name === 'Bite');
		expect(bite).toBeDefined();
		expect(bite!.parsed).toBeDefined();
		expect(bite!.parsed!.toHit).toBe(14);
		expect(bite!.parsed!.reach).toBe(10);
	});
});

// ─── Section Parsing ─────────────────────────────────────────────────────────

describe('section parsing', () => {
	it('parses AC line', () => {
		const text = `Test Creature
Medium Beast, Neutral

Armor Class 15 (chain shirt)
Hit Points 30 (4d8 + 12)
Speed 30 ft.

STR     DEX     CON     INT     WIS     CHA
10 (+0) 10 (+0) 10 (+0) 10 (+0) 10 (+0) 10 (+0)

Challenge 1 (200 XP)`;
		const result = ingestText(text);
		expect(result.ac).toBe(15);
		expect(result.acSource).toBe('chain shirt');
	});

	it('parses HP line', () => {
		const text = `Test
Medium Beast, Neutral

Armor Class 10
Hit Points 45 (6d10 + 12)
Speed 30 ft.

STR     DEX     CON     INT     WIS     CHA
10 (+0) 10 (+0) 10 (+0) 10 (+0) 10 (+0) 10 (+0)

Challenge 1 (200 XP)`;
		const result = ingestText(text);
		expect(result.hp).toBe(45);
		expect(result.hitDice).toBe('6d10 + 12');
	});

	it('parses speed with multiple modes', () => {
		const text = `Test
Medium Beast, Neutral

Armor Class 10
Hit Points 10 (2d8)
Speed 30 ft., fly 60 ft., swim 30 ft.

STR     DEX     CON     INT     WIS     CHA
10 (+0) 10 (+0) 10 (+0) 10 (+0) 10 (+0) 10 (+0)

Challenge 1 (200 XP)`;
		const result = ingestText(text);
		expect(result.movement.walk).toBe(30);
		expect(result.movement.fly).toBe(60);
		expect(result.movement.swim).toBe(30);
	});

	it('parses ability scores from tabular layout', () => {
		const text = `Test
Medium Beast, Neutral

Armor Class 10
Hit Points 10 (2d8)
Speed 30 ft.

STR     DEX     CON     INT     WIS     CHA
20 (+5) 14 (+2) 16 (+3) 8 (-1)  12 (+1) 10 (+0)

Challenge 1 (200 XP)`;
		const result = ingestText(text);
		expect(result.abilities.str).toEqual({ score: 20, mod: 5 });
		expect(result.abilities.dex).toEqual({ score: 14, mod: 2 });
		expect(result.abilities.con).toEqual({ score: 16, mod: 3 });
		expect(result.abilities.int).toEqual({ score: 8, mod: -1 });
		expect(result.abilities.wis).toEqual({ score: 12, mod: 1 });
		expect(result.abilities.cha).toEqual({ score: 10, mod: 0 });
	});

	it('parses saving throws line', () => {
		const text = `Test
Medium Beast, Neutral

Armor Class 10
Hit Points 10 (2d8)
Speed 30 ft.

STR     DEX     CON     INT     WIS     CHA
10 (+0) 10 (+0) 10 (+0) 10 (+0) 10 (+0) 10 (+0)

Saving Throws Con +6, Wis +4
Challenge 1 (200 XP)`;
		const result = ingestText(text);
		expect(result.saveProficiencies).toContain('con');
		expect(result.saveProficiencies).toContain('wis');
	});

	it('parses damage resistances', () => {
		const text = `Test
Medium Beast, Neutral

Armor Class 10
Hit Points 10 (2d8)
Speed 30 ft.

STR     DEX     CON     INT     WIS     CHA
10 (+0) 10 (+0) 10 (+0) 10 (+0) 10 (+0) 10 (+0)

Damage Resistances cold, fire
Challenge 1 (200 XP)`;
		const result = ingestText(text);
		expect(result.damageResistances).toContain('cold');
		expect(result.damageResistances).toContain('fire');
	});

	it('parses condition immunities', () => {
		const text = `Test
Medium Beast, Neutral

Armor Class 10
Hit Points 10 (2d8)
Speed 30 ft.

STR     DEX     CON     INT     WIS     CHA
10 (+0) 10 (+0) 10 (+0) 10 (+0) 10 (+0) 10 (+0)

Condition Immunities charmed, frightened
Challenge 1 (200 XP)`;
		const result = ingestText(text);
		expect(result.conditionImmunities).toContain('charmed');
		expect(result.conditionImmunities).toContain('frightened');
	});

	it('parses senses line', () => {
		const text = `Test
Medium Beast, Neutral

Armor Class 10
Hit Points 10 (2d8)
Speed 30 ft.

STR     DEX     CON     INT     WIS     CHA
10 (+0) 10 (+0) 10 (+0) 10 (+0) 10 (+0) 10 (+0)

Senses darkvision 60 ft., passive Perception 12
Challenge 1 (200 XP)`;
		const result = ingestText(text);
		expect(result.senses.join(', ').toLowerCase()).toContain('darkvision');
	});

	it('parses languages line', () => {
		const text = `Test
Medium Beast, Neutral

Armor Class 10
Hit Points 10 (2d8)
Speed 30 ft.

STR     DEX     CON     INT     WIS     CHA
10 (+0) 10 (+0) 10 (+0) 10 (+0) 10 (+0) 10 (+0)

Languages Common, Elvish
Challenge 1 (200 XP)`;
		const result = ingestText(text);
		expect(result.languages).toContain('Common');
		expect(result.languages).toContain('Elvish');
	});

	it('parses challenge line with fractional CR', () => {
		const text = `Test
Medium Beast, Neutral

Armor Class 10
Hit Points 10 (2d8)
Speed 30 ft.

STR     DEX     CON     INT     WIS     CHA
10 (+0) 10 (+0) 10 (+0) 10 (+0) 10 (+0) 10 (+0)

Challenge 1/2 (100 XP)`;
		const result = ingestText(text);
		expect(result.cr).toBe(0.5);
		expect(result.xp).toBe(100);
	});
});

// ─── Action Parsing ──────────────────────────────────────────────────────────

describe('action parsing', () => {
	it('parses weapon attack with attack bonus and damage', () => {
		const text = `Test
Medium Beast, Neutral

Armor Class 10
Hit Points 10 (2d8)
Speed 30 ft.

STR     DEX     CON     INT     WIS     CHA
10 (+0) 10 (+0) 10 (+0) 10 (+0) 10 (+0) 10 (+0)

Challenge 1 (200 XP)

Actions
Longsword. Melee Weapon Attack: +5 to hit, reach 5 ft., one target. Hit: 8 (1d8 + 4) slashing damage.`;
		const result = ingestText(text);
		const sword = result.actions.find((a) => a.name === 'Longsword');
		expect(sword).toBeDefined();
		expect(sword!.parsed).toBeDefined();
		expect(sword!.parsed!.type).toBe('melee');
		expect(sword!.parsed!.toHit).toBe(5);
		expect(sword!.parsed!.reach).toBe(5);
		expect(sword!.parsed!.damage[0].formula).toBe('1d8+4');
		expect(sword!.parsed!.damage[0].damageType).toBe('slashing');
	});

	it('parses ranged weapon attack', () => {
		const text = `Test
Medium Beast, Neutral

Armor Class 10
Hit Points 10 (2d8)
Speed 30 ft.

STR     DEX     CON     INT     WIS     CHA
10 (+0) 10 (+0) 10 (+0) 10 (+0) 10 (+0) 10 (+0)

Challenge 1 (200 XP)

Actions
Longbow. Ranged Weapon Attack: +5 to hit, range 150/600 ft., one target. Hit: 8 (1d8 + 4) piercing damage.`;
		const result = ingestText(text);
		const bow = result.actions.find((a) => a.name === 'Longbow');
		expect(bow).toBeDefined();
		expect(bow!.parsed).toBeDefined();
		expect(bow!.parsed!.type).toBe('ranged');
		expect(bow!.parsed!.range).toBe(150);
		expect(bow!.parsed!.longRange).toBe(600);
	});
});

// ─── splitTextBlocks ─────────────────────────────────────────────────────────

describe('splitTextBlocks', () => {
	it('returns single block when no separators', () => {
		const blocks = splitTextBlocks(WOLF_TEXT);
		expect(blocks).toHaveLength(1);
		expect(blocks[0]).toContain('Wolf');
	});

	it('splits on dash separator (---)', () => {
		const combined = `${WOLF_TEXT}\n---\n${DRAGON_TEXT}`;
		const blocks = splitTextBlocks(combined);
		expect(blocks).toHaveLength(2);
		expect(blocks[0]).toContain('Wolf');
		expect(blocks[1]).toContain('Adult Red Dragon');
	});

	it('splits on multiple blank lines', () => {
		const combined = `${WOLF_TEXT}\n\n\n\n\n${DRAGON_TEXT}`;
		const blocks = splitTextBlocks(combined);
		expect(blocks).toHaveLength(2);
	});

	it('handles empty input', () => {
		const blocks = splitTextBlocks('');
		expect(blocks).toHaveLength(0);
	});
});

// ─── ingestTextBatch ─────────────────────────────────────────────────────────

describe('ingestTextBatch', () => {
	it('parses multiple statblocks separated by dashes', () => {
		const combined = `${WOLF_TEXT}\n---\n${DRAGON_TEXT}`;
		const results = ingestTextBatch(combined);
		expect(results).toHaveLength(2);
		expect(results[0].name).toBe('Wolf');
		expect(results[1].name).toBe('Adult Red Dragon');
	});

	it('parses single statblock', () => {
		const results = ingestTextBatch(WOLF_TEXT);
		expect(results).toHaveLength(1);
		expect(results[0].name).toBe('Wolf');
	});
});
