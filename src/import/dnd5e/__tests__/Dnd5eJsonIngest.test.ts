import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DRAGON_JSON, WOLF_JSON } from '../../../../tests/fixtures/dnd5eImporter.js';
import {
	ingestJson,
	ingestJsonString,
	parseJsonString,
	validateJsonInput,
} from '../Dnd5eJsonIngest.js';

let idCounter = 0;
beforeEach(() => {
	idCounter = 0;
	vi.stubGlobal('foundry', {
		utils: { randomID: () => `mock-id-${++idCounter}` },
	});
});

// ─── validateJsonInput ───────────────────────────────────────────────────────

describe('validateJsonInput', () => {
	it('rejects null input', () => {
		const result = validateJsonInput(null);
		expect(result.valid).toBe(false);
		if (!result.valid) expect(result.error).toMatch(/empty/i);
	});

	it('rejects undefined input', () => {
		const result = validateJsonInput(undefined);
		expect(result.valid).toBe(false);
		if (!result.valid) expect(result.error).toMatch(/empty/i);
	});

	it('rejects non-object input (string)', () => {
		const result = validateJsonInput('hello');
		expect(result.valid).toBe(false);
		if (!result.valid) expect(result.error).toMatch(/object/i);
	});

	it('rejects array input', () => {
		const result = validateJsonInput([{ name: 'Wolf' }]);
		expect(result.valid).toBe(false);
		if (!result.valid) expect(result.error).toMatch(/array/i);
	});

	it('rejects object with neither name nor system', () => {
		const result = validateJsonInput({ foo: 'bar' });
		expect(result.valid).toBe(false);
		if (!result.valid) expect(result.error).toMatch(/name.*system/i);
	});

	it('accepts object with name property', () => {
		const result = validateJsonInput({ name: 'Wolf' });
		expect(result.valid).toBe(true);
	});

	it('accepts object with system property', () => {
		const result = validateJsonInput({ system: {} });
		expect(result.valid).toBe(true);
	});

	it('accepts full WOLF_JSON fixture', () => {
		const result = validateJsonInput(WOLF_JSON);
		expect(result.valid).toBe(true);
		if (result.valid) expect(result.data).toBe(WOLF_JSON);
	});
});

// ─── parseJsonString ─────────────────────────────────────────────────────────

describe('parseJsonString', () => {
	it('returns error for empty string', () => {
		const result = parseJsonString('');
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.error).toMatch(/empty/i);
	});

	it('returns error for whitespace-only string', () => {
		const result = parseJsonString('   ');
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.error).toMatch(/empty/i);
	});

	it('returns error for invalid JSON', () => {
		const result = parseJsonString('{not json}');
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.error).toMatch(/invalid json/i);
	});

	it('parses valid single JSON object', () => {
		const result = parseJsonString('{"name":"Wolf"}');
		expect(result.ok).toBe(true);
		if (result.ok) expect(result.value).toEqual({ name: 'Wolf' });
	});

	it('parses valid JSON array', () => {
		const result = parseJsonString('[{"name":"Wolf"},{"name":"Bear"}]');
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(Array.isArray(result.value)).toBe(true);
			expect(result.value).toHaveLength(2);
		}
	});
});

// ─── ingestJson ──────────────────────────────────────────────────────────────

describe('ingestJson', () => {
	describe('basic fields', () => {
		it('extracts name from data', () => {
			const result = ingestJson(WOLF_JSON, '{}');
			expect(result.name).toBe('Wolf');
		});

		it('defaults name to Unknown Creature when missing', () => {
			const result = ingestJson({ system: {} }, '{}');
			expect(result.name).toBe('Unknown Creature');
		});

		it('extracts size from traits (med → medium)', () => {
			const result = ingestJson(WOLF_JSON, '{}');
			expect(result.size).toBe('medium');
		});

		it('extracts creature type', () => {
			const result = ingestJson(WOLF_JSON, '{}');
			expect(result.creatureType).toBe('beast');
		});

		it('extracts creature type from string field', () => {
			const data = { name: 'Test', system: { details: { type: 'fiend' } } };
			const result = ingestJson(data, '{}');
			expect(result.creatureType).toBe('fiend');
		});
	});

	describe('AC extraction', () => {
		it('extracts AC from flat field', () => {
			const result = ingestJson(WOLF_JSON, '{}');
			expect(result.ac).toBe(13);
		});

		it('extracts AC from value field when flat is absent', () => {
			const data = {
				name: 'Test',
				system: { attributes: { ac: { value: 15 } } },
			};
			const result = ingestJson(data, '{}');
			expect(result.ac).toBe(15);
		});

		it('defaults AC to 10 when missing', () => {
			const data = { name: 'Test', system: { attributes: {} } };
			const result = ingestJson(data, '{}');
			expect(result.ac).toBe(10);
		});

		it('extracts AC source from calc field', () => {
			const result = ingestJson(WOLF_JSON, '{}');
			expect(result.acSource).toBe('natural');
		});

		it('omits AC source when calc is default', () => {
			const data = {
				name: 'Test',
				system: { attributes: { ac: { flat: 10, calc: 'default' } } },
			};
			const result = ingestJson(data, '{}');
			expect(result.acSource).toBeUndefined();
		});
	});

	describe('HP extraction', () => {
		it('extracts HP from max field', () => {
			const result = ingestJson(WOLF_JSON, '{}');
			expect(result.hp).toBe(11);
		});

		it('extracts hit dice formula', () => {
			const result = ingestJson(WOLF_JSON, '{}');
			expect(result.hitDice).toBe('2d8+2');
		});

		it('defaults HP to 1 when missing', () => {
			const data = { name: 'Test', system: { attributes: {} } };
			const result = ingestJson(data, '{}');
			expect(result.hp).toBe(1);
		});
	});

	describe('movement extraction', () => {
		it('extracts walk speed in feet', () => {
			const result = ingestJson(WOLF_JSON, '{}');
			expect(result.movement.walk).toBe(40);
		});

		it('extracts multiple movement modes', () => {
			const result = ingestJson(DRAGON_JSON, '{}');
			expect(result.movement.walk).toBe(40);
			expect(result.movement.climb).toBe(40);
			expect(result.movement.fly).toBe(80);
		});

		it('defaults to walk 30 when no movement data', () => {
			const data = { name: 'Test', system: { attributes: {} } };
			const result = ingestJson(data, '{}');
			expect(result.movement).toEqual({ walk: 30 });
		});
	});

	describe('abilities', () => {
		it('extracts all six ability scores', () => {
			const result = ingestJson(WOLF_JSON, '{}');
			expect(Object.keys(result.abilities)).toHaveLength(6);
			expect(result.abilities.str).toEqual({ score: 12, mod: 1 });
			expect(result.abilities.dex).toEqual({ score: 15, mod: 2 });
			expect(result.abilities.int).toEqual({ score: 3, mod: -4 });
		});

		it('calculates mod from score when mod is missing', () => {
			const data = {
				name: 'Test',
				system: { abilities: { str: { value: 16 } } },
			};
			const result = ingestJson(data, '{}');
			expect(result.abilities.str.mod).toBe(3);
		});

		it('returns empty abilities when not present', () => {
			const data = { name: 'Test', system: {} };
			const result = ingestJson(data, '{}');
			expect(result.abilities).toEqual({});
		});
	});

	describe('save proficiencies', () => {
		it('returns empty array for wolf (no save proficiencies)', () => {
			const result = ingestJson(WOLF_JSON, '{}');
			expect(result.saveProficiencies).toEqual([]);
		});

		it('extracts proficient saves for dragon', () => {
			const result = ingestJson(DRAGON_JSON, '{}');
			expect(result.saveProficiencies).toContain('dex');
			expect(result.saveProficiencies).toContain('con');
			expect(result.saveProficiencies).toContain('wis');
			expect(result.saveProficiencies).toContain('cha');
		});
	});

	describe('damage traits', () => {
		it('extracts damage immunities', () => {
			const result = ingestJson(DRAGON_JSON, '{}');
			expect(result.damageImmunities).toContain('fire');
		});

		it('returns empty arrays for wolf (no damage traits)', () => {
			const result = ingestJson(WOLF_JSON, '{}');
			expect(result.damageResistances).toEqual([]);
			expect(result.damageImmunities).toEqual([]);
			expect(result.damageVulnerabilities).toEqual([]);
		});

		it('parses custom damage traits separated by semicolons', () => {
			const data = {
				name: 'Test',
				system: {
					traits: { dr: { value: ['fire'], custom: 'cold; lightning' } },
				},
			};
			const result = ingestJson(data, '{}');
			expect(result.damageResistances).toEqual(['fire', 'cold', 'lightning']);
		});
	});

	describe('condition immunities', () => {
		it('returns empty array when no condition immunities', () => {
			const result = ingestJson(WOLF_JSON, '{}');
			expect(result.conditionImmunities).toEqual([]);
		});

		it('extracts condition immunities from value array', () => {
			const data = {
				name: 'Test',
				system: { traits: { ci: { value: ['frightened', 'poisoned'] } } },
			};
			const result = ingestJson(data, '{}');
			expect(result.conditionImmunities).toEqual(['frightened', 'poisoned']);
		});
	});

	describe('languages', () => {
		it('returns empty array for wolf', () => {
			const result = ingestJson(WOLF_JSON, '{}');
			expect(result.languages).toEqual([]);
		});

		it('extracts languages for dragon', () => {
			const result = ingestJson(DRAGON_JSON, '{}');
			expect(result.languages).toContain('common');
			expect(result.languages).toContain('draconic');
		});
	});

	describe('senses', () => {
		it('returns empty senses for wolf', () => {
			const result = ingestJson(WOLF_JSON, '{}');
			expect(result.senses).toEqual([]);
		});

		it('extracts senses for dragon', () => {
			const result = ingestJson(DRAGON_JSON, '{}');
			expect(result.senses).toEqual(
				expect.arrayContaining([
					expect.stringContaining('blindsight'),
					expect.stringContaining('darkvision'),
				]),
			);
		});
	});

	describe('CR and XP', () => {
		it('extracts CR for wolf (0.25)', () => {
			const result = ingestJson(WOLF_JSON, '{}');
			expect(result.cr).toBe(0.25);
		});

		it('extracts CR for dragon (17)', () => {
			const result = ingestJson(DRAGON_JSON, '{}');
			expect(result.cr).toBe(17);
		});

		it('defaults CR to 0 when missing', () => {
			const data = { name: 'Test', system: {} };
			const result = ingestJson(data, '{}');
			expect(result.cr).toBe(0);
		});
	});

	describe('items as actions', () => {
		it('parses Bite as a weapon attack action', () => {
			const result = ingestJson(WOLF_JSON, '{}');
			const bite = result.actions.find((a) => a.name === 'Bite');
			expect(bite).toBeDefined();
			expect(bite!.parsed).toBeDefined();
			expect(bite!.parsed!.type).toBe('melee');
		});

		it('parses attack data from item data fields', () => {
			const result = ingestJson(WOLF_JSON, '{}');
			const bite = result.actions.find((a) => a.name === 'Bite');
			expect(bite!.parsed!.reach).toBe(5);
			expect(bite!.parsed!.damage).toHaveLength(1);
			expect(bite!.parsed!.damage[0].formula).toBe('2d4+2');
			expect(bite!.parsed!.damage[0].damageType).toBe('piercing');
		});

		it('extracts dragon Multiattack as non-weapon action', () => {
			const result = ingestJson(DRAGON_JSON, '{}');
			const multi = result.actions.find((a) => a.name === 'Multiattack');
			expect(multi).toBeDefined();
			expect(multi!.parsed).toBeUndefined();
		});

		it('extracts dragon Bite with multiple damage parts', () => {
			const result = ingestJson(DRAGON_JSON, '{}');
			const bite = result.actions.find((a) => a.name === 'Bite');
			expect(bite).toBeDefined();
			expect(bite!.parsed).toBeDefined();
			expect(bite!.parsed!.damage).toHaveLength(2);
			expect(bite!.parsed!.damage[0].damageType).toBe('piercing');
			expect(bite!.parsed!.damage[1].damageType).toBe('fire');
		});

		it('extracts legendary actions for dragon', () => {
			const result = ingestJson(DRAGON_JSON, '{}');
			expect(result.legendaryActions).toBeDefined();
			expect(result.legendaryActions!.entries.length).toBeGreaterThanOrEqual(1);
			const tailAttack = result.legendaryActions!.entries.find((e) => e.name === 'Tail Attack');
			expect(tailAttack).toBeDefined();
		});

		it('appends recharge info to action name', () => {
			const result = ingestJson(DRAGON_JSON, '{}');
			const fire = result.actions.find((a) => a.name.includes('Fire Breath'));
			expect(fire).toBeDefined();
			expect(fire!.name).toContain('Recharge');
		});
	});

	it('preserves sourceRaw', () => {
		const raw = JSON.stringify(WOLF_JSON);
		const result = ingestJson(WOLF_JSON, raw);
		expect(result.sourceRaw).toBe(raw);
	});
});

// ─── ingestJsonString ────────────────────────────────────────────────────────

describe('ingestJsonString', () => {
	it('parses a single JSON object', () => {
		const input = JSON.stringify(WOLF_JSON);
		const result = ingestJsonString(input);
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.statblocks).toHaveLength(1);
			expect(result.statblocks[0].name).toBe('Wolf');
		}
	});

	it('parses an array of JSON objects (batch)', () => {
		const input = JSON.stringify([WOLF_JSON, DRAGON_JSON]);
		const result = ingestJsonString(input);
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.statblocks).toHaveLength(2);
			expect(result.statblocks[0].name).toBe('Wolf');
			expect(result.statblocks[1].name).toBe('Adult Red Dragon');
		}
	});

	it('returns error for invalid JSON', () => {
		const result = ingestJsonString('{invalid}');
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.error).toMatch(/invalid json/i);
	});

	it('returns error for empty string', () => {
		const result = ingestJsonString('');
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.error).toMatch(/empty/i);
	});

	it('returns error when array item fails validation', () => {
		const input = JSON.stringify([WOLF_JSON, { foo: 'bar' }]);
		const result = ingestJsonString(input);
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.error).toMatch(/Item 1/);
	});
});
