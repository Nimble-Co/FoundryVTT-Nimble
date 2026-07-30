import { afterEach, describe, expect, it, vi } from 'vitest';

import type { NimbleFeatureItem } from '#documents/item/feature.js';
import getClassFeaturesFromIndex, {
	type ClassFeatureIndex,
	DUPLICATE_SOURCE_GROUP_PREFIX,
} from './getClassFeatures.ts';

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
		// Mirrors NimbleBaseItem's `sourceId` accessor, which resolves the compendium-source link.
		sourceId: compendiumSource,
	} as NimbleFeatureItem;
}

interface FeatureEntryFixture {
	uuid: string;
	name: string;
	group: string;
	compendiumSource?: string;
	selectionCountByLevel?: Record<string, number>;
}

/**
 * Builds a single-level, single-class index for the given entries and **installs a
 * `globalThis.fromUuid` mock** that resolves each entry to a feature document. Relies on the
 * `afterEach` below to restore the original global.
 */
function indexFeaturesWithFromUuidMock(
	classIdentifier: string,
	level: number,
	entries: FeatureEntryFixture[],
): ClassFeatureIndex {
	const index: ClassFeatureIndex = new Map([
		[
			classIdentifier,
			new Map([
				[
					level,
					entries.map(({ uuid, group, selectionCountByLevel }) => ({
						uuid,
						group,
						selectionCountByLevel: selectionCountByLevel ?? {},
					})),
				],
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

/** Duplicate-source promotion is opt-in; the class sheet reads the same data without it. */
const PROMOTE = { promoteDuplicateSources: true } as const;

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
		const index = indexFeaturesWithFromUuidMock('fighter', 3, [
			{ uuid: 'Item.fighter-feat-one', name: 'Feat One', group: 'fighter-feats' },
			{ uuid: 'Item.fighter-feat-two', name: 'Feat Two', group: 'fighter-feats' },
		]);

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
		const index = indexFeaturesWithFromUuidMock('ranger', 1, [
			{
				uuid: 'Item.ranger-class-progression',
				name: 'Ranger Progression',
				group: 'ranger-progression',
			},
		]);

		const result = await getClassFeaturesFromIndex(index, 'ranger', 1);

		expect(result.autoGrant).toEqual([
			expect.objectContaining({ uuid: 'Item.ranger-class-progression' }),
		]);
		expect(result.selectionGroups.size).toBe(0);
	});

	it('auto-grants distinct ungrouped features without creating a selection group', async () => {
		const index = indexFeaturesWithFromUuidMock('wizard', 2, [
			{ uuid: 'Item.arcane-recovery', name: 'Arcane Recovery', group: 'ungrouped' },
			{ uuid: 'Item.spell-mastery', name: 'Spell Mastery', group: 'ungrouped' },
		]);

		const result = await getClassFeaturesFromIndex(index, 'wizard', 2, PROMOTE);

		expect(result.selectionGroups.size).toBe(0);
		expect(result.autoGrant.map((f) => f.uuid)).toEqual([
			'Item.arcane-recovery',
			'Item.spell-mastery',
		]);
	});

	it('promotes same-named auto-grant duplicates into a single "choose one or keep all" group', async () => {
		const index = indexFeaturesWithFromUuidMock('druid', 2, [
			{ uuid: 'Item.wild-shape-world', name: 'Wild Shape', group: 'ungrouped' },
			{
				uuid: 'Compendium.nimble.nimble-class-features.Item.wild-shape-comp',
				name: 'Wild Shape',
				group: 'ungrouped',
			},
		]);

		const result = await getClassFeaturesFromIndex(index, 'druid', 2, PROMOTE);

		expect(result.autoGrant).toEqual([]);
		expect(result.selectionGroups.size).toBe(1);

		const [groupKey, group] = [...result.selectionGroups.entries()][0];
		expect(groupKey).toBe(`${DUPLICATE_SOURCE_GROUP_PREFIX}Item.wild-shape-world`);
		expect(group.selectionCount).toBe(1);
		expect(group.selectionMax).toBe(2);
		expect(group.showSourceLabel).toBe(true);
		expect(group.displayName).toBe('Wild Shape');
		expect(group.features.map((f) => f.uuid)).toEqual([
			'Item.wild-shape-world',
			'Compendium.nimble.nimble-class-features.Item.wild-shape-comp',
		]);
	});

	it('leaves duplicates auto-granted when duplicate-source promotion is not requested', async () => {
		const index = indexFeaturesWithFromUuidMock('druid', 2, [
			{ uuid: 'Item.wild-shape-world', name: 'Wild Shape', group: 'ungrouped' },
			{
				uuid: 'Compendium.nimble.nimble-class-features.Item.wild-shape-comp',
				name: 'Wild Shape',
				group: 'ungrouped',
			},
		]);

		const result = await getClassFeaturesFromIndex(index, 'druid', 2);

		expect(result.selectionGroups.size).toBe(0);
		expect(result.autoGrant.map((f) => f.uuid)).toEqual([
			'Item.wild-shape-world',
			'Compendium.nimble.nimble-class-features.Item.wild-shape-comp',
		]);
	});

	it('matches duplicate names case- and whitespace-insensitively', async () => {
		const index = indexFeaturesWithFromUuidMock('druid', 2, [
			{ uuid: 'Item.wild-shape-a', name: 'Wild Shape', group: 'ungrouped' },
			{ uuid: 'Item.wild-shape-b', name: '  wild shape  ', group: 'ungrouped' },
		]);

		const result = await getClassFeaturesFromIndex(index, 'druid', 2, PROMOTE);

		expect(result.autoGrant).toEqual([]);
		expect([...result.selectionGroups.values()][0].selectionMax).toBe(2);
	});

	it('never clusters features by name when their names are blank', async () => {
		const index = indexFeaturesWithFromUuidMock('druid', 2, [
			{ uuid: 'Item.nameless-a', name: '', group: 'ungrouped' },
			{ uuid: 'Item.nameless-b', name: '   ', group: 'ungrouped' },
		]);

		const result = await getClassFeaturesFromIndex(index, 'druid', 2, PROMOTE);

		expect(result.selectionGroups.size).toBe(0);
		expect(result.autoGrant.map((f) => f.uuid)).toEqual(['Item.nameless-a', 'Item.nameless-b']);
	});

	it('treats a blank compendium source as no link rather than a shared one', async () => {
		const index = indexFeaturesWithFromUuidMock('druid', 2, [
			{ uuid: 'Item.alpha', name: 'Alpha', group: 'ungrouped', compendiumSource: '' },
			{ uuid: 'Item.beta', name: 'Beta', group: 'ungrouped', compendiumSource: '' },
		]);

		const result = await getClassFeaturesFromIndex(index, 'druid', 2, PROMOTE);

		expect(result.selectionGroups.size).toBe(0);
		expect(result.autoGrant.map((f) => f.uuid)).toEqual(['Item.alpha', 'Item.beta']);
	});

	it('clusters a renamed world copy with its compendium original via compendium source', async () => {
		const compendiumUuid = 'Compendium.nimble.nimble-class-features.Item.rage-original';
		const index = indexFeaturesWithFromUuidMock('berserker', 1, [
			{
				uuid: 'Item.homebrew-rage',
				name: 'Homebrew Rage',
				group: 'ungrouped',
				compendiumSource: compendiumUuid,
			},
			{ uuid: compendiumUuid, name: 'Rage', group: 'ungrouped' },
		]);

		const result = await getClassFeaturesFromIndex(index, 'berserker', 1, PROMOTE);

		expect(result.autoGrant).toEqual([]);
		expect(result.selectionGroups.size).toBe(1);

		const group = [...result.selectionGroups.values()][0];
		expect(group.showSourceLabel).toBe(true);
		expect(group.selectionMax).toBe(2);
		// The heading follows the first-listed copy, which is the renamed world item here.
		expect(group.displayName).toBe('Homebrew Rage');
		expect(group.features.map((f) => f.uuid)).toEqual(['Item.homebrew-rage', compendiumUuid]);
	});

	it('clusters the compendium original with a renamed world copy listed after it', async () => {
		const compendiumUuid = 'Compendium.nimble.nimble-class-features.Item.rage-original';
		const index = indexFeaturesWithFromUuidMock('berserker', 1, [
			{ uuid: compendiumUuid, name: 'Rage', group: 'ungrouped' },
			{
				uuid: 'Item.homebrew-rage',
				name: 'Homebrew Rage',
				group: 'ungrouped',
				compendiumSource: compendiumUuid,
			},
		]);

		const result = await getClassFeaturesFromIndex(index, 'berserker', 1, PROMOTE);

		expect(result.autoGrant).toEqual([]);
		const group = [...result.selectionGroups.values()][0];
		expect(group.displayName).toBe('Rage');
		expect(group.features.map((f) => f.uuid)).toEqual([compendiumUuid, 'Item.homebrew-rage']);
	});

	it('clusters two world copies that descend from the same compendium original', async () => {
		const compendiumUuid = 'Compendium.nimble.nimble-class-features.Item.rage-original';
		const index = indexFeaturesWithFromUuidMock('berserker', 1, [
			{
				uuid: 'Item.rage-tweaked-a',
				name: 'Rage (Houserule A)',
				group: 'ungrouped',
				compendiumSource: compendiumUuid,
			},
			{
				uuid: 'Item.rage-tweaked-b',
				name: 'Rage (Houserule B)',
				group: 'ungrouped',
				compendiumSource: compendiumUuid,
			},
		]);

		const result = await getClassFeaturesFromIndex(index, 'berserker', 1, PROMOTE);

		expect(result.autoGrant).toEqual([]);
		const group = [...result.selectionGroups.values()][0];
		expect(group.selectionMax).toBe(2);
		expect(group.features.map((f) => f.uuid)).toEqual([
			'Item.rage-tweaked-a',
			'Item.rage-tweaked-b',
		]);
	});

	it('merges two separate clusters when a later feature bridges them', async () => {
		// 'Fury' links to the compendium original by source; 'Rage' matches the third copy by name.
		// The third feature matches both, so the two clusters must fold into one.
		const compendiumUuid = 'Compendium.nimble.nimble-class-features.Item.rage-original';
		const index = indexFeaturesWithFromUuidMock('berserker', 1, [
			{ uuid: 'Item.rage-renamed', name: 'Rage', group: 'ungrouped' },
			{ uuid: 'Item.fury', name: 'Fury', group: 'ungrouped', compendiumSource: compendiumUuid },
			{ uuid: compendiumUuid, name: 'Rage', group: 'ungrouped' },
		]);

		const result = await getClassFeaturesFromIndex(index, 'berserker', 1, PROMOTE);

		expect(result.autoGrant).toEqual([]);
		expect(result.selectionGroups.size).toBe(1);

		const group = [...result.selectionGroups.values()][0];
		expect(group.selectionMax).toBe(3);
		expect(group.features.map((f) => f.uuid).sort()).toEqual(
			[compendiumUuid, 'Item.fury', 'Item.rage-renamed'].sort(),
		);
	});

	it('allows keeping every copy when a feature exists in three sources', async () => {
		const index = indexFeaturesWithFromUuidMock('druid', 2, [
			{ uuid: 'Item.wild-shape-a', name: 'Wild Shape', group: 'ungrouped' },
			{ uuid: 'Item.wild-shape-b', name: 'Wild Shape', group: 'ungrouped' },
			{
				uuid: 'Compendium.nimble.nimble-class-features.Item.wild-shape-comp',
				name: 'Wild Shape',
				group: 'ungrouped',
			},
		]);

		const result = await getClassFeaturesFromIndex(index, 'druid', 2, PROMOTE);

		expect(result.autoGrant).toEqual([]);
		expect(result.selectionGroups.size).toBe(1);

		const group = [...result.selectionGroups.values()][0];
		expect(group.selectionCount).toBe(1);
		expect(group.selectionMax).toBe(3);
		expect(group.features).toHaveLength(3);
	});

	it('promotes duplicates inside a -progression group', async () => {
		const index = indexFeaturesWithFromUuidMock('berserker', 3, [
			{ uuid: 'Item.rage-world', name: 'Rage', group: 'berserker-progression' },
			{
				uuid: 'Compendium.nimble.nimble-class-features.Item.rage-comp',
				name: 'Rage',
				group: 'berserker-progression',
			},
			{ uuid: 'Item.reckless', name: 'Reckless Attack', group: 'berserker-progression' },
		]);

		const result = await getClassFeaturesFromIndex(index, 'berserker', 3, PROMOTE);

		expect(result.autoGrant.map((f) => f.uuid)).toEqual(['Item.reckless']);
		expect(result.selectionGroups.size).toBe(1);
		expect([...result.selectionGroups.values()][0].selectionMax).toBe(2);
	});

	it('names the group after the first named copy when an earlier copy is unnamed', async () => {
		const compendiumUuid = 'Compendium.nimble.nimble-class-features.Item.unnamed-original';
		const index = indexFeaturesWithFromUuidMock('druid', 2, [
			{ uuid: 'Item.unnamed-copy', name: '', group: 'ungrouped', compendiumSource: compendiumUuid },
			{ uuid: compendiumUuid, name: 'Original', group: 'ungrouped' },
		]);

		const result = await getClassFeaturesFromIndex(index, 'druid', 2, PROMOTE);

		const group = [...result.selectionGroups.values()][0];
		expect(group.showSourceLabel).toBe(true);
		// Never fall through to formatting the synthetic key into a heading.
		expect(group.displayName).toBe('Original');
	});

	it('omits displayName only when no copy in the cluster has a name', async () => {
		const compendiumUuid = 'Compendium.nimble.nimble-class-features.Item.unnamed-original';
		const index = indexFeaturesWithFromUuidMock('druid', 2, [
			{ uuid: 'Item.unnamed-copy', name: '', group: 'ungrouped', compendiumSource: compendiumUuid },
			{ uuid: compendiumUuid, name: '', group: 'ungrouped' },
		]);

		const result = await getClassFeaturesFromIndex(index, 'druid', 2, PROMOTE);

		expect([...result.selectionGroups.values()][0].displayName).toBeUndefined();
	});

	it('flags named selection groups that contain duplicate-source candidates', async () => {
		const index = indexFeaturesWithFromUuidMock('fighter', 1, [
			{ uuid: 'Item.cleave-world', name: 'Cleave', group: 'combat-maneuvers' },
			{
				uuid: 'Compendium.nimble.nimble-class-features.Item.cleave-comp',
				name: 'Cleave',
				group: 'combat-maneuvers',
			},
			{ uuid: 'Item.parry', name: 'Parry', group: 'combat-maneuvers' },
		]);

		const result = await getClassFeaturesFromIndex(index, 'fighter', 1, PROMOTE);

		const group = result.selectionGroups.get('combat-maneuvers');
		expect(group?.showSourceLabel).toBe(true);
		expect(group?.selectionCount).toBe(1);
		expect(group?.selectionMax).toBeUndefined();
		expect(group?.features).toHaveLength(3);
	});

	it('keeps the required count when a multi-pick named group contains duplicate sources', async () => {
		const index = indexFeaturesWithFromUuidMock('fighter', 1, [
			{
				uuid: 'Item.cleave-world',
				name: 'Cleave',
				group: 'combat-maneuvers',
				selectionCountByLevel: { '1': 2 },
			},
			{
				uuid: 'Compendium.nimble.nimble-class-features.Item.cleave-comp',
				name: 'Cleave',
				group: 'combat-maneuvers',
			},
			{ uuid: 'Item.parry', name: 'Parry', group: 'combat-maneuvers' },
		]);

		const result = await getClassFeaturesFromIndex(index, 'fighter', 1, PROMOTE);

		const group = result.selectionGroups.get('combat-maneuvers');
		expect(group?.selectionCount).toBe(2);
		expect(group?.showSourceLabel).toBe(true);
		// Named groups stay an exact choice — only duplicate-source groups become a range.
		expect(group?.selectionMax).toBeUndefined();
	});

	it('does not flag source labels on a named group whose candidates are all distinct', async () => {
		const index = indexFeaturesWithFromUuidMock('fighter', 1, [
			{ uuid: 'Item.cleave', name: 'Cleave', group: 'combat-maneuvers' },
			{ uuid: 'Item.parry', name: 'Parry', group: 'combat-maneuvers' },
		]);

		const result = await getClassFeaturesFromIndex(index, 'fighter', 1, PROMOTE);

		expect(result.selectionGroups.get('combat-maneuvers')?.showSourceLabel).toBeUndefined();
	});
});
