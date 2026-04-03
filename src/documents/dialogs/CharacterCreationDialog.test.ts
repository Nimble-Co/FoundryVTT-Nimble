import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { SpellIndex, SpellIndexEntry } from '#utils/getSpells.js';
import CharacterCreationDialog from './CharacterCreationDialog.svelte.js';

function createSpellEntry({
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

function createItemDocument({
	uuid,
	name,
	system,
}: {
	uuid: string;
	name: string;
	system: Record<string, unknown>;
}) {
	return {
		uuid,
		name,
		system,
		toObject: () => ({
			name,
			system: foundry.utils.deepClone(system),
			_stats: {},
		}),
		sheet: {
			render: vi.fn(),
		},
	} as unknown as Item;
}

describe('CharacterCreationDialog.submitCharacterCreation spell grants', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		(
			foundry.applications.api.ApplicationV2.prototype as unknown as {
				close: ReturnType<typeof vi.fn>;
			}
		).close = vi.fn().mockResolvedValue(undefined);
	});

	it('creates unique spells from auto grants, school selections, and direct selections using the stored selection options', async () => {
		const actor = {
			createEmbeddedDocuments: vi.fn().mockResolvedValue([]),
			update: vi.fn().mockResolvedValue(undefined),
		};
		(Actor as unknown as { create: ReturnType<typeof vi.fn> }).create = vi
			.fn()
			.mockResolvedValue(actor);

		const classDocument = createItemDocument({
			uuid: 'Compendium.nimble.nimble-classes.Item.mage',
			name: 'Mage',
			system: {
				identifier: 'mage',
				savingThrows: {
					advantage: 'strength',
					disadvantage: 'dexterity',
				},
			},
		});
		const sharedSpell = createItemDocument({
			uuid: 'Compendium.nimble.nimble-spells.Item.shared-utility',
			name: 'Shared Utility',
			system: {
				school: 'fire',
				tier: 0,
				classes: [],
				properties: { selected: ['utilitySpell'] },
			},
		});
		const schoolOnlySpell = createItemDocument({
			uuid: 'Compendium.nimble.nimble-spells.Item.school-only-utility',
			name: 'School Only Utility',
			system: {
				school: 'fire',
				tier: 0,
				classes: [],
				properties: { selected: ['utilitySpell'] },
			},
		});
		const directOnlySpell = createItemDocument({
			uuid: 'Compendium.nimble.nimble-spells.Item.direct-only',
			name: 'Direct Only',
			system: {
				school: 'wind',
				tier: 0,
				classes: [],
				properties: { selected: ['utilitySpell'] },
			},
		});

		const documentByUuid = new Map<string, Item>([
			[classDocument.uuid, classDocument],
			[sharedSpell.uuid, sharedSpell],
			[schoolOnlySpell.uuid, schoolOnlySpell],
			[directOnlySpell.uuid, directOnlySpell],
		]);
		vi.stubGlobal(
			'fromUuid',
			vi.fn(async (uuid: string) => documentByUuid.get(uuid as string) ?? null),
		);

		const dialog = new CharacterCreationDialog();
		dialog.spellIndex = Promise.resolve(
			createSpellIndex([
				createSpellEntry({
					uuid: sharedSpell.uuid,
					name: 'Shared Utility',
					school: 'fire',
					isUtility: true,
				}),
				createSpellEntry({
					uuid: schoolOnlySpell.uuid,
					name: 'School Only Utility',
					school: 'fire',
					isUtility: true,
				}),
				createSpellEntry({
					uuid: 'Compendium.nimble.nimble-spells.Item.non-utility-fire',
					name: 'Combat Fire',
					school: 'fire',
				}),
				createSpellEntry({
					uuid: 'Compendium.nimble.nimble-spells.Item.rogue-utility-fire',
					name: 'Rogue Utility Fire',
					school: 'fire',
					isUtility: true,
					classes: ['rogue'],
				}),
			]),
		);

		await dialog.submitCharacterCreation({
			name: 'New Character',
			origins: {
				characterClass: { uuid: classDocument.uuid },
			},
			languages: ['common'],
			classFeatures: {
				autoGrant: [],
				selected: new Map(),
			},
			spells: {
				autoGrant: [sharedSpell.uuid],
				selectedSchools: new Map([['background-school-choice', ['fire']]]),
				selectedSpells: new Map([
					['background-direct-choice', [sharedSpell.uuid, directOnlySpell.uuid]],
				]),
				selectionOptions: new Map([
					[
						'background-school-choice',
						{
							utilityOnly: true,
							forClass: 'mage',
							tiers: [0],
						},
					],
				]),
			},
		});

		expect(actor.createEmbeddedDocuments).toHaveBeenCalledTimes(2);
		expect(actor.createEmbeddedDocuments).toHaveBeenNthCalledWith(
			1,
			'Item',
			expect.arrayContaining([
				expect.objectContaining({
					_stats: expect.objectContaining({
						compendiumSource: classDocument.uuid,
					}),
				}),
			]),
		);

		const spellSources = actor.createEmbeddedDocuments.mock.calls[1][1] as Array<{
			_stats: { compendiumSource: string };
		}>;
		expect(spellSources.map((source) => source._stats.compendiumSource).sort()).toEqual([
			directOnlySpell.uuid,
			schoolOnlySpell.uuid,
			sharedSpell.uuid,
		]);
		expect(
			spellSources.filter((source) => source._stats.compendiumSource === sharedSpell.uuid),
		).toHaveLength(1);
		expect(
			spellSources.some(
				(source) =>
					source._stats.compendiumSource ===
					'Compendium.nimble.nimble-spells.Item.non-utility-fire',
			),
		).toBe(false);
		expect(
			spellSources.some(
				(source) =>
					source._stats.compendiumSource ===
					'Compendium.nimble.nimble-spells.Item.rogue-utility-fire',
			),
		).toBe(false);
		expect(actor.update).toHaveBeenCalled();
	});
});
