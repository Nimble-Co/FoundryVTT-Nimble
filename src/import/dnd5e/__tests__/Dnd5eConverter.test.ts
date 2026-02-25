import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createWolfStatblock } from '../../../../tests/fixtures/dnd5eImporter.js';
import {
	buildConversionReport,
	convertArmor,
	convertDamageTraits,
	convertItems,
	convertLevel,
	convertMovement,
	convertName,
	convertSavingThrows,
	convertSize,
	generateWarnings,
	toActorData,
} from '../Dnd5eConverter.js';

let idCounter = 0;
beforeEach(() => {
	idCounter = 0;
	vi.stubGlobal('foundry', {
		utils: { randomID: () => `mock-id-${++idCounter}` },
	});
});

// ─── convertName ─────────────────────────────────────────────────────────────

describe('convertName', () => {
	it('copies name directly from statblock', () => {
		const sb = createWolfStatblock();
		const result = convertName(sb);
		expect(result.value).toBe('Wolf');
		expect(result.flag).toBe('auto');
	});
});

// ─── convertSize ─────────────────────────────────────────────────────────────

describe('convertSize', () => {
	it('copies size from statblock', () => {
		const sb = createWolfStatblock();
		const result = convertSize(sb);
		expect(result.value).toBe('medium');
		expect(result.flag).toBe('auto');
	});

	it('includes source note with 5e size', () => {
		const sb = createWolfStatblock();
		const result = convertSize(sb);
		expect(result.source).toContain('medium');
	});
});

// ─── convertArmor ────────────────────────────────────────────────────────────

describe('convertArmor', () => {
	it('classifies AC <= 12 as none', () => {
		const sb = createWolfStatblock();
		sb.ac = 10;
		const result = convertArmor(sb);
		expect(result.value).toBe('none');
		expect(result.flag).toBe('review');
	});

	it('classifies AC 12 as none (boundary)', () => {
		const sb = createWolfStatblock();
		sb.ac = 12;
		const result = convertArmor(sb);
		expect(result.value).toBe('none');
	});

	it('classifies AC 13 as medium', () => {
		const sb = createWolfStatblock();
		sb.ac = 13;
		const result = convertArmor(sb);
		expect(result.value).toBe('medium');
	});

	it('classifies AC 15 as medium (boundary)', () => {
		const sb = createWolfStatblock();
		sb.ac = 15;
		const result = convertArmor(sb);
		expect(result.value).toBe('medium');
	});

	it('classifies AC 16 as heavy', () => {
		const sb = createWolfStatblock();
		sb.ac = 16;
		const result = convertArmor(sb);
		expect(result.value).toBe('heavy');
	});

	it('classifies AC 20 as heavy', () => {
		const sb = createWolfStatblock();
		sb.ac = 20;
		const result = convertArmor(sb);
		expect(result.value).toBe('heavy');
	});

	it('includes AC source in source note when present', () => {
		const sb = createWolfStatblock();
		sb.ac = 19;
		sb.acSource = 'natural armor';
		const result = convertArmor(sb);
		expect(result.source).toContain('natural armor');
	});

	it('always flags as review', () => {
		const sb = createWolfStatblock();
		const result = convertArmor(sb);
		expect(result.flag).toBe('review');
	});
});

// ─── convertLevel ────────────────────────────────────────────────────────────

describe('convertLevel', () => {
	it('maps CR 0 to level 1/4', () => {
		const sb = createWolfStatblock();
		sb.cr = 0;
		const result = convertLevel(sb);
		expect(result.value).toBe('1/4');
	});

	it('maps CR 1/8 (0.125) to level 1/4', () => {
		const sb = createWolfStatblock();
		sb.cr = 0.125;
		const result = convertLevel(sb);
		expect(result.value).toBe('1/4');
	});

	it('maps CR 1/4 (0.25) to level 1/4', () => {
		const sb = createWolfStatblock();
		sb.cr = 0.25;
		const result = convertLevel(sb);
		expect(result.value).toBe('1/4');
	});

	it('maps CR 1/2 (0.5) to level 1/2', () => {
		const sb = createWolfStatblock();
		sb.cr = 0.5;
		const result = convertLevel(sb);
		expect(result.value).toBe('1/2');
	});

	it('maps CR 1 to level 1', () => {
		const sb = createWolfStatblock();
		sb.cr = 1;
		const result = convertLevel(sb);
		expect(result.value).toBe('1');
	});

	it('maps CR 5 to level 5', () => {
		const sb = createWolfStatblock();
		sb.cr = 5;
		const result = convertLevel(sb);
		expect(result.value).toBe('5');
	});

	it('maps CR 17 to level 17', () => {
		const sb = createWolfStatblock();
		sb.cr = 17;
		const result = convertLevel(sb);
		expect(result.value).toBe('17');
	});

	it('clamps CR 30 to level 30', () => {
		const sb = createWolfStatblock();
		sb.cr = 30;
		const result = convertLevel(sb);
		expect(result.value).toBe('30');
	});

	it('always flags as review', () => {
		const sb = createWolfStatblock();
		const result = convertLevel(sb);
		expect(result.flag).toBe('review');
	});
});

// ─── convertMovement ─────────────────────────────────────────────────────────

describe('convertMovement', () => {
	it('converts feet to squares (divide by 5)', () => {
		const sb = createWolfStatblock();
		sb.movement = { walk: 30 };
		const result = convertMovement(sb);
		expect(result.value.walk).toBe(6);
	});

	it('converts walk 40 to 8 squares', () => {
		const sb = createWolfStatblock();
		const result = convertMovement(sb);
		expect(result.value.walk).toBe(8);
	});

	it('converts multiple movement modes', () => {
		const sb = createWolfStatblock();
		sb.movement = { walk: 40, fly: 80, swim: 30 };
		const result = convertMovement(sb);
		expect(result.value.walk).toBe(8);
		expect(result.value.fly).toBe(16);
		expect(result.value.swim).toBe(6);
	});

	it('rounds to nearest square', () => {
		const sb = createWolfStatblock();
		sb.movement = { walk: 7 };
		const result = convertMovement(sb);
		expect(result.value.walk).toBe(Math.round(7 / 5));
	});

	it('flags as auto', () => {
		const sb = createWolfStatblock();
		const result = convertMovement(sb);
		expect(result.flag).toBe('auto');
	});
});

// ─── convertDamageTraits ─────────────────────────────────────────────────────

describe('convertDamageTraits', () => {
	it('passes through shared damage types', () => {
		const result = convertDamageTraits(['fire', 'cold'], 'resistance');
		expect(result.value).toEqual(['fire', 'cold']);
		expect(result.flag).toBe('auto');
	});

	it('generates warning for unknown damage types', () => {
		const result = convertDamageTraits(['fire', 'adamantine'], 'resistance');
		expect(result.value).toEqual(['fire']);
		expect(result.flag).toBe('review');
		expect(result.note).toContain('adamantine');
	});

	it('handles empty array', () => {
		const result = convertDamageTraits([], 'resistance');
		expect(result.value).toEqual([]);
		expect(result.flag).toBe('auto');
	});

	it('strips qualifier parentheses for matching', () => {
		const result = convertDamageTraits(['bludgeoning (from nonmagical attacks)'], 'resistance');
		expect(result.value).toEqual(['bludgeoning']);
		expect(result.flag).toBe('auto');
	});

	it('handles all shared damage types', () => {
		const sharedTypes = [
			'acid',
			'bludgeoning',
			'cold',
			'fire',
			'force',
			'lightning',
			'necrotic',
			'piercing',
			'poison',
			'psychic',
			'radiant',
			'slashing',
			'thunder',
		];
		const result = convertDamageTraits(sharedTypes, 'immunity');
		expect(result.value).toEqual(sharedTypes);
		expect(result.flag).toBe('auto');
	});
});

// ─── convertSavingThrows ─────────────────────────────────────────────────────

describe('convertSavingThrows', () => {
	it('returns all four Nimble saves', () => {
		const sb = createWolfStatblock();
		const result = convertSavingThrows(sb);
		expect(Object.keys(result.value)).toEqual(
			expect.arrayContaining(['strength', 'dexterity', 'intelligence', 'will']),
		);
	});

	it('defaults to normal (0) for non-proficient saves', () => {
		const sb = createWolfStatblock();
		const result = convertSavingThrows(sb);
		expect(result.value.strength.defaultRollMode).toBe(0);
		expect(result.value.dexterity.defaultRollMode).toBe(0);
	});

	it('maps con proficiency to strength advantage', () => {
		const sb = createWolfStatblock();
		sb.saveProficiencies = ['con'];
		const result = convertSavingThrows(sb);
		expect(result.value.strength.defaultRollMode).toBe(1);
	});

	it('maps wis proficiency to will advantage', () => {
		const sb = createWolfStatblock();
		sb.saveProficiencies = ['wis'];
		const result = convertSavingThrows(sb);
		expect(result.value.will.defaultRollMode).toBe(1);
	});

	it('maps cha proficiency to will advantage', () => {
		const sb = createWolfStatblock();
		sb.saveProficiencies = ['cha'];
		const result = convertSavingThrows(sb);
		expect(result.value.will.defaultRollMode).toBe(1);
	});

	it('maps dex proficiency to dexterity advantage', () => {
		const sb = createWolfStatblock();
		sb.saveProficiencies = ['dex'];
		const result = convertSavingThrows(sb);
		expect(result.value.dexterity.defaultRollMode).toBe(1);
	});

	it('flags as review when proficiencies exist', () => {
		const sb = createWolfStatblock();
		sb.saveProficiencies = ['dex', 'con'];
		const result = convertSavingThrows(sb);
		expect(result.flag).toBe('review');
	});

	it('flags as auto when no proficiencies', () => {
		const sb = createWolfStatblock();
		sb.saveProficiencies = [];
		const result = convertSavingThrows(sb);
		expect(result.flag).toBe('auto');
	});

	it('does not downgrade will when both wis and cha are proficient', () => {
		const sb = createWolfStatblock();
		sb.saveProficiencies = ['wis', 'cha'];
		const result = convertSavingThrows(sb);
		expect(result.value.will.defaultRollMode).toBe(1);
	});
});

// ─── convertItems ────────────────────────────────────────────────────────────

describe('convertItems', () => {
	it('converts weapon action with parsed attack data', () => {
		const sb = createWolfStatblock();
		const { items } = convertItems(sb);
		const bite = items.find((i) => i.name === 'Bite');
		expect(bite).toBeDefined();
		expect(bite!.itemData).toBeDefined();
	});

	it('converts multiattack to attack sequence', () => {
		const sb = createWolfStatblock();
		sb.actions = [
			{
				name: 'Multiattack',
				description: 'The creature makes two attacks.',
			},
			...sb.actions,
		];
		const { items, attackSequenceId } = convertItems(sb);
		const multi = items.find((i) => i.name === 'Multiattack');
		expect(multi).toBeDefined();
		expect(multi!.flag).toBe('review');
		expect(multi!.note).toContain('attack sequence');
		expect(attackSequenceId).toBeDefined();
	});

	it('converts legendary action with (Legendary) prefix', () => {
		const sb = createWolfStatblock();
		sb.legendaryActions = {
			entries: [{ name: 'Detect', description: 'The creature makes a Perception check.' }],
		};
		const { items } = convertItems(sb);
		const legendary = items.find((i) =>
			(i.itemData as { name?: string }).name?.includes('(Legendary)'),
		);
		expect(legendary).toBeDefined();
		expect(legendary!.flag).toBe('review');
	});

	it('converts generic (non-parseable) action as fallback', () => {
		const sb = createWolfStatblock();
		sb.actions = [
			{
				name: 'Frightful Presence',
				description:
					"Each creature of the dragon's choice that is within 120 feet must make a DC 16 Wisdom saving throw.",
			},
		];
		const { items } = convertItems(sb);
		const fp = items.find((i) => i.name === 'Frightful Presence');
		expect(fp).toBeDefined();
		expect(fp!.flag).toBe('review');
		expect(fp!.note).toContain('generic action');
	});

	it('converts passive traits as features', () => {
		const sb = createWolfStatblock();
		const { items } = convertItems(sb);
		const keen = items.find((i) => i.name === 'Keen Hearing and Smell');
		expect(keen).toBeDefined();
		expect(keen!.flag).toBe('auto');
	});

	it('skips lair actions with reason', () => {
		const sb = createWolfStatblock();
		sb.lairActions = [{ name: 'Magma Eruption', description: 'Magma erupts...' }];
		const { skipped } = convertItems(sb);
		const lair = skipped.find((s) => s.name === 'Magma Eruption');
		expect(lair).toBeDefined();
		expect(lair!.reason).toContain('Lair');
	});

	it('skips spellcasting with reason', () => {
		const sb = createWolfStatblock();
		sb.spellcasting = {
			dc: 15,
			spells: [{ level: 0, names: ['Fire Bolt'] }],
		};
		const { skipped } = convertItems(sb);
		const sc = skipped.find((s) => s.name === 'Spellcasting');
		expect(sc).toBeDefined();
		expect(sc!.reason).toContain('spell matching');
	});

	it('generates item IDs using foundry.utils.randomID', () => {
		const sb = createWolfStatblock();
		const { items } = convertItems(sb);
		for (const item of items) {
			const id = (item.itemData as { _id: string })._id;
			expect(id).toMatch(/^mock-id-\d+$/);
		}
	});
});

// ─── buildConversionReport ───────────────────────────────────────────────────

describe('buildConversionReport', () => {
	it('builds a full report from Wolf statblock', () => {
		const sb = createWolfStatblock();
		const report = buildConversionReport(sb);

		expect(report.name.value).toBe('Wolf');
		expect(report.sizeCategory.value).toBe('medium');
		expect(report.creatureType.value).toBe('beast');
		expect(report.hp.value).toBe(11);
		expect(report.armor.value).toBe('medium'); // AC 13 -> medium
		expect(report.level.value).toBe('1/4'); // CR 0.25 -> 1/4
		expect(report.movement.value.walk).toBe(8); // 40ft / 5
		expect(report.cr).toBe(0.25);
		expect(report.sourceRaw).toBe('test');
	});

	it('includes items from actions and traits', () => {
		const sb = createWolfStatblock();
		const report = buildConversionReport(sb);
		expect(report.items.length).toBeGreaterThanOrEqual(1);
	});

	it('includes warnings array', () => {
		const sb = createWolfStatblock();
		const report = buildConversionReport(sb);
		expect(Array.isArray(report.warnings)).toBe(true);
	});

	it('passes spell matches through', () => {
		const sb = createWolfStatblock();
		const spellMatches = [
			{ spellName: 'Fireball', flag: 'auto' as const, matchedNimbleName: 'Fireball', distance: 0 },
		];
		const report = buildConversionReport(sb, spellMatches);
		expect(report.spellMatches).toHaveLength(1);
		expect(report.spellMatches[0].spellName).toBe('Fireball');
	});
});

// ─── generateWarnings ────────────────────────────────────────────────────────

describe('generateWarnings', () => {
	it('warns about high AC', () => {
		const sb = createWolfStatblock();
		sb.ac = 22;
		const warnings = generateWarnings(sb);
		expect(warnings.some((w) => w.includes('High AC'))).toBe(true);
	});

	it('does not warn about normal AC', () => {
		const sb = createWolfStatblock();
		sb.ac = 15;
		const warnings = generateWarnings(sb);
		expect(warnings.some((w) => w.includes('High AC'))).toBe(false);
	});

	it('warns about high CR', () => {
		const sb = createWolfStatblock();
		sb.cr = 25;
		const warnings = generateWarnings(sb);
		expect(warnings.some((w) => w.includes('High CR'))).toBe(true);
	});

	it('does not warn about low CR', () => {
		const sb = createWolfStatblock();
		sb.cr = 5;
		const warnings = generateWarnings(sb);
		expect(warnings.some((w) => w.includes('High CR'))).toBe(false);
	});

	it('warns about legendary actions', () => {
		const sb = createWolfStatblock();
		sb.legendaryActions = {
			entries: [{ name: 'Detect', description: 'Makes a check.' }],
		};
		const warnings = generateWarnings(sb);
		expect(warnings.some((w) => w.includes('Legendary'))).toBe(true);
	});

	it('warns about extensive spell lists', () => {
		const sb = createWolfStatblock();
		sb.spellcasting = {
			dc: 15,
			spells: [
				{ level: 0, names: ['Fire Bolt'] },
				{ level: 1, slots: 4, names: ['Shield'] },
				{ level: 2, slots: 3, names: ['Misty Step'] },
				{ level: 3, slots: 3, names: ['Fireball'] },
			],
		};
		const warnings = generateWarnings(sb);
		expect(warnings.some((w) => w.includes('spell list'))).toBe(true);
	});

	it('warns about exhaustion references in traits/actions', () => {
		const sb = createWolfStatblock();
		sb.traits = [
			{
				name: 'Aura of Wasting',
				description: 'Creatures near the target gain one level of exhaustion.',
			},
		];
		const warnings = generateWarnings(sb);
		expect(warnings.some((w) => w.includes('exhaustion'))).toBe(true);
	});

	it('returns empty array for clean wolf statblock', () => {
		const sb = createWolfStatblock();
		const warnings = generateWarnings(sb);
		expect(warnings).toHaveLength(0);
	});
});

// ─── toActorData ─────────────────────────────────────────────────────────────

describe('toActorData', () => {
	it('produces valid Actor.CreateData shape', () => {
		const sb = createWolfStatblock();
		const report = buildConversionReport(sb);
		const data = toActorData(report) as unknown as Record<string, unknown>;

		expect(data.name).toBe('Wolf');
		expect(data.type).toBe('npc');
		expect(data.img).toBeDefined();
	});

	it('includes system attributes', () => {
		const sb = createWolfStatblock();
		const report = buildConversionReport(sb);
		const data = toActorData(report) as unknown as Record<string, unknown>;
		const system = data.system as Record<string, unknown>;
		const attrs = system.attributes as Record<string, unknown>;

		expect(attrs.armor).toBe('medium');
		expect(attrs.sizeCategory).toBe('medium');
		expect((attrs.hp as { max: number }).max).toBe(11);
		expect(attrs.movement).toEqual({ walk: 8 });
	});

	it('includes prototypeToken data', () => {
		const sb = createWolfStatblock();
		const report = buildConversionReport(sb);
		const data = toActorData(report) as unknown as Record<string, unknown>;
		const token = data.prototypeToken as Record<string, unknown>;

		expect(token.name).toBe('Wolf');
		expect(token.disposition).toBe(-1); // HOSTILE
		expect(token.width).toBeDefined();
		expect(token.height).toBeDefined();
	});

	it('includes nimble conversion flags', () => {
		const sb = createWolfStatblock();
		const report = buildConversionReport(sb);
		const data = toActorData(report) as unknown as Record<string, unknown>;
		const flags = data.flags as { nimble: { conversion: Record<string, unknown> } };

		expect(flags.nimble.conversion.source).toBe('5e');
		expect(flags.nimble.conversion.cr).toBe(0.25);
		expect(flags.nimble.conversion.convertedAt).toBeDefined();
	});

	it('includes items array from report', () => {
		const sb = createWolfStatblock();
		const report = buildConversionReport(sb);
		const data = toActorData(report) as unknown as Record<string, unknown>;

		expect(Array.isArray(data.items)).toBe(true);
		expect((data.items as unknown[]).length).toBeGreaterThanOrEqual(1);
	});

	it('sets actorType to soloMonster for legendary creatures', () => {
		const sb = createWolfStatblock();
		sb.legendaryActions = {
			entries: [{ name: 'Detect', description: 'Makes a check.' }],
		};
		const report = buildConversionReport(sb);
		const data = toActorData(report) as unknown as Record<string, unknown>;
		expect(data.type).toBe('soloMonster');
	});

	it('lists fields needing review in conversion flags', () => {
		const sb = createWolfStatblock();
		const report = buildConversionReport(sb);
		const data = toActorData(report) as unknown as Record<string, unknown>;
		const flags = data.flags as {
			nimble: { conversion: { fieldsNeedingReview: string[] } };
		};

		expect(Array.isArray(flags.nimble.conversion.fieldsNeedingReview)).toBe(true);
		// armor and level are always flagged as review
		expect(flags.nimble.conversion.fieldsNeedingReview).toContain('armor');
		expect(flags.nimble.conversion.fieldsNeedingReview).toContain('level');
	});
});
