import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
	levenshteinDistance,
	matchAllSpells,
	matchSpell,
	normalizeSpellName,
} from '../Dnd5eSpellConverter.js';

let idCounter = 0;
beforeEach(() => {
	idCounter = 0;
	vi.stubGlobal('foundry', {
		utils: { randomID: () => `mock-id-${++idCounter}` },
	});
});

// ─── levenshteinDistance ──────────────────────────────────────────────────────

describe('levenshteinDistance', () => {
	it('returns 0 for identical strings', () => {
		expect(levenshteinDistance('fireball', 'fireball')).toBe(0);
	});

	it('returns 0 for empty strings', () => {
		expect(levenshteinDistance('', '')).toBe(0);
	});

	it('returns length of other string when one is empty', () => {
		expect(levenshteinDistance('', 'abc')).toBe(3);
		expect(levenshteinDistance('abc', '')).toBe(3);
	});

	it('returns 1 for single character difference', () => {
		expect(levenshteinDistance('cat', 'bat')).toBe(1);
	});

	it('returns 1 for single character insertion', () => {
		expect(levenshteinDistance('cat', 'cats')).toBe(1);
	});

	it('returns 1 for single character deletion', () => {
		expect(levenshteinDistance('cats', 'cat')).toBe(1);
	});

	it('returns correct distance for completely different strings', () => {
		const distance = levenshteinDistance('abc', 'xyz');
		expect(distance).toBe(3);
	});

	it('handles case-sensitive comparison', () => {
		expect(levenshteinDistance('Fireball', 'fireball')).toBe(1);
	});

	it('returns correct distance for similar spell names', () => {
		const distance = levenshteinDistance('firebolt', 'firebolt');
		expect(distance).toBe(0);
	});

	it('computes distance for longer strings', () => {
		const distance = levenshteinDistance('magic missile', 'magic missle');
		expect(distance).toBe(1); // transposition: "ile" vs "le" (actually "ile" vs "le" is deletion)
	});
});

// ─── normalizeSpellName ──────────────────────────────────────────────────────

describe('normalizeSpellName', () => {
	it('converts to lowercase', () => {
		expect(normalizeSpellName('Fireball')).toBe('fireball');
	});

	it('replaces hyphens with spaces', () => {
		expect(normalizeSpellName('fire-bolt')).toBe('fire bolt');
	});

	it('replaces en-dashes and em-dashes with spaces', () => {
		expect(normalizeSpellName('fire\u2013bolt')).toBe('fire bolt');
		expect(normalizeSpellName('fire\u2014bolt')).toBe('fire bolt');
	});

	it('strips apostrophes', () => {
		expect(normalizeSpellName("Tasha's Hideous Laughter")).toBe('tashas hideous laughter');
	});

	it('strips smart quotes (apostrophes)', () => {
		expect(normalizeSpellName('Tasha\u2019s Hideous Laughter')).toBe('tashas hideous laughter');
		expect(normalizeSpellName('Tasha\u2018s Hideous Laughter')).toBe('tashas hideous laughter');
	});

	it('strips punctuation', () => {
		expect(normalizeSpellName('Cure Wounds!')).toBe('cure wounds');
	});

	it('collapses multiple spaces', () => {
		expect(normalizeSpellName('Cure    Wounds')).toBe('cure wounds');
	});

	it('trims whitespace', () => {
		expect(normalizeSpellName('  Fireball  ')).toBe('fireball');
	});

	it('handles empty string', () => {
		expect(normalizeSpellName('')).toBe('');
	});
});

// ─── matchSpell ──────────────────────────────────────────────────────────────

describe('matchSpell', () => {
	const nimbleSpells = [
		{ name: 'Fireball', uuid: 'spell-fireball' },
		{ name: 'Fire Bolt', uuid: 'spell-firebolt' },
		{ name: 'Shield', uuid: 'spell-shield' },
		{ name: 'Cure Wounds', uuid: 'spell-cure-wounds' },
		{ name: 'Magic Missile', uuid: 'spell-magic-missile' },
	];

	it('returns exact match as auto', () => {
		const result = matchSpell('Fireball', nimbleSpells);
		expect(result.flag).toBe('auto');
		expect(result.matchedNimbleName).toBe('Fireball');
		expect(result.matchedItemUuid).toBe('spell-fireball');
		expect(result.distance).toBe(0);
	});

	it('matches case-insensitively via normalization', () => {
		const result = matchSpell('fireball', nimbleSpells);
		expect(result.flag).toBe('auto');
		expect(result.matchedNimbleName).toBe('Fireball');
	});

	it('returns close match as review', () => {
		// "Sheild" is 1 edit from "Shield"
		const result = matchSpell('Sheild', nimbleSpells);
		expect(result.flag).toBe('review');
		expect(result.matchedNimbleName).toBe('Shield');
		expect(result.distance).toBeGreaterThan(0);
		expect(result.distance).toBeLessThanOrEqual(3);
	});

	it('returns skipped for no good match', () => {
		const result = matchSpell('Wish', nimbleSpells);
		expect(result.flag).toBe('skipped');
		expect(result.spellName).toBe('Wish');
	});

	it('returns skipped for empty spell name', () => {
		const result = matchSpell('', nimbleSpells);
		expect(result.flag).toBe('skipped');
	});

	it('returns skipped when spell index is empty', () => {
		const result = matchSpell('Fireball', []);
		expect(result.flag).toBe('skipped');
	});

	it('matches hyphenated spell names', () => {
		const result = matchSpell('Fire-Bolt', nimbleSpells);
		expect(result.flag).toBe('auto');
		expect(result.matchedNimbleName).toBe('Fire Bolt');
	});
});

// ─── matchAllSpells ──────────────────────────────────────────────────────────

describe('matchAllSpells', () => {
	const nimbleSpells = [
		{ name: 'Fireball', uuid: 'spell-fireball' },
		{ name: 'Shield', uuid: 'spell-shield' },
		{ name: 'Cure Wounds', uuid: 'spell-cure-wounds' },
	];

	it('matches multiple spells from spellcasting block', () => {
		const spellcasting = {
			dc: 15,
			spells: [
				{ level: 0, names: ['Fireball'] },
				{ level: 1, slots: 4, names: ['Shield', 'Cure Wounds'] },
			],
		};
		const results = matchAllSpells(spellcasting, nimbleSpells);
		expect(results).toHaveLength(3);
		expect(results[0].spellName).toBe('Fireball');
		expect(results[0].flag).toBe('auto');
		expect(results[1].spellName).toBe('Shield');
		expect(results[1].flag).toBe('auto');
		expect(results[2].spellName).toBe('Cure Wounds');
		expect(results[2].flag).toBe('auto');
	});

	it('returns empty array for undefined spellcasting', () => {
		const results = matchAllSpells(undefined, nimbleSpells);
		expect(results).toEqual([]);
	});

	it('returns empty array for spellcasting with no spells', () => {
		const spellcasting = { dc: 15, spells: [] };
		const results = matchAllSpells(spellcasting, nimbleSpells);
		expect(results).toEqual([]);
	});

	it('handles mix of matched and unmatched spells', () => {
		const spellcasting = {
			dc: 15,
			spells: [{ level: 1, slots: 2, names: ['Fireball', 'Wish', 'Shield'] }],
		};
		const results = matchAllSpells(spellcasting, nimbleSpells);
		expect(results).toHaveLength(3);

		const fireball = results.find((r) => r.spellName === 'Fireball');
		expect(fireball!.flag).toBe('auto');

		const wish = results.find((r) => r.spellName === 'Wish');
		expect(wish!.flag).toBe('skipped');

		const shield = results.find((r) => r.spellName === 'Shield');
		expect(shield!.flag).toBe('auto');
	});
});
