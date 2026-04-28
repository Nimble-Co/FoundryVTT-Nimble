import { afterEach, describe, expect, it, vi } from 'vitest';

import type { NimbleFeatureItem } from '#documents/item/feature.js';
import getClassFeaturesFromIndex, { type ClassFeatureIndex } from './getClassFeatures.ts';

const originalFromUuid = (globalThis as unknown as { fromUuid?: unknown }).fromUuid;

function createFeatureItem({ uuid, name }: { uuid: string; name: string }): NimbleFeatureItem {
	return {
		uuid,
		type: 'feature',
		name,
		img: 'icons/svg/item-bag.svg',
		system: {
			description: '',
		},
	} as NimbleFeatureItem;
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
});
