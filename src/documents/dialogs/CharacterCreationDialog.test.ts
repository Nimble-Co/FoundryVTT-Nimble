import { readFileSync } from 'node:fs';
import { join } from 'node:path';
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

	describe('background saving throw rules', () => {
		/**
		 * Drives the pack assertions from the shipped compendium data rather than a
		 * hand-copied literal, so a typo in the pack (`willpower` for `will`,
		 * `abilityCheck` for `savingThrow`, `disabled: true`) fails here instead of
		 * silently shipping a background that does nothing. Same approach as
		 * `CharacterCreationDialog.commander.test.ts`.
		 */
		const HAUNTED_PAST = JSON.parse(
			readFileSync(join(process.cwd(), 'packs/backgrounds/core/haunted-past.json'), 'utf-8'),
		) as { system: { rules: Array<Record<string, unknown>> } };

		function backgroundDocumentWith(rules: Array<Record<string, unknown>>) {
			return createItemDocument({
				uuid: 'Compendium.nimble.nimble-backgrounds.Item.test-background',
				name: 'Test Background',
				system: { rules },
			});
		}

		function warriorWithWillSave(disadvantage: string | null) {
			return createItemDocument({
				uuid: 'Compendium.nimble.nimble-classes.Item.warrior',
				name: 'Warrior',
				system: {
					identifier: 'warrior',
					savingThrows: { advantage: 'strength', disadvantage },
				},
			});
		}

		async function createWith(
			classDocument: ReturnType<typeof createItemDocument>,
			backgroundDocument: ReturnType<typeof createItemDocument>,
		) {
			vi.stubGlobal(
				'fromUuid',
				vi.fn(async (uuid: string) => {
					if (uuid === classDocument.uuid) return classDocument;
					if (uuid === backgroundDocument.uuid) return backgroundDocument;
					return null;
				}),
			);

			const dialog = new CharacterCreationDialog();
			await dialog.submitCharacterCreation({
				name: 'Test Character',
				origins: {
					characterClass: { uuid: classDocument.uuid },
					background: { uuid: backgroundDocument.uuid },
				},
				languages: [],
				classFeatures: { autoGrant: [], selected: new Map() },
				spells: { autoGrant: [], selectedSchools: new Map(), selectedSpells: new Map() },
			});
		}

		function savingThrowsFrom(actor: { update: { mock: { calls: unknown[][] } } }) {
			const updateCall = actor.update.mock.calls[0][0] as {
				system: { savingThrows: Record<string, number> };
			};
			return updateCall.system.savingThrows;
		}

		const willAdjustRule = {
			type: 'savingThrowRollMode',
			target: 'will',
			mode: 'adjust',
			value: 1,
			priority: 2,
		};

		it('grants advantage on WIL when the class leaves it neutral', async () => {
			const actor = setupActorMock();
			await createWith(warriorWithWillSave('dexterity'), backgroundDocumentWith([willAdjustRule]));

			const savingThrows = savingThrowsFrom(actor);
			expect(savingThrows['will.defaultRollMode']).toBe(1);
			expect(savingThrows['dexterity.defaultRollMode']).toBe(-1);
		});

		// Backgrounds are a separate gather slot from ancestries, and `adjust` stacks
		// onto the class default rather than replacing it: no single `set` value
		// produces both 1 (neutral class) and 0 (disadvantaged class).
		it('only neutralizes WIL when the class disadvantages it', async () => {
			const actor = setupActorMock();
			await createWith(warriorWithWillSave('will'), backgroundDocumentWith([willAdjustRule]));

			const savingThrows = savingThrowsFrom(actor);
			expect(savingThrows['will.defaultRollMode']).toBe(0);
			expect(savingThrows['strength.defaultRollMode']).toBe(1);
		});

		it('ships a situational WIL rule in the Haunted Past pack data', () => {
			expect(HAUNTED_PAST.system.rules).toContainEqual(
				expect.objectContaining({
					type: 'situationalRollMode',
					checkType: 'savingThrow',
					saves: ['will'],
					value: 1,
					disabled: false,
					label: 'Against fear',
				}),
			);
		});

		// The advantage is offered per save in the check roll dialog, so baking it
		// into the default roll mode would grant it on every WIL save.
		it('leaves the default WIL roll mode alone for a Haunted Past character', async () => {
			const actor = setupActorMock();
			await createWith(
				warriorWithWillSave('dexterity'),
				backgroundDocumentWith(HAUNTED_PAST.system.rules),
			);

			expect(savingThrowsFrom(actor)['will.defaultRollMode']).toBe(0);
		});
	});

	it('leaves the default roll modes alone for a situational savingThrowRollMode rule', async () => {
		// Survivalist's "advantage against poison saves" only applies when poison comes up,
		// so folding it into the persisted default would hand out blanket advantage.
		const actor = setupActorMock();

		const classDocument = createItemDocument({
			uuid: 'Compendium.nimble.nimble-classes.Item.warrior',
			name: 'Warrior',
			system: {
				identifier: 'warrior',
				savingThrows: { advantage: 'strength', disadvantage: 'dexterity' },
			},
		});
		const backgroundDocument = createItemDocument({
			uuid: 'Compendium.nimble.nimble-backgrounds.Item.survivalist',
			name: 'Survivalist',
			system: {
				rules: [
					{
						type: 'savingThrowRollMode',
						label: 'Survivalist',
						value: 1,
						target: 'all',
						mode: 'adjust',
						situation: 'poison',
					},
				],
			},
		});

		vi.stubGlobal(
			'fromUuid',
			vi.fn(async (uuid: string) => {
				if (uuid === classDocument.uuid) return classDocument;
				if (uuid === backgroundDocument.uuid) return backgroundDocument;
				return null;
			}),
		);

		const dialog = new CharacterCreationDialog();
		await dialog.submitCharacterCreation({
			name: 'Test Character',
			origins: {
				characterClass: { uuid: classDocument.uuid },
				background: { uuid: backgroundDocument.uuid },
			},
			languages: [],
			classFeatures: { autoGrant: [], selected: new Map() },
			spells: { autoGrant: [], selectedSchools: new Map(), selectedSpells: new Map() },
		});

		const updateCall = actor.update.mock.calls[0][0] as {
			system: { savingThrows: Record<string, number> };
		};
		const savingThrows = updateCall.system.savingThrows;
		expect(savingThrows['strength.defaultRollMode']).toBe(1);
		expect(savingThrows['dexterity.defaultRollMode']).toBe(-1);
		expect(savingThrows['intelligence.defaultRollMode']).toBe(0);
		expect(savingThrows['will.defaultRollMode']).toBe(0);
	});

	describe('ancestry bonus handling', () => {
		function createClassDocument() {
			return createItemDocument({
				uuid: 'Compendium.nimble.nimble-classes.Item.warrior',
				name: 'Warrior',
				system: {
					identifier: 'warrior',
					savingThrows: { advantage: 'strength', disadvantage: 'dexterity' },
				},
			});
		}

		function createBonusDocument(rules: Array<Record<string, unknown>>) {
			return createItemDocument({
				uuid: 'Compendium.nimble.nimble-ancestry-bonuses.Item.highborn',
				name: 'Highborn',
				system: { rules },
			});
		}

		function stubUuids(documents: Item[]) {
			const byUuid = new Map(documents.map((document) => [document.uuid, document]));
			vi.stubGlobal(
				'fromUuid',
				vi.fn(async (uuid: string) => byUuid.get(uuid) ?? null),
			);
		}

		function findSource(
			actor: { createEmbeddedDocuments: ReturnType<typeof vi.fn> },
			name: string,
		) {
			const sources = actor.createEmbeddedDocuments.mock.calls[0][1] as Array<{
				name: string;
				system: { rules?: Array<{ selectedSave?: string }> };
			}>;
			return sources.find((source) => source.name === name);
		}

		it('stamps the chosen save on a requiresChoice rule whatever its target', async () => {
			// The stage gate fires for *any* `requiresChoice` rule, so the stamp has to cover the
			// same set. Stamping only `neutral` left a homebrew rule applied at creation but
			// unresolved on the embedded item, so a later re-prepare resolved it differently.
			const actor = setupActorMock();
			const classDocument = createClassDocument();
			const ancestryDocument = createItemDocument({
				uuid: 'Compendium.nimble.nimble-ancestries.Item.celestial',
				name: 'Celestial',
				system: { rules: [] },
			});
			const bonusDocument = createBonusDocument([
				{ type: 'savingThrowRollMode', requiresChoice: true, target: 'strength', value: 1 },
				{ type: 'savingThrowRollMode', requiresChoice: true, target: 'neutral', value: 1 },
			]);

			stubUuids([classDocument, ancestryDocument, bonusDocument]);

			const dialog = new CharacterCreationDialog();
			await dialog.submitCharacterCreation({
				name: 'Test Character',
				selectedAncestrySave: 'will',
				origins: {
					characterClass: { uuid: classDocument.uuid },
					ancestry: { uuid: ancestryDocument.uuid },
					ancestryBonus: { uuid: bonusDocument.uuid },
				},
				languages: [],
				classFeatures: { autoGrant: [], selected: new Map() },
				spells: { autoGrant: [], selectedSchools: new Map(), selectedSpells: new Map() },
			});

			const bonusSource = findSource(actor, 'Highborn');
			expect(bonusSource?.system.rules?.map((rule) => rule.selectedSave)).toEqual(['will', 'will']);
		});

		describe('ancestry variant', () => {
			function createVariantAncestry(variants: string[]) {
				return createItemDocument({
					uuid: 'Compendium.nimble.nimble-ancestries.Item.dryadshroomling',
					name: 'Dryad/Shroomling',
					system: { rules: [], identifier: '', variants },
				});
			}

			function findAncestrySource(actor: { createEmbeddedDocuments: ReturnType<typeof vi.fn> }) {
				const sources = actor.createEmbeddedDocuments.mock.calls[0][1] as Array<{
					name: string;
					system: { variants?: string[]; identifier?: string };
				}>;
				return sources.find((source) => source.system.variants !== undefined);
			}

			async function submitWithVariant(
				ancestryDocument: Item & { uuid: string },
				selectedAncestryVariant: string | null,
			) {
				const actor = setupActorMock();
				const classDocument = createClassDocument();
				stubUuids([classDocument, ancestryDocument]);

				const dialog = new CharacterCreationDialog();
				await dialog.submitCharacterCreation({
					name: 'Test Character',
					selectedAncestryVariant,
					origins: {
						characterClass: { uuid: classDocument.uuid },
						ancestry: { uuid: ancestryDocument.uuid },
					},
					languages: [],
					classFeatures: { autoGrant: [], selected: new Map() },
					spells: { autoGrant: [], selectedSchools: new Map(), selectedSpells: new Map() },
				});

				return actor;
			}

			it('names the ancestry after the chosen variant', async () => {
				const actor = await submitWithVariant(
					createVariantAncestry(['Dryad', 'Shroomling']),
					'Shroomling',
				);

				expect(findAncestrySource(actor)?.name).toBe('Shroomling');
			});

			it('keeps the identifier the ancestry had before the variant renamed it', async () => {
				const actor = await submitWithVariant(
					createVariantAncestry(['Dryad', 'Shroomling']),
					'Shroomling',
				);

				expect(findAncestrySource(actor)?.system.identifier).toBe('dryad-shroomling');
			});

			it('leaves the ancestry alone when no variant was chosen', async () => {
				const actor = await submitWithVariant(createVariantAncestry(['Dryad', 'Shroomling']), null);

				const ancestrySource = findAncestrySource(actor);
				expect(ancestrySource?.name).toBe('Dryad/Shroomling');
				expect(ancestrySource?.system.identifier).toBe('');
			});

			it('names the ancestry the way the GM spelled it, not the way it was submitted', async () => {
				const actor = await submitWithVariant(
					createVariantAncestry(['Dryad', 'Shroomling']),
					'  shroomling  ',
				);

				expect(findAncestrySource(actor)?.name).toBe('Shroomling');
			});

			it('leaves the ancestry alone when the variant is already its name', async () => {
				const ancestryDocument = createItemDocument({
					uuid: 'Compendium.nimble.nimble-ancestries.Item.dryad',
					name: 'Dryad',
					system: { rules: [], identifier: '', variants: ['Dryad', 'Shroomling'] },
				});

				const actor = await submitWithVariant(ancestryDocument, 'Dryad');

				const ancestrySource = findAncestrySource(actor);
				expect(ancestrySource?.name).toBe('Dryad');
				expect(ancestrySource?.system.identifier).toBe('');
			});

			it('ignores a variant the ancestry does not offer', async () => {
				const actor = await submitWithVariant(
					createVariantAncestry(['Dryad', 'Shroomling']),
					'Oozeling',
				);

				expect(findAncestrySource(actor)?.name).toBe('Dryad/Shroomling');
			});

			it('respects an identifier the ancestry already declares', async () => {
				const ancestryDocument = createItemDocument({
					uuid: 'Compendium.nimble.nimble-ancestries.Item.dryadshroomling',
					name: 'Dryad/Shroomling',
					system: { rules: [], identifier: 'fey-kin', variants: ['Dryad', 'Shroomling'] },
				});

				const actor = await submitWithVariant(ancestryDocument, 'Dryad');

				const ancestrySource = findAncestrySource(actor);
				expect(ancestrySource?.name).toBe('Dryad');
				expect(ancestrySource?.system.identifier).toBe('fey-kin');
			});
		});

		it('tells the ancestry not to grant its default when the bonus is in the same batch', async () => {
			const actor = setupActorMock();
			const classDocument = createClassDocument();
			const ancestryDocument = createItemDocument({
				uuid: 'Compendium.nimble.nimble-ancestries.Item.celestial',
				name: 'Celestial',
				system: { rules: [], defaultBonus: 'Compendium.nimble.nimble-ancestry-bonuses.Item.other' },
			});
			const bonusDocument = createBonusDocument([]);

			stubUuids([classDocument, ancestryDocument, bonusDocument]);

			const dialog = new CharacterCreationDialog();
			await dialog.submitCharacterCreation({
				name: 'Test Character',
				origins: {
					characterClass: { uuid: classDocument.uuid },
					ancestry: { uuid: ancestryDocument.uuid },
					ancestryBonus: { uuid: bonusDocument.uuid },
				},
				languages: [],
				classFeatures: { autoGrant: [], selected: new Map() },
				spells: { autoGrant: [], selectedSchools: new Map(), selectedSpells: new Map() },
			});

			expect(actor.createEmbeddedDocuments).toHaveBeenNthCalledWith(1, 'Item', expect.any(Array), {
				nimbleAncestryBonusInBatch: true,
			});
		});
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
			// No bonus was chosen here, so the ancestry is free to grant its own default.
			{ nimbleAncestryBonusInBatch: false },
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
