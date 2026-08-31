import { fireEvent, render, screen } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest';

import type { NimbleFeatureItem } from '#documents/item/feature.js';
import type { SpellIndex, SpellIndexEntry } from '#utils/getSpells.js';
import CharacterCreationStateHarness from '../../../../tests/harnesses/CharacterCreationStateHarness.svelte';
import getClassFeaturesFromIndex from '../../../utils/getClassFeatures.js';
import scrollIntoView from '../../../utils/scrollIntoView.js';
import { CHARACTER_CREATION_STAGES } from './constants.js';
import type { CharacterCreationResults } from './types.js';

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
		optionFeatures: [],
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

type GlobalWithFromUuid = { fromUuid: unknown };

describe('createCharacterCreationState ancestry bonus stage', () => {
	let originalFromUuid: unknown;

	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(getClassFeaturesFromIndex).mockResolvedValue(createClassFeaturesResult([]));
		(
			globalThis as unknown as { requestAnimationFrame: typeof requestAnimationFrame }
		).requestAnimationFrame = vi.fn((callback: FrameRequestCallback) => {
			callback(0);
			return 1;
		});
		originalFromUuid = (globalThis as unknown as GlobalWithFromUuid).fromUuid;
	});

	afterEach(() => {
		(globalThis as unknown as GlobalWithFromUuid).fromUuid = originalFromUuid;
	});

	function createAncestryWithDefaultBonus(defaultBonus: string) {
		return {
			uuid: 'Compendium.nimble.nimble-ancestries.Item.test-ancestry',
			system: {
				size: ['medium'],
				rules: [],
				defaultBonus,
			},
		} as unknown as NimbleAncestryItem;
	}

	function renderWithAncestry(
		classDocument: NimbleClassItem,
		ancestryDocument: NimbleAncestryItem,
		alternateAncestryDocument: NimbleAncestryItem | null = null,
		alternateAncestryBonus: NimbleAncestryBonusItem | null = null,
		ancestryBonusOptions: NimbleAncestryBonusItem[] | undefined = undefined,
	) {
		render(CharacterCreationStateHarness, {
			props: {
				ancestryOptions: {
					core: alternateAncestryDocument
						? [ancestryDocument, alternateAncestryDocument]
						: [ancestryDocument],
					exotic: [],
				},
				...(ancestryBonusOptions ? { ancestryBonusOptions } : {}),
				backgroundOptions: [createBackground()],
				classDocument,
				classOptions: [classDocument],
				backgroundDocument: createBackground(),
				ancestryDocument,
				alternateAncestryDocument,
				alternateAncestryBonus,
				spellIndex: createSpellIndex([]),
			},
		});
	}

	it('gates on ANCESTRY_BONUS until the auto-defaulted bonus is confirmed', async () => {
		const bonusUuid = 'Compendium.nimble.nimble-ancestry-bonuses.Item.test-bonus';
		(globalThis as unknown as GlobalWithFromUuid).fromUuid = vi
			.fn()
			.mockResolvedValue({ uuid: bonusUuid, system: { rules: [] } });

		renderWithAncestry(createClass('mage'), createAncestryWithDefaultBonus(bonusUuid));

		await fireEvent.click(screen.getByRole('button', { name: 'Select Class' }));
		await fireEvent.click(screen.getByRole('button', { name: 'Select Ancestry' }));

		// The ancestry's default bonus auto-resolves but stays unconfirmed, holding the bonus stage.
		await vi.waitFor(() => {
			expect(screen.getByTestId('selected-ancestry-bonus')).toHaveTextContent(bonusUuid);
			expect(screen.getByTestId('ancestry-bonus-confirmed')).toHaveTextContent('false');
			expect(screen.getByTestId('stage')).toHaveTextContent(
				String(CHARACTER_CREATION_STAGES.ANCESTRY_BONUS),
			);
		});

		await fireEvent.click(screen.getByRole('button', { name: 'Confirm Ancestry Bonus' }));

		// Confirming releases the gate; single size + no save choice advances straight to background.
		await vi.waitFor(() => {
			expect(screen.getByTestId('ancestry-bonus-confirmed')).toHaveTextContent('true');
			expect(screen.getByTestId('stage')).toHaveTextContent(
				String(CHARACTER_CREATION_STAGES.BACKGROUND),
			);
		});
	});

	it('keeps the ancestry options out of the way until the bonus is confirmed', async () => {
		const bonusUuid = 'Compendium.nimble.nimble-ancestry-bonuses.Item.test-bonus';
		(globalThis as unknown as GlobalWithFromUuid).fromUuid = vi
			.fn()
			.mockResolvedValue({ uuid: bonusUuid, system: { rules: [] } });

		renderWithAncestry(createClass('mage'), createAncestryWithDefaultBonus(bonusUuid));

		await fireEvent.click(screen.getByRole('button', { name: 'Select Class' }));
		await fireEvent.click(screen.getByRole('button', { name: 'Select Ancestry' }));

		await vi.waitFor(() => {
			expect(screen.getByTestId('ancestry-options-available')).toHaveTextContent('false');
		});

		await fireEvent.click(screen.getByRole('button', { name: 'Confirm Ancestry Bonus' }));

		await vi.waitFor(() => {
			expect(screen.getByTestId('ancestry-options-available')).toHaveTextContent('true');
		});
	});

	it('skips ANCESTRY_BONUS when no bonuses are available at all', async () => {
		// The bonus pack is missing or disabled, so the default resolves to nothing and there is
		// nothing to pick. Gating here would dead-end the wizard: no way to complete a character.
		(globalThis as unknown as GlobalWithFromUuid).fromUuid = vi.fn().mockResolvedValue(null);

		renderWithAncestry(
			createClass('mage'),
			createAncestryWithDefaultBonus('Compendium.nimble.nimble-ancestry-bonuses.Item.test-bonus'),
			null,
			null,
			[],
		);

		await fireEvent.click(screen.getByRole('button', { name: 'Select Class' }));
		await fireEvent.click(screen.getByRole('button', { name: 'Select Ancestry' }));

		await vi.waitFor(() => {
			expect(screen.getByTestId('stage')).toHaveTextContent(
				String(CHARACTER_CREATION_STAGES.BACKGROUND),
			);
		});
	});

	it('skips ANCESTRY_BONUS when the ancestry has no default bonus', async () => {
		renderWithAncestry(createClass('mage'), createAncestry());

		await fireEvent.click(screen.getByRole('button', { name: 'Select Class' }));
		await fireEvent.click(screen.getByRole('button', { name: 'Select Ancestry' }));

		await vi.waitFor(() => {
			expect(screen.getByTestId('selected-ancestry-bonus')).toHaveTextContent('null');
			expect(screen.getByTestId('stage')).toHaveTextContent(
				String(CHARACTER_CREATION_STAGES.BACKGROUND),
			);
		});
	});

	it('re-opens ANCESTRY_BONUS when a confirmed bonus is cleared', async () => {
		const bonusUuid = 'Compendium.nimble.nimble-ancestry-bonuses.Item.test-bonus';
		(globalThis as unknown as GlobalWithFromUuid).fromUuid = vi
			.fn()
			.mockResolvedValue({ uuid: bonusUuid, system: { rules: [] } });

		renderWithAncestry(createClass('mage'), createAncestryWithDefaultBonus(bonusUuid));

		await fireEvent.click(screen.getByRole('button', { name: 'Select Class' }));
		await fireEvent.click(screen.getByRole('button', { name: 'Select Ancestry' }));
		await fireEvent.click(screen.getByRole('button', { name: 'Confirm Ancestry Bonus' }));

		await vi.waitFor(() => {
			expect(screen.getByTestId('stage')).toHaveTextContent(
				String(CHARACTER_CREATION_STAGES.BACKGROUND),
			);
		});

		await fireEvent.click(screen.getByRole('button', { name: 'Clear Ancestry Bonus' }));

		await vi.waitFor(() => {
			expect(screen.getByTestId('selected-ancestry-bonus')).toHaveTextContent('null');
			expect(screen.getByTestId('stage')).toHaveTextContent(
				String(CHARACTER_CREATION_STAGES.ANCESTRY_BONUS),
			);
		});
	});

	it('re-defaults the bonus and drops the confirmation when the ancestry changes', async () => {
		const firstBonus = 'Compendium.nimble.nimble-ancestry-bonuses.Item.first-bonus';
		const secondBonus = 'Compendium.nimble.nimble-ancestry-bonuses.Item.second-bonus';
		(globalThis as unknown as GlobalWithFromUuid).fromUuid = vi
			.fn()
			.mockImplementation(async (uuid: string) => ({ uuid, system: { rules: [] } }));

		const first = createAncestryWithDefaultBonus(firstBonus);
		const second = {
			...createAncestryWithDefaultBonus(secondBonus),
			uuid: 'Compendium.nimble.nimble-ancestries.Item.other-ancestry',
		} as unknown as NimbleAncestryItem;

		renderWithAncestry(createClass('mage'), first, second);

		await fireEvent.click(screen.getByRole('button', { name: 'Select Class' }));
		await fireEvent.click(screen.getByRole('button', { name: 'Select Ancestry' }));
		await fireEvent.click(screen.getByRole('button', { name: 'Confirm Ancestry Bonus' }));

		await vi.waitFor(() => {
			expect(screen.getByTestId('stage')).toHaveTextContent(
				String(CHARACTER_CREATION_STAGES.BACKGROUND),
			);
		});

		await fireEvent.click(screen.getByRole('button', { name: 'Select Alternate Ancestry' }));

		// The new ancestry's own default replaces the old pick, unconfirmed, re-gating the stage.
		await vi.waitFor(() => {
			expect(screen.getByTestId('selected-ancestry-bonus')).toHaveTextContent(secondBonus);
			expect(screen.getByTestId('ancestry-bonus-confirmed')).toHaveTextContent('false');
			expect(screen.getByTestId('stage')).toHaveTextContent(
				String(CHARACTER_CREATION_STAGES.ANCESTRY_BONUS),
			);
		});
	});

	it('clears the bonus when the ancestry is cleared', async () => {
		const bonusUuid = 'Compendium.nimble.nimble-ancestry-bonuses.Item.test-bonus';
		(globalThis as unknown as GlobalWithFromUuid).fromUuid = vi
			.fn()
			.mockResolvedValue({ uuid: bonusUuid, system: { rules: [] } });

		renderWithAncestry(createClass('mage'), createAncestryWithDefaultBonus(bonusUuid));

		await fireEvent.click(screen.getByRole('button', { name: 'Select Class' }));
		await fireEvent.click(screen.getByRole('button', { name: 'Select Ancestry' }));

		await vi.waitFor(() => {
			expect(screen.getByTestId('selected-ancestry-bonus')).toHaveTextContent(bonusUuid);
		});

		await fireEvent.click(screen.getByRole('button', { name: 'Clear Ancestry' }));

		await vi.waitFor(() => {
			expect(screen.getByTestId('selected-ancestry-bonus')).toHaveTextContent('null');
		});
	});

	it('holds the bonus stage when the default bonus UUID resolves to nothing', async () => {
		// A missing compendium pack resolves the UUID to null rather than throwing.
		(globalThis as unknown as GlobalWithFromUuid).fromUuid = vi.fn().mockResolvedValue(null);

		renderWithAncestry(
			createClass('mage'),
			createAncestryWithDefaultBonus('Compendium.nimble.nimble-ancestry-bonuses.Item.missing'),
		);

		await fireEvent.click(screen.getByRole('button', { name: 'Select Class' }));
		await fireEvent.click(screen.getByRole('button', { name: 'Select Ancestry' }));

		await vi.waitFor(() => {
			expect(screen.getByTestId('selected-ancestry-bonus')).toHaveTextContent('null');
			expect(screen.getByTestId('stage')).toHaveTextContent(
				String(CHARACTER_CREATION_STAGES.ANCESTRY_BONUS),
			);
		});
	});

	it('keeps a manual pick made while the default bonus is still resolving', async () => {
		// The bonus list stays clickable across the lookup, so the player can pick and confirm
		// before it lands. The late default must not overwrite that pick — there is no visual
		// cue when it does, and it silently resets any neutral-save choice.
		const defaultUuid = 'Compendium.nimble.nimble-ancestry-bonuses.Item.default-bonus';
		const manualUuid = 'Compendium.nimble.nimble-ancestry-bonuses.Item.manual-bonus';

		let resolveDefault: (doc: unknown) => void = () => undefined;
		(globalThis as unknown as GlobalWithFromUuid).fromUuid = vi.fn(
			() =>
				new Promise((resolve) => {
					resolveDefault = resolve;
				}),
		);

		const manualBonus = {
			uuid: manualUuid,
			system: { rules: [] },
		} as unknown as NimbleAncestryBonusItem;

		renderWithAncestry(
			createClass('mage'),
			createAncestryWithDefaultBonus(defaultUuid),
			null,
			manualBonus,
		);

		await fireEvent.click(screen.getByRole('button', { name: 'Select Class' }));
		await fireEvent.click(screen.getByRole('button', { name: 'Select Ancestry' }));
		await fireEvent.click(screen.getByRole('button', { name: 'Swap Ancestry Bonus' }));
		await fireEvent.click(screen.getByRole('button', { name: 'Confirm Ancestry Bonus' }));

		resolveDefault({ uuid: defaultUuid, system: { rules: [] } });
		await new Promise((resolve) => setTimeout(resolve, 0));

		expect(screen.getByTestId('selected-ancestry-bonus')).toHaveTextContent(manualUuid);
		expect(screen.getByTestId('ancestry-bonus-confirmed')).toHaveTextContent('true');
		expect(screen.getByTestId('stage')).toHaveTextContent(
			String(CHARACTER_CREATION_STAGES.BACKGROUND),
		);
	});

	it('leaves no stale bonus selected when resolving the default bonus rejects', async () => {
		const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
		(globalThis as unknown as GlobalWithFromUuid).fromUuid = vi
			.fn()
			.mockRejectedValue(new Error('pack unavailable'));

		renderWithAncestry(
			createClass('mage'),
			createAncestryWithDefaultBonus('Compendium.nimble.nimble-ancestry-bonuses.Item.broken'),
		);

		await fireEvent.click(screen.getByRole('button', { name: 'Select Class' }));
		await fireEvent.click(screen.getByRole('button', { name: 'Select Ancestry' }));

		await vi.waitFor(() => {
			expect(screen.getByTestId('selected-ancestry-bonus')).toHaveTextContent('null');
			expect(screen.getByTestId('ancestry-bonus-confirmed')).toHaveTextContent('false');
			expect(screen.getByTestId('stage')).toHaveTextContent(
				String(CHARACTER_CREATION_STAGES.ANCESTRY_BONUS),
			);
		});

		expect(consoleError).toHaveBeenCalled();
		consoleError.mockRestore();
	});

	it('drops the previous ancestry’s bonus when the new ancestry’s default fails to resolve', async () => {
		const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
		const firstBonus = 'Compendium.nimble.nimble-ancestry-bonuses.Item.first-bonus';
		(globalThis as unknown as GlobalWithFromUuid).fromUuid = vi
			.fn()
			.mockResolvedValueOnce({ uuid: firstBonus, system: { rules: [] } })
			.mockRejectedValueOnce(new Error('pack unavailable'));

		const first = createAncestryWithDefaultBonus(firstBonus);
		const second = {
			...createAncestryWithDefaultBonus(
				'Compendium.nimble.nimble-ancestry-bonuses.Item.broken-bonus',
			),
			uuid: 'Compendium.nimble.nimble-ancestries.Item.other-ancestry',
		} as unknown as NimbleAncestryItem;

		renderWithAncestry(createClass('mage'), first, second);

		await fireEvent.click(screen.getByRole('button', { name: 'Select Class' }));
		await fireEvent.click(screen.getByRole('button', { name: 'Select Ancestry' }));

		await vi.waitFor(() => {
			expect(screen.getByTestId('selected-ancestry-bonus')).toHaveTextContent(firstBonus);
		});

		await fireEvent.click(screen.getByRole('button', { name: 'Select Alternate Ancestry' }));

		// The first ancestry's bonus must not survive onto the second ancestry — leaving it
		// there would let the player confirm a bonus the new ancestry never offered.
		await vi.waitFor(() => {
			expect(screen.getByTestId('selected-ancestry-bonus')).toHaveTextContent('null');
			expect(screen.getByTestId('stage')).toHaveTextContent(
				String(CHARACTER_CREATION_STAGES.ANCESTRY_BONUS),
			);
		});
		expect(screen.getByTestId('selected-ancestry-bonus')).not.toHaveTextContent(firstBonus);

		consoleError.mockRestore();
	});

	it('sources ability and skill bonuses from the bonus trait, not the ancestry', async () => {
		const bonusUuid = 'Compendium.nimble.nimble-ancestry-bonuses.Item.stout';
		(globalThis as unknown as GlobalWithFromUuid).fromUuid = vi.fn().mockResolvedValue({
			uuid: bonusUuid,
			rules: new Map([
				['r1', { type: 'abilityBonus', abilities: ['strength'], value: '2' }],
				['r2', { type: 'skillBonus', skills: ['might'], value: '1' }],
			]),
		});

		// The ancestry carries its own bonus rules, which must now be ignored — after the
		// split these live on the swappable bonus trait.
		const ancestry = createAncestryWithDefaultBonus(bonusUuid);
		(ancestry as unknown as { rules: Map<string, unknown> }).rules = new Map([
			['ignored', { type: 'abilityBonus', abilities: ['will'], value: '5' }],
		]);

		renderWithAncestry(createClass('mage'), ancestry);

		await fireEvent.click(screen.getByRole('button', { name: 'Select Class' }));
		await fireEvent.click(screen.getByRole('button', { name: 'Select Ancestry' }));

		await vi.waitFor(() => {
			expect(screen.getByTestId('ability-bonuses')).toHaveTextContent('[["strength",2]]');
			expect(screen.getByTestId('skill-bonuses')).toHaveTextContent('[["might",1]]');
		});
	});

	it('resets a chosen neutral save when the bonus is swapped', async () => {
		const bonusUuid = 'Compendium.nimble.nimble-ancestry-bonuses.Item.with-save';
		const saveRule = {
			type: 'savingThrowRollMode',
			requiresChoice: true,
			target: 'neutral',
			disabled: false,
		};
		(globalThis as unknown as GlobalWithFromUuid).fromUuid = vi
			.fn()
			.mockResolvedValue({ uuid: bonusUuid, rules: new Map([['save', saveRule]]) });

		const swapped = {
			uuid: 'Compendium.nimble.nimble-ancestry-bonuses.Item.swapped',
			rules: new Map(),
		} as unknown as NimbleAncestryBonusItem;

		renderWithAncestry(
			createClass('mage'),
			createAncestryWithDefaultBonus(bonusUuid),
			null,
			swapped,
		);

		await fireEvent.click(screen.getByRole('button', { name: 'Select Class' }));
		await fireEvent.click(screen.getByRole('button', { name: 'Select Ancestry' }));

		await vi.waitFor(() => {
			expect(screen.getByTestId('selected-ancestry-bonus')).toHaveTextContent(bonusUuid);
		});

		await fireEvent.click(screen.getByRole('button', { name: 'Confirm Ancestry Bonus' }));

		// The neutral-save rule on the bonus opens the ancestry-options stage.
		await vi.waitFor(() => {
			expect(screen.getByTestId('stage')).toHaveTextContent(
				String(CHARACTER_CREATION_STAGES.ANCESTRY_OPTIONS),
			);
		});

		await fireEvent.click(screen.getByRole('button', { name: 'Swap Ancestry Bonus' }));

		// Swapping to a bonus without the rule drops the save choice and the stage with it.
		await vi.waitFor(() => {
			expect(screen.getByTestId('selected-ancestry-save')).toHaveTextContent('null');
			expect(screen.getByTestId('stage')).toHaveTextContent(
				String(CHARACTER_CREATION_STAGES.BACKGROUND),
			);
		});
	});
});

describe('createCharacterCreationState ancestry variant stage', () => {
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

	function createAncestryWithVariants(variants: string[], uuid = 'dryadshroomling') {
		return {
			uuid: `Compendium.nimble.nimble-ancestries.Item.${uuid}`,
			system: {
				size: ['medium'],
				rules: [],
				variants,
			},
		} as unknown as NimbleAncestryItem;
	}

	function renderWithAncestries(
		ancestryDocument: NimbleAncestryItem,
		{
			alternateAncestryDocument = null,
			ancestryVariant = null,
			submitCharacterCreation,
		}: {
			alternateAncestryDocument?: NimbleAncestryItem | null;
			ancestryVariant?: string | null;
			submitCharacterCreation?: (results: CharacterCreationResults) => Promise<void>;
		} = {},
	) {
		render(CharacterCreationStateHarness, {
			props: {
				ancestryOptions: {
					core: alternateAncestryDocument
						? [ancestryDocument, alternateAncestryDocument]
						: [ancestryDocument],
					exotic: [],
				},
				backgroundOptions: [createBackground()],
				classDocument: createClass('mage'),
				classOptions: [createClass('mage')],
				backgroundDocument: createBackground(),
				ancestryDocument,
				alternateAncestryDocument,
				ancestryVariant,
				spellIndex: createSpellIndex([]),
				...(submitCharacterCreation ? { submitCharacterCreation } : {}),
			},
		});
	}

	it('gates on ANCESTRY_OPTIONS until a variant is chosen', async () => {
		renderWithAncestries(createAncestryWithVariants(['Dryad', 'Shroomling']), {
			ancestryVariant: 'Shroomling',
		});

		await fireEvent.click(screen.getByRole('button', { name: 'Select Class' }));
		await fireEvent.click(screen.getByRole('button', { name: 'Select Ancestry' }));

		// The fixture has one size and no save choice, so the variant alone holds the stage.
		await vi.waitFor(() => {
			expect(screen.getByTestId('selected-ancestry-variant')).toHaveTextContent('null');
			expect(screen.getByTestId('stage')).toHaveTextContent(
				String(CHARACTER_CREATION_STAGES.ANCESTRY_OPTIONS),
			);
		});

		await fireEvent.click(screen.getByRole('button', { name: 'Select Ancestry Variant' }));

		await vi.waitFor(() => {
			expect(screen.getByTestId('selected-ancestry-variant')).toHaveTextContent('Shroomling');
			expect(screen.getByTestId('stage')).toHaveTextContent(
				String(CHARACTER_CREATION_STAGES.BACKGROUND),
			);
		});
	});

	it('skips ANCESTRY_OPTIONS for an ancestry that covers a single kind of people', async () => {
		renderWithAncestries(createAncestryWithVariants(['Dryad']));

		await fireEvent.click(screen.getByRole('button', { name: 'Select Class' }));
		await fireEvent.click(screen.getByRole('button', { name: 'Select Ancestry' }));

		await vi.waitFor(() => {
			expect(screen.getByTestId('stage')).toHaveTextContent(
				String(CHARACTER_CREATION_STAGES.BACKGROUND),
			);
		});
	});

	it('drops the chosen variant when the ancestry is cleared', async () => {
		renderWithAncestries(createAncestryWithVariants(['Dryad', 'Shroomling']), {
			ancestryVariant: 'Shroomling',
		});

		await fireEvent.click(screen.getByRole('button', { name: 'Select Class' }));
		await fireEvent.click(screen.getByRole('button', { name: 'Select Ancestry' }));
		await fireEvent.click(screen.getByRole('button', { name: 'Select Ancestry Variant' }));

		await vi.waitFor(() => {
			expect(screen.getByTestId('selected-ancestry-variant')).toHaveTextContent('Shroomling');
		});

		await fireEvent.click(screen.getByRole('button', { name: 'Clear Ancestry' }));

		await vi.waitFor(() => {
			expect(screen.getByTestId('selected-ancestry-variant')).toHaveTextContent('null');
		});
	});

	it('drops the chosen variant when the ancestry changes', async () => {
		renderWithAncestries(createAncestryWithVariants(['Dryad', 'Shroomling']), {
			alternateAncestryDocument: createAncestryWithVariants(
				['Oozeling', 'Construct'],
				'oozelingconstruct',
			),
			ancestryVariant: 'Shroomling',
		});

		await fireEvent.click(screen.getByRole('button', { name: 'Select Class' }));
		await fireEvent.click(screen.getByRole('button', { name: 'Select Ancestry' }));
		await fireEvent.click(screen.getByRole('button', { name: 'Select Ancestry Variant' }));

		await vi.waitFor(() => {
			expect(screen.getByTestId('selected-ancestry-variant')).toHaveTextContent('Shroomling');
		});

		await fireEvent.click(screen.getByRole('button', { name: 'Select Alternate Ancestry' }));

		await vi.waitFor(() => {
			expect(screen.getByTestId('selected-ancestry-variant')).toHaveTextContent('null');
			expect(screen.getByTestId('stage')).toHaveTextContent(
				String(CHARACTER_CREATION_STAGES.ANCESTRY_OPTIONS),
			);
		});
	});

	it('hands the chosen variant to the dialog on submit', async () => {
		const submitCharacterCreation = vi.fn(async () => undefined);
		// Restored rather than left set: `vi.clearAllMocks()` clears calls but keeps implementations,
		// so this would answer "yes" for every later test in the file.
		const confirm = vi
			.spyOn(foundry.applications.api.DialogV2, 'confirm')
			.mockResolvedValue(true as never);
		onTestFinished(() => confirm.mockRestore());

		renderWithAncestries(createAncestryWithVariants(['Dryad', 'Shroomling']), {
			ancestryVariant: 'Shroomling',
			submitCharacterCreation,
		});

		await fireEvent.click(screen.getByRole('button', { name: 'Select Class' }));
		await fireEvent.click(screen.getByRole('button', { name: 'Select Ancestry' }));
		await fireEvent.click(screen.getByRole('button', { name: 'Select Ancestry Variant' }));
		await fireEvent.click(screen.getByRole('button', { name: 'Submit Character' }));

		await vi.waitFor(() => {
			expect(submitCharacterCreation).toHaveBeenCalledWith(
				expect.objectContaining({ selectedAncestryVariant: 'Shroomling' }),
			);
		});
	});
});

describe('createCharacterCreationState granted languages', () => {
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

	it('lowercases and tags background language grants without gating on Intelligence', async () => {
		const background = createBackground([
			{
				id: 'lang-basic',
				type: 'grantProficiency',
				proficiencyType: 'languages',
				values: ['Common', 'Elvish'],
			},
			{
				// An INT-predicated rule must still be granted: background language grants,
				// unlike ancestry grants, are not gated on the Intelligence modifier.
				id: 'lang-gated',
				type: 'grantProficiency',
				proficiencyType: 'languages',
				values: ['Draconic'],
				predicate: { intelligence: { min: 5 } },
			},
			{
				// Non-language proficiency grants are ignored.
				id: 'armor',
				type: 'grantProficiency',
				proficiencyType: 'armor',
				values: ['plate'],
			},
		]);

		render(CharacterCreationStateHarness, {
			props: {
				ancestryOptions: {
					core: [],
					exotic: [],
				},
				backgroundOptions: [background],
				classDocument: null,
				classOptions: [],
				backgroundDocument: background,
				spellIndex: createSpellIndex([]),
			},
		});

		await fireEvent.click(screen.getByRole('button', { name: 'Select Background' }));

		await vi.waitFor(() => {
			const granted = JSON.parse(
				screen.getByTestId('granted-languages').textContent ?? '[]',
			) as Array<{ key: string; source: string }>;
			expect(granted).toEqual([
				{ key: 'common', source: 'background' },
				{ key: 'elvish', source: 'background' },
				{ key: 'draconic', source: 'background' },
			]);
		});
	});
});

describe('createCharacterCreationState ancestry granted languages', () => {
	let originalSpeakers: unknown;

	// The GM owns ancestry language grants via the In-Game Languages settings; a world may
	// define a different set than the base rules, so the dialog reads this rather than the
	// ancestry item's own grantProficiency rules.
	function setLanguageSpeakers(speakers: Record<string, string[]>) {
		(CONFIG.NIMBLE as unknown as { languageSpeakers?: Record<string, string[]> }).languageSpeakers =
			speakers;
	}

	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(getClassFeaturesFromIndex).mockResolvedValue(createClassFeaturesResult([]));
		(
			globalThis as unknown as { requestAnimationFrame: typeof requestAnimationFrame }
		).requestAnimationFrame = vi.fn((callback: FrameRequestCallback) => {
			callback(0);
			return 1;
		});
		originalSpeakers = (CONFIG.NIMBLE as unknown as { languageSpeakers?: Record<string, string[]> })
			.languageSpeakers;
	});

	afterEach(() => {
		(CONFIG.NIMBLE as unknown as { languageSpeakers?: unknown }).languageSpeakers =
			originalSpeakers;
	});

	function createAncestryWithIdentifier(identifier: string) {
		return {
			uuid: 'Compendium.nimble.nimble-ancestries.Item.test-ancestry',
			identifier,
			system: {
				size: ['medium'],
				rules: [
					{
						// Present but must be ignored — the settings layer is authoritative.
						id: 'lang-from-rules',
						type: 'grantProficiency',
						proficiencyType: 'languages',
						values: ['Ignored'],
					},
				],
				defaultBonus: '',
			},
		} as unknown as NimbleAncestryItem;
	}

	function renderForLanguages(
		ancestryDocument: NimbleAncestryItem,
		abilityScoreAssignment: Record<string, number | null>,
	) {
		render(CharacterCreationStateHarness, {
			props: {
				ancestryOptions: { core: [ancestryDocument], exotic: [] },
				backgroundOptions: [],
				classDocument: null,
				classOptions: [],
				ancestryDocument,
				// index 0 -> +2, index 1 -> -1
				statArray: { array: [2, -1] } as never,
				abilityScoreAssignment,
				spellIndex: createSpellIndex([]),
			},
		});
	}

	it('grants the GM-configured languages for the ancestry, not the ones on its rules', async () => {
		setLanguageSpeakers({ common: ['dwarf'], dwarvish: ['dwarf'], elvish: ['elf'] });

		renderForLanguages(createAncestryWithIdentifier('dwarf'), {
			strength: 0,
			dexterity: 0,
			intelligence: 0,
			will: 0,
		});

		await fireEvent.click(screen.getByRole('button', { name: 'Select Ancestry' }));
		await fireEvent.click(screen.getByRole('button', { name: 'Assign Ability Scores' }));

		await vi.waitFor(() => {
			const granted = JSON.parse(
				screen.getByTestId('granted-languages').textContent ?? '[]',
			) as Array<{ key: string; source: string }>;
			expect(granted).toEqual([
				{ key: 'common', source: 'ancestry' },
				{ key: 'dwarvish', source: 'ancestry' },
			]);
		});
	});

	it('grants nothing from the ancestry when the Intelligence modifier is negative', async () => {
		setLanguageSpeakers({ common: ['dwarf'], dwarvish: ['dwarf'] });

		// Intelligence assigned to array index 1, which is -1.
		renderForLanguages(createAncestryWithIdentifier('dwarf'), {
			strength: 0,
			dexterity: 0,
			intelligence: 1,
			will: 0,
		});

		await fireEvent.click(screen.getByRole('button', { name: 'Select Ancestry' }));
		await fireEvent.click(screen.getByRole('button', { name: 'Assign Ability Scores' }));

		await vi.waitFor(() => {
			expect(screen.getByTestId('granted-languages')).toHaveTextContent('[]');
		});
	});

	it('grants nothing when the ancestry speaks no configured language', async () => {
		setLanguageSpeakers({ elvish: ['elf'] });

		renderForLanguages(createAncestryWithIdentifier('dwarf'), {
			strength: 0,
			dexterity: 0,
			intelligence: 0,
			will: 0,
		});

		await fireEvent.click(screen.getByRole('button', { name: 'Select Ancestry' }));
		await fireEvent.click(screen.getByRole('button', { name: 'Assign Ability Scores' }));

		await vi.waitFor(() => {
			expect(screen.getByTestId('granted-languages')).toHaveTextContent('[]');
		});
	});
});
