import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { render, waitFor } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { NimbleFeatureItem } from '#documents/item/feature.js';
import type { ClassFeatureIndex } from '#utils/getClassFeatures.ts';
import FeatureOptionPickerStateHarness from '../../../../../tests/harnesses/FeatureOptionPickerStateHarness.svelte';
// @ts-expect-error - Svelte component default export is provided by the Svelte compiler
import LevelUpFeatureOptionPicker from './LevelUpFeatureOptionPicker.svelte';

interface LevelUpOptionInput {
	id: string;
	label?: string;
	applyAtLevels?: number[];
	selectionGroups?: string[];
	selectionCount?: number;
	rules?: Array<Record<string, unknown>>;
}

/** Build a minimal feature document with the fields the factory reads. */
function createFeature(options: LevelUpOptionInput[]): NimbleFeatureItem {
	return {
		name: 'Test Option Feature',
		uuid: 'Item.test-option-feature',
		system: {
			class: 'berserker',
			levelUpOptions: options.map((o) => ({
				id: o.id,
				label: o.label ?? o.id,
				applyAtLevels: o.applyAtLevels ?? [],
				selectionGroups: o.selectionGroups ?? [],
				selectionCount: o.selectionCount ?? 1,
				rules: o.rules ?? [],
			})),
		},
	} as unknown as NimbleFeatureItem;
}

interface PoolEntry {
	uuid: string;
	name: string;
	group: string;
}

/**
 * Build the pre-built class-feature index the picker now consumes, and back `fromUuid`
 * with the matching in-memory documents. Returns the index plus a restore function.
 */
function setupPool(
	entries: PoolEntry[],
	classId = 'berserker',
): { index: ClassFeatureIndex; restore: () => void } {
	const g = globalThis as unknown as { fromUuid?: (uuid: string) => Promise<unknown> };
	const docsByUuid = new Map(
		entries.map((e) => [e.uuid, { uuid: e.uuid, name: e.name, system: {} }]),
	);
	const originalFromUuid = g.fromUuid;
	g.fromUuid = async (uuid: string) => docsByUuid.get(uuid) ?? null;

	// Class features are indexed under the class key; a single level suffices since the
	// picker collects pool members across every level the class offers them.
	const indexEntries = entries.map((e) => ({
		uuid: e.uuid,
		group: e.group,
		selectionCountByLevel: {},
	}));
	const index: ClassFeatureIndex = new Map([[classId, new Map([[1, indexEntries]])]]);

	return {
		index,
		restore: () => {
			g.fromUuid = originalFromUuid;
		},
	};
}

describe('createFeatureOptionPickerState', () => {
	let restore: (() => void) | null = null;

	afterEach(() => {
		restore?.();
		restore = null;
	});

	it('auto-selects the sole applicable option', async () => {
		const onSelect = vi.fn();
		render(FeatureOptionPickerStateHarness, {
			props: {
				feature: createFeature([{ id: 'only-option' }]),
				levelingTo: 4,
				selectedOptionId: null,
				onSelect,
				onSubItemSelect: vi.fn(),
			},
		});

		await waitFor(() => expect(onSelect).toHaveBeenCalledWith('only-option'));
	});

	it('does not auto-select when more than one option applies', async () => {
		const onSelect = vi.fn();
		const { getByTestId } = render(FeatureOptionPickerStateHarness, {
			props: {
				feature: createFeature([{ id: 'a' }, { id: 'b' }]),
				levelingTo: 4,
				selectedOptionId: null,
				onSelect,
				onSubItemSelect: vi.fn(),
			},
		});

		await waitFor(() => expect(getByTestId('option-count').textContent).toBe('2'));
		expect(getByTestId('is-single').textContent).toBe('false');
		expect(onSelect).not.toHaveBeenCalled();
	});

	it('filters options by applyAtLevels and auto-selects the one that applies', async () => {
		const onSelect = vi.fn();
		const { getByTestId } = render(FeatureOptionPickerStateHarness, {
			props: {
				feature: createFeature([
					{ id: 'at-four', applyAtLevels: [4] },
					{ id: 'at-six', applyAtLevels: [6] },
				]),
				levelingTo: 4,
				selectedOptionId: null,
				onSelect,
				onSubItemSelect: vi.fn(),
			},
		});

		await waitFor(() => expect(getByTestId('option-count').textContent).toBe('1'));
		expect(onSelect).toHaveBeenCalledWith('at-four');
		expect(onSelect).not.toHaveBeenCalledWith('at-six');
	});

	it('auto-selects the sub-item when the available pool exactly matches the required count', async () => {
		const { index, restore: r } = setupPool([
			{ uuid: 'Item.sole-pick', name: 'Sole Pick', group: 'weapon-mastery' },
		]);
		restore = r;
		const onSubItemSelect = vi.fn();

		render(FeatureOptionPickerStateHarness, {
			props: {
				feature: createFeature([
					{ id: 'opt', selectionGroups: ['weapon-mastery'], selectionCount: 1 },
				]),
				levelingTo: 14,
				selectedOptionId: 'opt',
				selectedSubItemUuids: [],
				classFeatureIndex: index,
				onSelect: vi.fn(),
				onSubItemSelect,
			},
		});

		await waitFor(() => expect(onSubItemSelect).toHaveBeenCalledWith('Item.sole-pick'));
	});

	it('does not auto-select sub-items when the pool is larger than the required count', async () => {
		const { index, restore: r } = setupPool([
			{ uuid: 'Item.pick-a', name: 'Pick A', group: 'weapon-mastery' },
			{ uuid: 'Item.pick-b', name: 'Pick B', group: 'weapon-mastery' },
		]);
		restore = r;
		const onSubItemSelect = vi.fn();

		const { getByTestId } = render(FeatureOptionPickerStateHarness, {
			props: {
				feature: createFeature([
					{ id: 'opt', selectionGroups: ['weapon-mastery'], selectionCount: 1 },
				]),
				levelingTo: 6,
				selectedOptionId: 'opt',
				selectedSubItemUuids: [],
				classFeatureIndex: index,
				onSelect: vi.fn(),
				onSubItemSelect,
			},
		});

		await waitFor(() => expect(getByTestId('loaded-count').textContent).toBe('2'));
		expect(onSubItemSelect).not.toHaveBeenCalled();
	});
});

/**
 * Guards the Shepherd's level-5 "Choose 2 Sacred Graces" against a silent regression.
 *
 * The class-progression suites simulate the level-up flow, so they can agree with the
 * compendium while the dialog still asks for one pick. This drives the REAL picker state
 * with the REAL compendium document, which is the pair that decides what a player sees.
 */
describe('createFeatureOptionPickerState — Shepherd Sacred Graces (real compendium data)', () => {
	const SACRED_GRACES_PATH = join(
		process.cwd(),
		'packs/classFeatures/core/shepherd/shepherd-progression/sacred-graces.json',
	);

	function loadSacredGraces(): NimbleFeatureItem {
		const doc = JSON.parse(readFileSync(SACRED_GRACES_PATH, 'utf-8'));
		return { name: doc.name, uuid: `Item.${doc._id}`, system: doc.system } as NimbleFeatureItem;
	}

	async function renderAtLevel(level: number) {
		const feature = loadSacredGraces();
		const applicable = feature.system.levelUpOptions.filter((opt) =>
			opt.applyAtLevels.includes(level),
		);
		expect(applicable, `exactly one option must apply at level ${level}`).toHaveLength(1);

		const { getByTestId } = render(FeatureOptionPickerStateHarness, {
			props: {
				feature,
				levelingTo: level,
				selectedOptionId: applicable[0].id,
				onSelect: vi.fn(),
				onSubItemSelect: vi.fn(),
			},
		});

		await waitFor(() => expect(getByTestId('option-count').textContent).toBe('1'));
		return getByTestId;
	}

	it('asks for 2 picks when leveling to 5', async () => {
		const getByTestId = await renderAtLevel(5);
		expect(getByTestId('sub-selection-count').textContent).toBe('2');
	});

	for (const level of [9, 13]) {
		it(`asks for 1 pick when leveling to ${level}`, async () => {
			const getByTestId = await renderAtLevel(level);
			expect(getByTestId('sub-selection-count').textContent).toBe('1');
		});
	}
});

/**
 * The count alone does not tell a player what they are picking; the option's own label does.
 * The picker only drew the label when the level offered a choice between options, which is
 * never at the Shepherd's level 5.
 */
describe('LevelUpFeatureOptionPicker — option label', () => {
	it('shows the sole applicable option label instead of the "choose one" hint', () => {
		const feature = createFeature([
			{ id: 'sacred-grace-initial', label: 'Choose 2 Sacred Graces', applyAtLevels: [5] },
			{ id: 'sacred-grace', label: 'Choose a Sacred Grace', applyAtLevels: [9, 13] },
		]);

		const { getByText, queryByText } = render(LevelUpFeatureOptionPicker, {
			props: {
				feature,
				levelingTo: 5,
				selectedOptionId: 'sacred-grace-initial',
				selectedSubItemUuids: [],
				ownedItemUuids: new Set<string>(),
				classFeatureIndex: null,
				onSelect: vi.fn(),
				onSubItemSelect: vi.fn(),
			},
		});

		expect(getByText('Choose 2 Sacred Graces')).toBeTruthy();
		expect(queryByText('(Choose one)')).toBeNull();
	});

	it('keeps the "choose one" hint when the level offers alternatives', () => {
		const feature = createFeature([
			{ id: 'pool-pick', label: 'Choose a Combat Ability', applyAtLevels: [6] },
			{ id: 'flat-bonus', label: '+1 Max Combat Die', applyAtLevels: [6] },
		]);

		const { getByText } = render(LevelUpFeatureOptionPicker, {
			props: {
				feature,
				levelingTo: 6,
				selectedOptionId: null,
				selectedSubItemUuids: [],
				ownedItemUuids: new Set<string>(),
				classFeatureIndex: null,
				onSelect: vi.fn(),
				onSubItemSelect: vi.fn(),
			},
		});

		expect(getByText('(Choose one)')).toBeTruthy();
		expect(getByText('Choose a Combat Ability')).toBeTruthy();
	});
});
