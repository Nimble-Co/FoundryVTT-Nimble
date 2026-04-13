import { beforeEach, describe, expect, it, vi } from 'vitest';

import getSubclassFeaturesFromIndex, { buildSubclassFeatureIndex } from './getSubclassFeatures.ts';

interface MockFeatureItem {
	type: 'feature';
	uuid: string;
	name: string;
	system: {
		class: string;
		subclass: boolean;
		group: string;
		gainedAtLevel?: number | null;
		gainedAtLevels?: number[];
	};
}

const originalGame = (globalThis as unknown as { game: unknown }).game;
const originalFromUuid = (globalThis as unknown as { fromUuid?: unknown }).fromUuid;

function setGameItems(items: MockFeatureItem[]): void {
	(globalThis as unknown as { game: { items: Iterable<unknown>; packs: Iterable<unknown> } }).game =
		{
			items: {
				*[Symbol.iterator]() {
					for (const item of items) yield item;
				},
			},
			packs: {
				*[Symbol.iterator]() {
					// No packs in this test
				},
			},
		};
}

function restoreGame(): void {
	(globalThis as unknown as { game: unknown }).game = originalGame;
}

describe('buildSubclassFeatureIndex', () => {
	beforeEach(() => {
		(globalThis as unknown as { fromUuid: unknown }).fromUuid = originalFromUuid;
	});

	it('indexes subclass features by class, subclass, and level', async () => {
		setGameItems([
			{
				type: 'feature',
				uuid: 'Item.beastmaster-feat',
				name: 'Beastmaster',
				system: {
					class: 'hunter',
					subclass: true,
					group: 'beastmaster',
					gainedAtLevel: 3,
				},
			},
			{
				type: 'feature',
				uuid: 'Item.beastmaster-level-7',
				name: 'Advanced Pack',
				system: {
					class: 'hunter',
					subclass: true,
					group: 'beastmaster',
					gainedAtLevel: 7,
				},
			},
		]);

		const index = await buildSubclassFeatureIndex();

		expect(index.get('hunter')?.get('beastmaster')?.get(3)).toEqual([
			{ uuid: 'Item.beastmaster-feat' },
		]);
		expect(index.get('hunter')?.get('beastmaster')?.get(7)).toEqual([
			{ uuid: 'Item.beastmaster-level-7' },
		]);
		restoreGame();
	});

	it('excludes non-subclass features', async () => {
		setGameItems([
			{
				type: 'feature',
				uuid: 'Item.class-feat',
				name: 'Second Wind',
				system: {
					class: 'hunter',
					subclass: false,
					group: 'core-progression',
					gainedAtLevel: 1,
				},
			},
		]);

		const index = await buildSubclassFeatureIndex();

		expect(index.get('hunter')).toBeUndefined();
		restoreGame();
	});

	it('supports features with gainedAtLevels arrays and deduplicates', async () => {
		setGameItems([
			{
				type: 'feature',
				uuid: 'Item.repeat-feat',
				name: 'Repeating Boon',
				system: {
					class: 'hunter',
					subclass: true,
					group: 'beastmaster',
					gainedAtLevel: 3,
					gainedAtLevels: [3, 5],
				},
			},
		]);

		const index = await buildSubclassFeatureIndex();

		expect(index.get('hunter')?.get('beastmaster')?.get(3)).toEqual([{ uuid: 'Item.repeat-feat' }]);
		expect(index.get('hunter')?.get('beastmaster')?.get(5)).toEqual([{ uuid: 'Item.repeat-feat' }]);
		restoreGame();
	});

	it('skips subclass features missing class or group', async () => {
		setGameItems([
			{
				type: 'feature',
				uuid: 'Item.no-class',
				name: 'Orphan A',
				system: {
					class: '',
					subclass: true,
					group: 'beastmaster',
					gainedAtLevel: 3,
				},
			},
			{
				type: 'feature',
				uuid: 'Item.no-group',
				name: 'Orphan B',
				system: {
					class: 'hunter',
					subclass: true,
					group: '',
					gainedAtLevel: 3,
				},
			},
		]);

		const index = await buildSubclassFeatureIndex();

		expect(index.size).toBe(0);
		restoreGame();
	});
});

describe('getSubclassFeaturesFromIndex', () => {
	it('returns features resolved from their UUIDs', async () => {
		setGameItems([
			{
				type: 'feature',
				uuid: 'Item.beastmaster-feat',
				name: 'Beastmaster',
				system: {
					class: 'hunter',
					subclass: true,
					group: 'beastmaster',
					gainedAtLevel: 3,
				},
			},
		]);

		const index = await buildSubclassFeatureIndex();

		const fromUuidMock = vi.fn(async (uuid: string) => ({
			uuid,
			name: 'Beastmaster',
			type: 'feature',
		}));
		(globalThis as unknown as { fromUuid: typeof fromUuidMock }).fromUuid = fromUuidMock;

		const features = await getSubclassFeaturesFromIndex(index, 'hunter', 'beastmaster', 3);

		expect(features).toHaveLength(1);
		expect(features[0].uuid).toBe('Item.beastmaster-feat');
		expect(fromUuidMock).toHaveBeenCalledWith('Item.beastmaster-feat');
		restoreGame();
	});

	it('returns an empty array when no features exist for the level', async () => {
		setGameItems([]);
		const index = await buildSubclassFeatureIndex();

		const features = await getSubclassFeaturesFromIndex(index, 'hunter', 'beastmaster', 3);
		expect(features).toEqual([]);
		restoreGame();
	});

	it('returns an empty array when classIdentifier or subclassIdentifier is empty', async () => {
		const emptyIndex = await buildSubclassFeatureIndex();

		expect(await getSubclassFeaturesFromIndex(emptyIndex, '', 'beastmaster', 3)).toEqual([]);
		expect(await getSubclassFeaturesFromIndex(emptyIndex, 'hunter', '', 3)).toEqual([]);
	});

	it('filters out null results from fromUuid', async () => {
		setGameItems([
			{
				type: 'feature',
				uuid: 'Item.missing',
				name: 'Missing',
				system: {
					class: 'hunter',
					subclass: true,
					group: 'beastmaster',
					gainedAtLevel: 3,
				},
			},
			{
				type: 'feature',
				uuid: 'Item.present',
				name: 'Present',
				system: {
					class: 'hunter',
					subclass: true,
					group: 'beastmaster',
					gainedAtLevel: 3,
				},
			},
		]);

		const index = await buildSubclassFeatureIndex();

		const fromUuidMock = vi.fn(async (uuid: string) =>
			uuid === 'Item.missing' ? null : { uuid, type: 'feature' },
		);
		(globalThis as unknown as { fromUuid: typeof fromUuidMock }).fromUuid = fromUuidMock;

		const features = await getSubclassFeaturesFromIndex(index, 'hunter', 'beastmaster', 3);
		expect(features).toHaveLength(1);
		expect(features[0].uuid).toBe('Item.present');
		restoreGame();
	});
});
