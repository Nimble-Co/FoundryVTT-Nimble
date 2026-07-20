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
	_stats = {},
}: {
	uuid: string;
	name: string;
	system: Record<string, unknown>;
	_stats?: Record<string, unknown>;
}) {
	return {
		uuid,
		name,
		system,
		_stats,
		toObject: () => ({
			name,
			system: foundry.utils.deepClone(system),
			_stats: { ..._stats },
		}),
		sheet: {
			render: vi.fn(),
		},
	} as unknown as Item & { uuid: string };
}

describe('CharacterCreationDialog.submitCharacterCreation saving throw resolution', () => {
	function setupActorMock() {
		const actor = {
			createEmbeddedDocuments: vi.fn().mockResolvedValue([]),
			update: vi.fn().mockResolvedValue(undefined),
		};
		(Actor as unknown as { create: ReturnType<typeof vi.fn> }).create = vi
			.fn()
			.mockResolvedValue(actor);
		return actor;
	}

	beforeEach(() => {
		vi.clearAllMocks();
		(
			foundry.applications.api.ApplicationV2.prototype as unknown as {
				close: ReturnType<typeof vi.fn>;
			}
		).close = vi.fn().mockResolvedValue(undefined);
	});

	it('neutralizes the class disadvantaged save when ancestry has a savingThrowRollMode rule targeting disadvantaged', async () => {
		const actor = setupActorMock();

		const classDocument = createItemDocument({
			uuid: 'Compendium.nimble.nimble-classes.Item.warrior',
			name: 'Warrior',
			system: {
				identifier: 'warrior',
				savingThrows: { advantage: 'strength', disadvantage: 'dexterity' },
			},
		});
		const ancestryDocument = createItemDocument({
			uuid: 'Compendium.nimble.nimble-ancestries.Item.celestial',
			name: 'Celestial',
			system: {
				rules: [
					{
						type: 'savingThrowRollMode',
						label: 'Highborn',
						value: 0,
						target: 'disadvantaged',
						mode: 'set',
					},
				],
			},
		});

		vi.stubGlobal(
			'fromUuid',
			vi.fn(async (uuid: string) => {
				if (uuid === classDocument.uuid) return classDocument;
				if (uuid === ancestryDocument.uuid) return ancestryDocument;
				return null;
			}),
		);

		const dialog = new CharacterCreationDialog();
		await dialog.submitCharacterCreation({
			name: 'Test Character',
			origins: {
				characterClass: { uuid: classDocument.uuid },
				ancestry: { uuid: ancestryDocument.uuid },
			},
			languages: [],
			classFeatures: { autoGrant: [], selected: new Map() },
			spells: { autoGrant: [], selectedSchools: new Map(), selectedSpells: new Map() },
		});

		const updateCall = actor.update.mock.calls[0][0] as {
			system: { savingThrows: Record<string, number> };
		};
		const savingThrows = updateCall.system.savingThrows;
		expect(savingThrows['dexterity.defaultRollMode']).toBe(0);
		expect(savingThrows['strength.defaultRollMode']).toBe(1);
	});

	it('uses world item rules as-is without falling back to the compendium source', async () => {
		const actor = setupActorMock();

		// World item with the rule present — should be used without any override
		const worldAncestryDocument = createItemDocument({
			uuid: 'Item.world-celestial',
			name: 'Celestial',
			system: {
				rules: [
					{
						type: 'savingThrowRollMode',
						label: 'Highborn',
						value: 0,
						target: 'disadvantaged',
						mode: 'set',
					},
				],
			},
			_stats: { compendiumSource: 'Compendium.nimble.nimble-ancestries.Item.celestial' },
		});

		const classDocument = createItemDocument({
			uuid: 'Compendium.nimble.nimble-classes.Item.warrior',
			name: 'Warrior',
			system: {
				identifier: 'warrior',
				savingThrows: { advantage: 'strength', disadvantage: 'dexterity' },
			},
		});

		vi.stubGlobal(
			'fromUuid',
			vi.fn(async (uuid: string) => {
				if (uuid === classDocument.uuid) return classDocument;
				if (uuid === worldAncestryDocument.uuid) return worldAncestryDocument;
				return null;
			}),
		);

		const dialog = new CharacterCreationDialog();
		await dialog.submitCharacterCreation({
			name: 'Test Character',
			origins: {
				characterClass: { uuid: classDocument.uuid },
				ancestry: { uuid: worldAncestryDocument.uuid },
			},
			languages: [],
			classFeatures: { autoGrant: [], selected: new Map() },
			spells: { autoGrant: [], selectedSchools: new Map(), selectedSpells: new Map() },
		});

		const updateCall = actor.update.mock.calls[0][0] as {
			system: { savingThrows: Record<string, number> };
		};
		const savingThrows = updateCall.system.savingThrows;
		// World item has the rule — disadvantage is correctly neutralised
		expect(savingThrows['dexterity.defaultRollMode']).toBe(0);
		expect(savingThrows['strength.defaultRollMode']).toBe(1);
	});

	it('preserves class disadvantaged save when ancestry has no savingThrowRollMode rule', async () => {
		const actor = setupActorMock();

		const classDocument = createItemDocument({
			uuid: 'Compendium.nimble.nimble-classes.Item.warrior',
			name: 'Warrior',
			system: {
				identifier: 'warrior',
				savingThrows: { advantage: 'strength', disadvantage: 'dexterity' },
			},
		});
		const ancestryDocument = createItemDocument({
			uuid: 'Compendium.nimble.nimble-ancestries.Item.human',
			name: 'Human',
			system: { rules: [] },
		});

		vi.stubGlobal(
			'fromUuid',
			vi.fn(async (uuid: string) => {
				if (uuid === classDocument.uuid) return classDocument;
				if (uuid === ancestryDocument.uuid) return ancestryDocument;
				return null;
			}),
		);

		const dialog = new CharacterCreationDialog();
		await dialog.submitCharacterCreation({
			name: 'Test Character',
			origins: {
				characterClass: { uuid: classDocument.uuid },
				ancestry: { uuid: ancestryDocument.uuid },
			},
			languages: [],
			classFeatures: { autoGrant: [], selected: new Map() },
			spells: { autoGrant: [], selectedSchools: new Map(), selectedSpells: new Map() },
		});

		const updateCall = actor.update.mock.calls[0][0] as {
			system: { savingThrows: Record<string, number> };
		};
		const savingThrows = updateCall.system.savingThrows;
		expect(savingThrows['dexterity.defaultRollMode']).toBe(-1);
		expect(savingThrows['strength.defaultRollMode']).toBe(1);
	});
});

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
