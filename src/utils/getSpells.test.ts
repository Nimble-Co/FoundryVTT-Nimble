import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { SpellIndex, SpellIndexEntry } from './getSpells.js';
import { buildSpellIndex } from './getSpells.js';
import { getSpellsFromIndex } from './getSpellsFromIndex.js';

interface TestSpellSource {
	uuid: string;
	name: string;
	img?: string;
	type?: string;
	system?: {
		school?: string;
		tier?: number;
		classes?: string[];
		properties?: {
			selected?: string[];
		};
	};
}

function createIndexedSpell({
	uuid,
	name,
	school = 'fire',
	tier = 0,
	isUtility = false,
	classes = [],
}: {
	uuid: string;
	name: string;
	school?: string;
	tier?: number;
	isUtility?: boolean;
	classes?: string[];
}): SpellIndexEntry {
	return {
		uuid,
		name,
		img: 'icons/svg/item-bag.svg',
		school,
		tier,
		isUtility,
		classes,
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

function createSpellSource({
	uuid,
	name,
	img = 'icons/svg/item-bag.svg',
	type = 'spell',
	system = {},
}: TestSpellSource): TestSpellSource {
	return {
		uuid,
		name,
		img,
		type,
		system,
	};
}

describe('buildSpellIndex', () => {
	beforeEach(() => {
		(game as unknown as { items: unknown; packs: unknown }).items = [];
		(game as unknown as { packs: unknown }).packs = [];
	});

	it('skips secret spells, deduplicates duplicate UUIDs, and preserves class restrictions', async () => {
		const worldSpell = createSpellSource({
			uuid: 'Compendium.nimble.nimble-spells.Item.world-duplicate',
			name: 'World Duplicate',
			system: {
				school: 'fire',
				tier: 0,
				properties: { selected: ['range'] },
			},
		});
		const worldUtilitySpell = createSpellSource({
			uuid: 'Compendium.nimble.nimble-spells.Item.utility',
			name: 'Utility Spark',
			system: {
				school: 'fire',
				tier: 0,
				properties: { selected: ['utilitySpell'] },
			},
		});
		const secretSpell = createSpellSource({
			uuid: 'Compendium.nimble.nimble-spells.Item.secret',
			name: 'Secret Spell',
			system: {
				school: 'fire',
				tier: 0,
				properties: { selected: ['secretSpell'] },
			},
		});
		const nonSpell = createSpellSource({
			uuid: 'Compendium.nimble.nimble-items.Item.not-a-spell',
			name: 'Not A Spell',
			type: 'feature',
		});

		(game as unknown as { items: TestSpellSource[] }).items = [
			worldSpell,
			worldUtilitySpell,
			secretSpell,
			nonSpell,
		];

		const packEntries = [
			createSpellSource({
				uuid: worldSpell.uuid,
				name: 'Pack Duplicate',
				system: {
					school: 'fire',
					tier: 0,
					properties: { selected: ['range'] },
				},
			}),
			createSpellSource({
				uuid: 'Compendium.nimble.nimble-spells.Item.class-spell',
				name: 'Class Bolt',
				system: {
					school: 'fire',
					tier: 0,
					classes: ['mage'],
					properties: { selected: ['range'] },
				},
			}),
			createSpellSource({
				uuid: 'Compendium.nimble.nimble-spells.Item.missing-school',
				name: 'Missing School',
				system: {
					tier: 0,
					properties: { selected: ['range'] },
				},
			}),
		];
		const itemPack = {
			documentName: 'Item',
			getIndex: vi.fn().mockResolvedValue(packEntries),
		};

		(game as unknown as { packs: unknown[] }).packs = [
			itemPack,
			{ documentName: 'JournalEntry', getIndex: vi.fn() },
		];

		const index = await buildSpellIndex();
		const fireCantrips = index.get('fire')?.get(0) ?? [];

		expect(itemPack.getIndex).toHaveBeenCalledWith({
			fields: ['system.school', 'system.tier', 'system.classes', 'system.properties.selected'],
		});
		expect(fireCantrips.map((spell) => spell.name)).toEqual([
			'Class Bolt',
			'Utility Spark',
			'World Duplicate',
		]);
		expect(fireCantrips.find((spell) => spell.uuid === worldSpell.uuid)?.name).toBe(
			'World Duplicate',
		);
		expect(fireCantrips.find((spell) => spell.uuid === worldUtilitySpell.uuid)?.isUtility).toBe(
			true,
		);
		expect(
			fireCantrips.find(
				(spell) => spell.uuid === 'Compendium.nimble.nimble-spells.Item.class-spell',
			)?.classes,
		).toEqual(['mage']);
		expect(fireCantrips.some((spell) => spell.uuid === secretSpell.uuid)).toBe(false);
	});
});

describe('getSpellsFromIndex', () => {
	it('excludes utility spells by default and filters restricted spells by class', () => {
		const index = createSpellIndex([
			createIndexedSpell({
				uuid: 'spell-open-flame',
				name: 'Open Flame',
				school: 'fire',
			}),
			createIndexedSpell({
				uuid: 'spell-mage-burst',
				name: 'Arc Burst',
				school: 'fire',
				classes: ['mage'],
			}),
			createIndexedSpell({
				uuid: 'spell-rogue-ember',
				name: 'Sneak Ember',
				school: 'fire',
				classes: ['rogue'],
			}),
			createIndexedSpell({
				uuid: 'spell-utility-light',
				name: 'Utility Light',
				school: 'fire',
				isUtility: true,
			}),
		]);

		expect(getSpellsFromIndex(index, ['fire'], [0]).map((spell) => spell.name)).toEqual([
			'Arc Burst',
			'Open Flame',
			'Sneak Ember',
		]);
		expect(
			getSpellsFromIndex(index, ['fire'], [0], { forClass: 'mage' }).map((spell) => spell.name),
		).toEqual(['Arc Burst', 'Open Flame']);
	});

	it('returns only utility spells when utilityOnly is true', () => {
		const index = createSpellIndex([
			createIndexedSpell({
				uuid: 'spell-combat',
				name: 'Battle Spark',
				school: 'fire',
			}),
			createIndexedSpell({
				uuid: 'spell-utility',
				name: 'Feather Breeze',
				school: 'fire',
				isUtility: true,
			}),
		]);

		expect(
			getSpellsFromIndex(index, ['fire'], [0], { utilityOnly: true }).map((spell) => spell.name),
		).toEqual(['Feather Breeze']);
	});
});
