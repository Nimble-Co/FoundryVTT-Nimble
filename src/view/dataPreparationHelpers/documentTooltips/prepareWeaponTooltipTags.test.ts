import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import prepareWeaponTooltipTags from './prepareWeaponTooltipTags.js';

beforeAll(() => {
	// The shared Foundry mock does not carry `isEmpty`, which this helper guards with.
	const utils = (globalThis as { foundry: { utils: Record<string, unknown> } }).foundry.utils;
	utils.isEmpty ??= (value: object) => Object.keys(value ?? {}).length === 0;
});

function loadWeapon(fileName: string) {
	const path = join(process.cwd(), 'packs/items/core/weapons', `${fileName}.json`);
	return JSON.parse(readFileSync(path, 'utf-8'));
}

function tagsFor(fileName: string): string {
	return prepareWeaponTooltipTags(loadWeapon(fileName)) ?? '';
}

describe('the shipped strength requirements', () => {
	// `overridesTwoHanded` means the requirement buys one-handed use. The
	// Longsword is the only core weapon that reads that way in the book.
	it.each([
		['longsword', 2, true],
		['greatmaul', 2, false],
		['greataxe', 2, false],
		['greatsword', 2, false],
		['handheld-ballista', 2, false],
		['longbow', 1, false],
	])('%s requires %i strength, override %s', (fileName, value, overridesTwoHanded) => {
		const { strengthRequirement } = loadWeapon(fileName).system.properties;

		expect(strengthRequirement.value).toBe(value);
		expect(strengthRequirement.overridesTwoHanded).toBe(overridesTwoHanded);
	});
});

describe('prepareWeaponTooltipTags', () => {
	it('reads the Longsword as the book does', () => {
		expect(tagsFor('longsword')).toContain('2-Handed (1-handed: Requires Strength 2)');
	});

	it('keeps a great weapon two-handed and required', () => {
		const tags = tagsFor('greatsword');

		expect(tags).toContain('2-Handed');
		expect(tags).toContain('Requires Strength 2');
		expect(tags).not.toContain('1-handed');
	});

	it('never phrases a requirement as an alternative to two hands', () => {
		for (const fileName of ['longsword', 'greatmaul', 'greataxe', 'greatsword', 'longbow']) {
			expect(tagsFor(fileName)).not.toContain('or 2-Handed');
		}
	});

	it('shows two-handed alone when no strength is required', () => {
		const tags = tagsFor('battleaxe');

		expect(tags).toContain('2-Handed');
		expect(tags).not.toContain('Requires Strength');
	});
});
