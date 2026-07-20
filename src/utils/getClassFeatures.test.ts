import { afterEach, describe, expect, it, vi } from 'vitest';

import type { NimbleFeatureItem } from '#documents/item/feature.js';
import getClassFeaturesFromIndex, { type ClassFeatureIndex } from './getClassFeatures.ts';

const originalFromUuid = (globalThis as unknown as { fromUuid?: unknown }).fromUuid;

function createFeatureItem({
	uuid,
	name,
	compendiumSource,
}: {
	uuid: string;
	name: string;
	compendiumSource?: string;
}): NimbleFeatureItem {
	return {
		uuid,
		type: 'feature',
		name,
		img: 'icons/svg/item-bag.svg',
		system: {
			description: '',
		},
		_stats: { compendiumSource },
	} as NimbleFeatureItem;
}

/** Builds a single-level, single-class index and a matching fromUuid mock for the given entries. */
function mockResolvedFeatures(
	classIdentifier: string,
	level: number,
	entries: Array<{ uuid: string; name: string; group: string; compendiumSource?: string }>,
): ClassFeatureIndex {
	const index: ClassFeatureIndex = new Map([
		[
			classIdentifier,
			new Map([
				[level, entries.map(({ uuid, group }) => ({ uuid, group, selectionCountByLevel: {} }))],
			]),
		],
	]);

	const documentsByUuid = new Map(
		entries.map((entry) => [entry.uuid, createFeatureItem(entry)] as const),
	);
	const fromUuidMock = vi.fn(async (uuid: string) => documentsByUuid.get(uuid) ?? null);
	(globalThis as unknown as { fromUuid: typeof fromUuidMock }).fromUuid = fromUuidMock;

	return index;
}

describe('getClassFeaturesFromIndex', () => {
	afterEach(() => {
		(globalThis as unknown as { fromUuid?: unknown }).fromUuid = originalFromUuid;
	});

	it('filters owned feature UUIDs out of selection groups while preserving the group selection count', async () => {
		const index: ClassFeatureIndex = new Map([
			[
				'commander',
				new Map([
					[
						2,
						[
							{
								uuid: 'Item.commander-order-previous',
								group: 'commander-orders',
								selectionCountByLevel: { '2': 2 },
							},
							{
								uuid: 'Item.commander-order-one',
								group: 'commander-orders',
								selectionCountByLevel: { '2': 2 },
							},
							{
								uuid: 'Item.commander-order-two',
								group: 'commander-orders',
								selectionCountByLevel: { '2': 2 },
							},
						],
					],
				]),
			],
		]);

		const documentsByUuid = new Map<string, NimbleFeatureItem>([
			[
				'Item.commander-order-previous',
				createFeatureItem({
					uuid: 'Item.commander-order-previous',
					name: 'Previous Order',
				}),
			],
			[
				'Item.commander-order-one',
				createFeatureItem({
					uuid: 'Item.commander-order-one',
					name: 'Order One',
				}),
			],
			[
				'Item.commander-order-two',
				createFeatureItem({
					uuid: 'Item.commander-order-two',
					name: 'Order Two',
				}),
			],
		]);

		const fromUuidMock = vi.fn(async (uuid: string) => documentsByUuid.get(uuid) ?? null);
		(globalThis as unknown as { fromUuid: typeof fromUuidMock }).fromUuid = fromUuidMock;

		const result = await getClassFeaturesFromIndex(index, 'commander', 2, {
			ownedFeatureUuids: new Set(['Item.commander-order-previous']),
		});

		expect(result.autoGrant).toEqual([]);
		expect(result.selectionGroups.get('commander-orders')).toEqual({
			features: [
				expect.objectContaining({ uuid: 'Item.commander-order-one' }),
				expect.objectContaining({ uuid: 'Item.commander-order-two' }),
			],
			selectionCount: 2,
		});
		expect(fromUuidMock).toHaveBeenCalledTimes(3);
	});

	it('defaults selectionCount to 1 when selectionCountByLevel has no entry for the current level', async () => {
		const index: ClassFeatureIndex = new Map([
			[
				'fighter',
				new Map([
					[
						3,
						[
							{ uuid: 'Item.fighter-feat-one', group: 'fighter-feats', selectionCountByLevel: {} },
							{ uuid: 'Item.fighter-feat-two', group: 'fighter-feats', selectionCountByLevel: {} },
						],
					],
				]),
			],
		]);

		const documentsByUuid = new Map<string, NimbleFeatureItem>([
			[
				'Item.fighter-feat-one',
				createFeatureItem({ uuid: 'Item.fighter-feat-one', name: 'Feat One' }),
			],
			[
				'Item.fighter-feat-two',
				createFeatureItem({ uuid: 'Item.fighter-feat-two', name: 'Feat Two' }),
			],
		]);

		const fromUuidMock = vi.fn(async (uuid: string) => documentsByUuid.get(uuid) ?? null);
		(globalThis as unknown as { fromUuid: typeof fromUuidMock }).fromUuid = fromUuidMock;

		const result = await getClassFeaturesFromIndex(index, 'fighter', 3);

		expect(result.selectionGroups.get('fighter-feats')).toEqual({
			features: [
				expect.objectContaining({ uuid: 'Item.fighter-feat-one' }),
				expect.objectContaining({ uuid: 'Item.fighter-feat-two' }),
			],
			selectionCount: 1,
		});
	});

	it('places features into autoGrant for -progression groups', async () => {
		const index: ClassFeatureIndex = new Map([
			[
				'ranger',
				new Map([
					[
						1,
						[
							{
								uuid: 'Item.ranger-class-progression',
								group: 'ranger-progression',
								selectionCountByLevel: {},
							},
						],
					],
				]),
			],
		]);

		const documentsByUuid = new Map<string, NimbleFeatureItem>([
			[
				'Item.ranger-class-progression',
				createFeatureItem({ uuid: 'Item.ranger-class-progression', name: 'Ranger Progression' }),
			],
		]);

		const fromUuidMock = vi.fn(async (uuid: string) => documentsByUuid.get(uuid) ?? null);
		(globalThis as unknown as { fromUuid: typeof fromUuidMock }).fromUuid = fromUuidMock;

		const result = await getClassFeaturesFromIndex(index, 'ranger', 1);

		expect(result.autoGrant).toEqual([
			expect.objectContaining({ uuid: 'Item.ranger-class-progression' }),
		]);
		expect(result.selectionGroups.size).toBe(0);
	});

	it('auto-grants distinct ungrouped features without creating a selection group', async () => {
		const index = mockResolvedFeatures('wizard', 2, [
			{ uuid: 'Item.arcane-recovery', name: 'Arcane Recovery', group: 'ungrouped' },
			{ uuid: 'Item.spell-mastery', name: 'Spell Mastery', group: 'ungrouped' },
		]);

		const result = await getClassFeaturesFromIndex(index, 'wizard', 2);

		expect(result.selectionGroups.size).toBe(0);
		expect(result.autoGrant.map((f) => f.uuid)).toEqual([
			'Item.arcane-recovery',
			'Item.spell-mastery',
		]);
	});

	it('promotes same-named auto-grant duplicates into a single "choose one or keep both" group', async () => {
		const index = mockResolvedFeatures('druid', 2, [
			{ uuid: 'Item.wild-shape-world', name: 'Wild Shape', group: 'ungrouped' },
			{
				uuid: 'Compendium.nimble.class-features.Item.wild-shape-comp',
				name: 'Wild Shape',
				group: 'ungrouped',
			},
		]);

		const result = await getClassFeaturesFromIndex(index, 'druid', 2);

		expect(result.autoGrant).toEqual([]);
		expect(result.selectionGroups.size).toBe(1);

		const group = [...result.selectionGroups.values()][0];
		expect(group.selectionCount).toBe(1);
		expect(group.selectionMax).toBe(2);
		expect(group.isDuplicateChoice).toBe(true);
		expect(group.displayName).toBe('Wild Shape');
		expect(group.features.map((f) => f.uuid)).toEqual([
			'Item.wild-shape-world',
			'Compendium.nimble.class-features.Item.wild-shape-comp',
		]);
	});

	it('clusters a renamed world copy with its compendium original via compendium source', async () => {
		const compendiumUuid = 'Compendium.nimble.class-features.Item.rage-original';
		const index = mockResolvedFeatures('berserker', 1, [
			{
				uuid: 'Item.homebrew-rage',
				name: 'Homebrew Rage',
				group: 'ungrouped',
				compendiumSource: compendiumUuid,
			},
			{ uuid: compendiumUuid, name: 'Rage', group: 'ungrouped' },
		]);

		const result = await getClassFeaturesFromIndex(index, 'berserker', 1);

		expect(result.autoGrant).toEqual([]);
		expect(result.selectionGroups.size).toBe(1);

		const group = [...result.selectionGroups.values()][0];
		expect(group.isDuplicateChoice).toBe(true);
		expect(group.features.map((f) => f.uuid)).toEqual(['Item.homebrew-rage', compendiumUuid]);
	});

	it('flags named selection groups that contain duplicate-source candidates', async () => {
		const index = mockResolvedFeatures('fighter', 1, [
			{ uuid: 'Item.cleave-world', name: 'Cleave', group: 'combat-maneuvers' },
			{
				uuid: 'Compendium.nimble.class-features.Item.cleave-comp',
				name: 'Cleave',
				group: 'combat-maneuvers',
			},
			{ uuid: 'Item.parry', name: 'Parry', group: 'combat-maneuvers' },
		]);

		const result = await getClassFeaturesFromIndex(index, 'fighter', 1);

		const group = result.selectionGroups.get('combat-maneuvers');
		expect(group?.showSourceLabel).toBe(true);
		expect(group?.selectionCount).toBe(1);
		expect(group?.isDuplicateChoice).toBeUndefined();
		expect(group?.features).toHaveLength(3);
	});
});
