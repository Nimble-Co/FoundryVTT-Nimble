import { fireEvent, render, screen } from '@testing-library/svelte';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { NimbleFeatureItem } from '#documents/item/feature.js';
import type { SpellIndex, SpellIndexEntry } from '#utils/getSpells.js';
import CharacterCreationStateHarness from '../../../../tests/harnesses/CharacterCreationStateHarness.svelte';
import getClassFeaturesFromIndex from '../../../utils/getClassFeatures.js';
import scrollIntoView from '../../../utils/scrollIntoView.js';
import { CHARACTER_CREATION_STAGES } from './constants.js';

vi.mock('../../../utils/getClassFeatures.js', () => ({
	default: vi.fn(),
}));

vi.mock('../../../utils/scrollIntoView.js', () => ({
	default: vi.fn(),
}));

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

function createClass(identifier = 'mage') {
	return {
		uuid: `Compendium.nimble.nimble-classes.Item.${identifier}`,
		system: {
			identifier,
			savingThrows: {
				advantage: 'strength',
				disadvantage: 'dexterity',
			},
		},
	} as unknown as NimbleClassItem;
}

function createAncestry() {
	return {
		uuid: 'Compendium.nimble.nimble-ancestries.Item.test-ancestry',
		system: {
			size: ['medium'],
			rules: [],
		},
	} as unknown as NimbleAncestryItem;
}

function createBackground(rules: Array<{ type: string; [key: string]: unknown }> = []) {
	return {
		uuid: 'Compendium.nimble.nimble-backgrounds.Item.test-background',
		system: {
			rules,
		},
	} as unknown as NimbleBackgroundItem;
}

function createFeature(uuid: string, rules: Array<{ type: string; [key: string]: unknown }>) {
	return {
		uuid,
		system: {
			rules,
		},
	} as unknown as NimbleFeatureItem;
}

function createClassFeaturesResult(
	autoGrant: NimbleFeatureItem[],
): Awaited<ReturnType<typeof getClassFeaturesFromIndex>> {
	return {
		autoGrant,
		selectionGroups: new Map(),
		selectionCounts: new Map(),
	};
}

function readSpellGrants() {
	return JSON.parse(screen.getByTestId('spell-grants').textContent ?? 'null') as {
		autoGrant: Array<{ uuid: string }>;
		schoolSelections: Array<Record<string, unknown>>;
		spellSelections: Array<{
			ruleId: string;
			label: string;
			count: number;
			utilityOnly: boolean;
			forClass: string;
			source: 'class' | 'background';
			availableSpells: Array<{ uuid: string }>;
		}>;
		hasGrants: boolean;
	} | null;
}

describe('createCharacterCreationState spell grants', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(getClassFeaturesFromIndex).mockResolvedValue(createClassFeaturesResult([]));
		(
			globalThis as unknown as { requestAnimationFrame: typeof requestAnimationFrame }
		).requestAnimationFrame = vi.fn((callback: FrameRequestCallback) => {
			callback(0);
			return 1;
		});
	});

	it('extracts auto grants and selection groups with utility, class, tier, and source metadata', async () => {
		const classDocument = createClass('mage');
		const ancestryDocument = createAncestry();
		const backgroundDocument = createBackground([
			{
				id: 'background-spell',
				type: 'grantSpells',
				mode: 'selectSpell',
				label: 'Choose a Utility Spell',
				schools: ['necrotic'],
				tiers: [0],
				count: 1,
				utilityOnly: true,
			},
		]);
		const spellIndex = createSpellIndex([
			createSpellEntry({
				uuid: 'Compendium.nimble.nimble-spells.Item.fire-bolt',
				name: 'Fire Bolt',
				school: 'fire',
			}),
			createSpellEntry({
				uuid: 'Compendium.nimble.nimble-spells.Item.shared-uuid',
				name: 'Specific Spell',
				school: 'lightning',
				classes: ['mage'],
			}),
			createSpellEntry({
				uuid: 'Compendium.nimble.nimble-spells.Item.wind-utility',
				name: 'Wind Utility',
				school: 'wind',
				isUtility: true,
			}),
			createSpellEntry({
				uuid: 'Compendium.nimble.nimble-spells.Item.shadow-utility',
				name: 'Shadow Utility',
				school: 'necrotic',
				isUtility: true,
			}),
			createSpellEntry({
				uuid: 'Compendium.nimble.nimble-spells.Item.rogue-shadow-utility',
				name: 'Rogue Utility',
				school: 'necrotic',
				isUtility: true,
				classes: ['rogue'],
			}),
		]);

		vi.mocked(getClassFeaturesFromIndex).mockResolvedValue(
			createClassFeaturesResult([
				createFeature('feature-auto-school', [
					{
						id: 'class-auto-school',
						type: 'grantSpells',
						mode: 'auto',
						schools: ['fire'],
						tiers: [0],
					},
				]),
				createFeature('feature-auto-uuid', [
					{
						id: 'class-auto-uuid',
						type: 'grantSpells',
						mode: 'auto',
						uuids: ['Compendium.nimble.nimble-spells.Item.shared-uuid'],
					},
				]),
				createFeature('feature-select-school', [
					{
						id: 'class-select-school',
						type: 'grantSpells',
						mode: 'selectSchool',
						label: 'Choose a Utility School',
						schools: ['wind'],
						tiers: [0],
						count: 1,
						utilityOnly: true,
					},
				]),
			]),
		);

		render(CharacterCreationStateHarness, {
			props: {
				ancestryOptions: {
					core: [ancestryDocument],
					exotic: [],
				},
				backgroundOptions: [backgroundDocument],
				classDocument,
				classOptions: [classDocument],
				backgroundDocument,
				ancestryDocument,
				spellIndex,
			},
		});

		await fireEvent.click(screen.getByRole('button', { name: 'Select Class' }));
		await fireEvent.click(screen.getByRole('button', { name: 'Select Background' }));

		await vi.waitFor(() => {
			expect(readSpellGrants()).not.toBeNull();
		});

		const spellGrants = readSpellGrants();
		expect(spellGrants?.autoGrant.map((spell) => spell.uuid)).toEqual([
			'Compendium.nimble.nimble-spells.Item.fire-bolt',
			'Compendium.nimble.nimble-spells.Item.shared-uuid',
		]);
		expect(spellGrants?.schoolSelections).toEqual([
			expect.objectContaining({
				ruleId: 'class-select-school',
				label: 'Choose a Utility School',
				availableSchools: ['wind'],
				tiers: [0],
				count: 1,
				utilityOnly: true,
				forClass: 'mage',
				source: 'class',
			}),
		]);
		expect(spellGrants?.spellSelections).toEqual([
			expect.objectContaining({
				ruleId: 'background-spell',
				label: 'Choose a Utility Spell',
				count: 1,
				utilityOnly: true,
				forClass: 'mage',
				source: 'background',
				availableSpells: [
					expect.objectContaining({
						uuid: 'Compendium.nimble.nimble-spells.Item.shadow-utility',
					}),
				],
			}),
		]);
		expect(
			spellGrants?.spellSelections[0]?.availableSpells.some(
				(spell) => spell.uuid === 'Compendium.nimble.nimble-spells.Item.rogue-shadow-utility',
			),
		).toBe(false);
	});

	it('blocks ancestry until class school selections are complete and caps the required count to available schools', async () => {
		const classDocument = createClass('mage');
		const ancestryDocument = createAncestry();
		const spellIndex = createSpellIndex([
			createSpellEntry({
				uuid: 'Compendium.nimble.nimble-spells.Item.fire-bolt',
				name: 'Fire Bolt',
				school: 'fire',
			}),
		]);

		vi.mocked(getClassFeaturesFromIndex).mockResolvedValue(
			createClassFeaturesResult([
				createFeature('feature-class-school', [
					{
						id: 'class-school-choice',
						type: 'grantSpells',
						mode: 'selectSchool',
						schools: ['fire'],
						tiers: [0],
						count: 2,
					},
				]),
			]),
		);

		render(CharacterCreationStateHarness, {
			props: {
				ancestryOptions: {
					core: [ancestryDocument],
					exotic: [],
				},
				backgroundOptions: [createBackground()],
				classDocument,
				classOptions: [classDocument],
				backgroundDocument: createBackground(),
				ancestryDocument,
				spellIndex,
			},
		});

		await fireEvent.click(screen.getByRole('button', { name: 'Select Class' }));

		await vi.waitFor(() => {
			expect(screen.getByTestId('stage')).toHaveTextContent(
				String(CHARACTER_CREATION_STAGES.SPELLS),
			);
		});

		const spellGrants = readSpellGrants();
		expect(spellGrants?.schoolSelections[0]?.count).toBe(2);

		await fireEvent.click(screen.getByRole('button', { name: 'Complete Class School Selection' }));

		await vi.waitFor(() => {
			expect(screen.getByTestId('stage')).toHaveTextContent(
				String(CHARACTER_CREATION_STAGES.ANCESTRY),
			);
		});
	});

	it('blocks starting equipment until background spell selections are complete and caps the required count to available spells', async () => {
		const classDocument = createClass('mage');
		const ancestryDocument = createAncestry();
		const backgroundDocument = createBackground([
			{
				id: 'background-spell-choice',
				type: 'grantSpells',
				mode: 'selectSpell',
				schools: ['fire'],
				tiers: [0],
				count: 2,
				utilityOnly: true,
			},
		]);
		const spellIndex = createSpellIndex([
			createSpellEntry({
				uuid: 'Compendium.nimble.nimble-spells.Item.utility-fire',
				name: 'Utility Fire',
				school: 'fire',
				isUtility: true,
			}),
		]);

		render(CharacterCreationStateHarness, {
			props: {
				ancestryOptions: {
					core: [ancestryDocument],
					exotic: [],
				},
				backgroundOptions: [backgroundDocument],
				classDocument,
				classOptions: [classDocument],
				backgroundDocument,
				ancestryDocument,
				spellIndex,
			},
		});

		await fireEvent.click(screen.getByRole('button', { name: 'Select Class' }));

		await vi.waitFor(() => {
			expect(screen.getByTestId('stage')).toHaveTextContent(
				String(CHARACTER_CREATION_STAGES.ANCESTRY),
			);
		});

		await fireEvent.click(screen.getByRole('button', { name: 'Select Ancestry' }));

		await vi.waitFor(() => {
			expect(screen.getByTestId('stage')).toHaveTextContent(
				String(CHARACTER_CREATION_STAGES.BACKGROUND),
			);
		});

		await fireEvent.click(screen.getByRole('button', { name: 'Select Background' }));

		await vi.waitFor(() => {
			expect(screen.getByTestId('stage')).toHaveTextContent(
				String(CHARACTER_CREATION_STAGES.SPELLS),
			);
		});

		await fireEvent.click(
			screen.getByRole('button', { name: 'Complete Background Spell Selection' }),
		);

		await vi.waitFor(() => {
			expect(screen.getByTestId('stage')).toHaveTextContent(
				String(CHARACTER_CREATION_STAGES.STARTING_EQUIPMENT),
			);
		});
	});

	it('scrolls background spell selections to the background spell section', async () => {
		const classDocument = createClass('mage');
		const ancestryDocument = createAncestry();
		const backgroundDocument = createBackground([
			{
				id: 'background-spell-choice',
				type: 'grantSpells',
				mode: 'selectSpell',
				schools: ['fire'],
				tiers: [0],
				count: 1,
				utilityOnly: true,
			},
		]);
		const spellIndex = createSpellIndex([
			createSpellEntry({
				uuid: 'Compendium.nimble.nimble-spells.Item.utility-fire',
				name: 'Utility Fire',
				school: 'fire',
				isUtility: true,
			}),
		]);

		render(CharacterCreationStateHarness, {
			props: {
				ancestryOptions: {
					core: [ancestryDocument],
					exotic: [],
				},
				backgroundOptions: [backgroundDocument],
				classDocument,
				classOptions: [classDocument],
				backgroundDocument,
				ancestryDocument,
				spellIndex,
			},
		});

		await fireEvent.click(screen.getByRole('button', { name: 'Select Class' }));
		await fireEvent.click(screen.getByRole('button', { name: 'Select Ancestry' }));
		await fireEvent.click(screen.getByRole('button', { name: 'Select Background' }));

		await vi.waitFor(() => {
			expect(screen.getByTestId('stage')).toHaveTextContent(
				String(CHARACTER_CREATION_STAGES.SPELLS),
			);
		});

		expect(vi.mocked(scrollIntoView)).toHaveBeenCalledWith(
			'character-creation-dialog-background-spells',
		);
	});

	it('activates the background spell section without reactivating completed class school selections', async () => {
		const classDocument = createClass('songweaver');
		const ancestryDocument = createAncestry();
		const backgroundDocument = createBackground([
			{
				id: 'academy-dropout-utility',
				type: 'grantSpells',
				mode: 'selectSpell',
				schools: ['wind'],
				tiers: [0],
				count: 1,
				utilityOnly: true,
			},
		]);
		const spellIndex = createSpellIndex([
			createSpellEntry({
				uuid: 'Compendium.nimble.nimble-spells.Item.wind-utility',
				name: 'Wind Utility',
				school: 'wind',
				isUtility: true,
			}),
		]);

		vi.mocked(getClassFeaturesFromIndex).mockResolvedValue(
			createClassFeaturesResult([
				createFeature('feature-songweaver-school', [
					{
						id: 'songweaver-school',
						type: 'grantSpells',
						mode: 'selectSchool',
						schools: ['wind'],
						tiers: [0],
						count: 1,
					},
				]),
			]),
		);

		render(CharacterCreationStateHarness, {
			props: {
				ancestryOptions: {
					core: [ancestryDocument],
					exotic: [],
				},
				backgroundOptions: [backgroundDocument],
				classDocument,
				classOptions: [classDocument],
				backgroundDocument,
				ancestryDocument,
				spellIndex,
			},
		});

		await fireEvent.click(screen.getByRole('button', { name: 'Select Class' }));

		await vi.waitFor(() => {
			expect(screen.getByTestId('active-spell-selection-source')).toHaveTextContent('class');
		});

		await fireEvent.click(screen.getByRole('button', { name: 'Complete Class School Selection' }));

		await vi.waitFor(() => {
			expect(screen.getByTestId('stage')).toHaveTextContent(
				String(CHARACTER_CREATION_STAGES.ANCESTRY),
			);
			expect(screen.getByTestId('active-spell-selection-source')).toHaveTextContent('null');
		});

		await fireEvent.click(screen.getByRole('button', { name: 'Select Ancestry' }));
		await fireEvent.click(screen.getByRole('button', { name: 'Select Background' }));

		await vi.waitFor(() => {
			expect(screen.getByTestId('stage')).toHaveTextContent(
				String(CHARACTER_CREATION_STAGES.SPELLS),
			);
			expect(screen.getByTestId('active-spell-selection-source')).toHaveTextContent('background');
		});

		expect(screen.getByTestId('selected-schools')).toHaveTextContent(
			'[["songweaver-school",["wind"]]]',
		);
		expect(screen.getByTestId('confirmed-schools')).toHaveTextContent('["songweaver-school"]');

		await fireEvent.click(
			screen.getByRole('button', { name: 'Complete Background Spell Selection' }),
		);

		await vi.waitFor(() => {
			expect(screen.getByTestId('stage')).toHaveTextContent(
				String(CHARACTER_CREATION_STAGES.STARTING_EQUIPMENT),
			);
			expect(screen.getByTestId('active-spell-selection-source')).toHaveTextContent('null');
		});

		expect(screen.getByTestId('selected-schools')).toHaveTextContent(
			'[["songweaver-school",["wind"]]]',
		);
		expect(screen.getByTestId('confirmed-schools')).toHaveTextContent('["songweaver-school"]');
		expect(screen.getByTestId('selected-spells')).toHaveTextContent(
			'[["academy-dropout-utility",["Compendium.nimble.nimble-spells.Item.wind-utility"]]]',
		);
	});

	it('only clears background-owned spell selections when the background changes', async () => {
		const classDocument = createClass('mage');
		const ancestryDocument = createAncestry();
		const academyDropout = createBackground([
			{
				id: 'academy-school',
				type: 'grantSpells',
				mode: 'selectSchool',
				schools: ['wind'],
				tiers: [0],
				count: 1,
			},
			{
				id: 'academy-utility',
				type: 'grantSpells',
				mode: 'selectSpell',
				schools: ['wind'],
				tiers: [0],
				count: 1,
				utilityOnly: true,
			},
		]);
		const otherBackground = createBackground();
		const spellIndex = createSpellIndex([
			createSpellEntry({
				uuid: 'Compendium.nimble.nimble-spells.Item.wind-utility',
				name: 'Wind Utility',
				school: 'wind',
				isUtility: true,
			}),
		]);

		vi.mocked(getClassFeaturesFromIndex).mockResolvedValue(
			createClassFeaturesResult([
				createFeature('feature-class-school', [
					{
						id: 'class-school',
						type: 'grantSpells',
						mode: 'selectSchool',
						schools: ['fire'],
						tiers: [0],
						count: 1,
					},
				]),
			]),
		);

		render(CharacterCreationStateHarness, {
			props: {
				ancestryOptions: {
					core: [ancestryDocument],
					exotic: [],
				},
				backgroundOptions: [academyDropout, otherBackground],
				classDocument,
				classOptions: [classDocument],
				backgroundDocument: academyDropout,
				alternateBackgroundDocument: otherBackground,
				ancestryDocument,
				spellIndex,
			},
		});

		await fireEvent.click(screen.getByRole('button', { name: 'Select Class' }));
		await fireEvent.click(screen.getByRole('button', { name: 'Complete Class School Selection' }));
		await fireEvent.click(screen.getByRole('button', { name: 'Select Ancestry' }));
		await fireEvent.click(screen.getByRole('button', { name: 'Select Background' }));
		await fireEvent.click(
			screen.getByRole('button', { name: 'Complete Background School Selection' }),
		);
		await fireEvent.click(
			screen.getByRole('button', { name: 'Complete Background Spell Selection' }),
		);

		await vi.waitFor(() => {
			expect(screen.getByTestId('selected-schools')).toHaveTextContent(
				'[["class-school",["fire"]],["academy-school",["wind"]]]',
			);
			expect(screen.getByTestId('confirmed-schools')).toHaveTextContent(
				'["class-school","academy-school"]',
			);
			expect(screen.getByTestId('selected-spells')).toHaveTextContent(
				'[["academy-utility",["Compendium.nimble.nimble-spells.Item.wind-utility"]]]',
			);
		});

		await fireEvent.click(screen.getByRole('button', { name: 'Select Alternate Background' }));

		await vi.waitFor(() => {
			expect(screen.getByTestId('selected-schools')).toHaveTextContent(
				'[["class-school",["fire"]]]',
			);
			expect(screen.getByTestId('confirmed-schools')).toHaveTextContent('["class-school"]');
			expect(screen.getByTestId('selected-spells')).toHaveTextContent('[]');
		});
	});
});
