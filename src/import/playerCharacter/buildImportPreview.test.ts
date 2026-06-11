import { describe, expect, it } from 'vitest';
import buildImportPreview, { type ParsedActor } from './buildImportPreview.js';

function characterExport(overrides: Partial<ParsedActor> = {}): ParsedActor {
	return {
		name: 'Thranrek',
		type: 'character',
		img: 'icons/thranrek.webp',
		system: {
			classData: { levels: ['berserker', 'berserker', 'berserker'] },
			attributes: { hp: { bonus: 2 } },
		},
		items: [
			{ name: 'Berserker', type: 'class', system: { hitDieSize: 12, hpData: [7, 8] } },
			{ name: 'Dwarf', type: 'ancestry', system: {} },
			{ name: 'Rage', type: 'feature', system: { gainedAtLevel: 1 } },
			{ name: 'Savage Arsenal', type: 'feature', system: { gainedAtLevels: [3, 7, 11] } },
			{ name: 'Greataxe', type: 'object', system: {} },
		],
		...overrides,
	};
}

describe('buildImportPreview', () => {
	it('summarizes the character headline from the export', () => {
		const preview = buildImportPreview(characterExport());

		expect(preview.name).toBe('Thranrek');
		expect(preview.img).toBe('icons/thranrek.webp');
		expect(preview.level).toBe(3);
		expect(preview.ancestry).toBe('Dwarf');
		expect(preview.className).toBe('Berserker');
		expect(preview.totalItems).toBe(5);
	});

	it('derives max HP from starting HP, per-level HP, and the flat bonus', () => {
		// d12 starting HP (20) + hpData (7 + 8) + hp.bonus (2)
		expect(buildImportPreview(characterExport()).hpMax).toBe(37);
	});

	it('returns null max HP when the export has no class items', () => {
		expect(buildImportPreview(characterExport({ items: [] })).hpMax).toBeNull();
	});

	it('groups items in display order with ancestry and class first', () => {
		const preview = buildImportPreview(characterExport());

		expect(preview.itemGroups.map((group) => group.type)).toEqual([
			'ancestry',
			'class',
			'feature',
			'object',
		]);
	});

	it('sorts unknown item types after known ones', () => {
		const preview = buildImportPreview(
			characterExport({
				items: [
					{ name: 'Mystery', type: 'mystery', system: {} },
					{ name: 'Rage', type: 'feature', system: {} },
				],
			}),
		);

		expect(preview.itemGroups.map((group) => group.type)).toEqual(['feature', 'mystery']);
	});

	it('reads the level tag from gainedAtLevel', () => {
		const preview = buildImportPreview(characterExport());
		const features = preview.itemGroups.find((group) => group.type === 'feature')!;

		expect(features.items.find((item) => item.name === 'Rage')?.level).toBe(1);
	});

	it('reads the earliest level from gainedAtLevels for multi-level features', () => {
		const preview = buildImportPreview(characterExport());
		const features = preview.itemGroups.find((group) => group.type === 'feature')!;

		expect(features.items.find((item) => item.name === 'Savage Arsenal')?.level).toBe(3);
	});

	it('falls back to localized names for unnamed characters and items', () => {
		const preview = buildImportPreview(
			characterExport({ name: '  ', items: [{ type: 'feature', system: {} }] }),
		);

		expect(preview.name).not.toBe('  ');
		expect(preview.name.length).toBeGreaterThan(0);
		expect(preview.itemGroups[0]!.items[0]!.name.length).toBeGreaterThan(0);
	});
});
