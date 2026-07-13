import { render, waitFor } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { NimbleFeatureItem } from '#documents/item/feature.js';
import FeatureOptionPickerStateHarness from '../../../../../tests/harnesses/FeatureOptionPickerStateHarness.svelte';

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
 * Back the real `loadOptionSubItems` pack scan with an in-memory pack, the same way
 * the class-progression fixtures do. Returns a restore function.
 */
function installPack(entries: PoolEntry[], classId = 'berserker'): () => void {
	const g = globalThis as unknown as {
		game: { packs: unknown };
		fromUuid?: (uuid: string) => Promise<unknown>;
	};
	const packIndex = entries.map((e) => ({
		uuid: e.uuid,
		type: 'feature',
		system: { class: classId, group: e.group, subclass: false },
	}));
	const docsByUuid = new Map(
		entries.map((e) => [e.uuid, { uuid: e.uuid, name: e.name, system: {} }]),
	);
	const originalPacks = g.game.packs;
	const originalFromUuid = g.fromUuid;
	g.game.packs = [
		{
			documentName: 'Item',
			async getIndex() {
				return packIndex;
			},
		},
	];
	g.fromUuid = async (uuid: string) => docsByUuid.get(uuid) ?? null;

	return () => {
		g.game.packs = originalPacks;
		g.fromUuid = originalFromUuid;
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
		restore = installPack([{ uuid: 'Item.sole-pick', name: 'Sole Pick', group: 'weapon-mastery' }]);
		const onSubItemSelect = vi.fn();

		render(FeatureOptionPickerStateHarness, {
			props: {
				feature: createFeature([
					{ id: 'opt', selectionGroups: ['weapon-mastery'], selectionCount: 1 },
				]),
				levelingTo: 14,
				selectedOptionId: 'opt',
				selectedSubItemUuids: [],
				onSelect: vi.fn(),
				onSubItemSelect,
			},
		});

		await waitFor(() => expect(onSubItemSelect).toHaveBeenCalledWith('Item.sole-pick'));
	});

	it('does not auto-select sub-items when the pool is larger than the required count', async () => {
		restore = installPack([
			{ uuid: 'Item.pick-a', name: 'Pick A', group: 'weapon-mastery' },
			{ uuid: 'Item.pick-b', name: 'Pick B', group: 'weapon-mastery' },
		]);
		const onSubItemSelect = vi.fn();

		const { getByTestId } = render(FeatureOptionPickerStateHarness, {
			props: {
				feature: createFeature([
					{ id: 'opt', selectionGroups: ['weapon-mastery'], selectionCount: 1 },
				]),
				levelingTo: 6,
				selectedOptionId: 'opt',
				selectedSubItemUuids: [],
				onSelect: vi.fn(),
				onSubItemSelect,
			},
		});

		await waitFor(() => expect(getByTestId('loaded-count').textContent).toBe('2'));
		expect(onSubItemSelect).not.toHaveBeenCalled();
	});
});
