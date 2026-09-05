import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Migration048PoolMaxBonusItems } from './Migration048PoolMaxBonusItems.js';

const MAX_COMBAT_DIE_ITEM_ID = 'WnKpJ8RvCb4mX2Qt';

interface ActorSource {
	type: string;
	name: string;
	items: Record<string, unknown>[];
	system: { levelUpHistory: Record<string, unknown>[] };
}

/** The single cosmetic item the old design embedded, renamed to show a running total. */
function legacyBonusItem(name = '+1 Max Combat Die') {
	return {
		_id: 'legacy-item-id',
		name,
		type: 'feature',
		system: {
			rules: [],
			description: `<p>Gain ${name.slice(0, 2)} to your maximum Combat Dice.</p>`,
		},
		_stats: {
			compendiumSource: `Compendium.nimble.nimble-class-features.Item.${MAX_COMBAT_DIE_ITEM_ID}`,
		},
	};
}

function createActor(
	history: Record<string, unknown>[],
	items: Record<string, unknown>[] = [],
): ActorSource {
	return { type: 'character', name: 'Test Commander', items, system: { levelUpHistory: history } };
}

function bonusItemsOf(actor: ActorSource) {
	return actor.items.filter((item) => {
		const rules = (item.system as { rules?: Record<string, unknown>[] })?.rules ?? [];
		return rules.some((rule) => rule.type === 'poolMaxBonus');
	});
}

describe('Migration048PoolMaxBonusItems.updateActor', () => {
	let migration: Migration048PoolMaxBonusItems;

	beforeEach(() => {
		migration = new Migration048PoolMaxBonusItems();
	});

	it('creates one granted item per point of recorded bonus', async () => {
		const actor = createActor([
			{ level: 6, grantedFeatureIds: [], poolMaxBonuses: { 'combat-dice': 1 } },
			{ level: 8, grantedFeatureIds: [], poolMaxBonuses: { 'combat-dice': 2 } },
		]);

		await migration.updateActor(actor as unknown as Record<string, unknown>);

		expect(bonusItemsOf(actor)).toHaveLength(3);
	});

	it('records each new item against the level that granted it', async () => {
		const actor = createActor([
			{ level: 6, grantedFeatureIds: [], poolMaxBonuses: { 'combat-dice': 1 } },
			{ level: 8, grantedFeatureIds: [], poolMaxBonuses: { 'combat-dice': 2 } },
		]);

		await migration.updateActor(actor as unknown as Record<string, unknown>);

		const [levelSix, levelEight] = actor.system.levelUpHistory as Array<{
			grantedFeatureIds: string[];
		}>;
		expect(levelSix.grantedFeatureIds).toHaveLength(1);
		expect(levelEight.grantedFeatureIds).toHaveLength(2);

		// Every recorded id resolves to an item the actor actually owns, so level down can
		// still delete exactly what the entry names.
		const ownedIds = new Set(actor.items.map((item) => item._id));
		for (const id of [...levelSix.grantedFeatureIds, ...levelEight.grantedFeatureIds]) {
			expect(ownedIds.has(id)).toBe(true);
		}
	});

	it('clears the numeric record so the bonus has one source', async () => {
		const actor = createActor([
			{ level: 6, grantedFeatureIds: [], poolMaxBonuses: { 'combat-dice': 1 } },
		]);

		await migration.updateActor(actor as unknown as Record<string, unknown>);

		expect((actor.system.levelUpHistory[0] as { poolMaxBonuses: unknown }).poolMaxBonuses).toEqual(
			{},
		);
	});

	it('replaces the single renamed cosmetic item rather than keeping it alongside', async () => {
		const actor = createActor(
			[{ level: 6, grantedFeatureIds: ['legacy-item-id'], poolMaxBonuses: { 'combat-dice': 2 } }],
			[legacyBonusItem('+2 Max Combat Dice')],
		);

		await migration.updateActor(actor as unknown as Record<string, unknown>);

		expect(actor.items.some((item) => item._id === 'legacy-item-id')).toBe(false);
		expect(bonusItemsOf(actor)).toHaveLength(2);
		// The stale id must not survive in history, or level down would try to delete a ghost.
		expect(
			(actor.system.levelUpHistory[0] as { grantedFeatureIds: string[] }).grantedFeatureIds,
		).not.toContain('legacy-item-id');
	});

	it('leaves unrelated granted ids in place', async () => {
		const actor = createActor([
			{ level: 6, grantedFeatureIds: ['some-feature'], poolMaxBonuses: { 'combat-dice': 1 } },
		]);

		await migration.updateActor(actor as unknown as Record<string, unknown>);

		expect(
			(actor.system.levelUpHistory[0] as { grantedFeatureIds: string[] }).grantedFeatureIds,
		).toContain('some-feature');
	});

	it('does nothing to an actor with no recorded bonuses', async () => {
		const actor = createActor([{ level: 6, grantedFeatureIds: ['x'], poolMaxBonuses: {} }]);
		const before = structuredClone(actor);

		await migration.updateActor(actor as unknown as Record<string, unknown>);

		expect(actor).toEqual(before);
	});

	it('warns and drops a bonus for a pool with no known granted item', async () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
		const actor = createActor([
			{ level: 6, grantedFeatureIds: [], poolMaxBonuses: { 'homebrew-pool': 1 } },
		]);

		await migration.updateActor(actor as unknown as Record<string, unknown>);

		expect(bonusItemsOf(actor)).toHaveLength(0);
		expect(warn).toHaveBeenCalledWith(expect.stringContaining('homebrew-pool'));
		warn.mockRestore();
	});
});

describe('Migration048PoolMaxBonusItems.updateItem', () => {
	let migration: Migration048PoolMaxBonusItems;

	beforeEach(() => {
		migration = new Migration048PoolMaxBonusItems();
	});

	it('rewrites a levelUpOption poolMaxBonus rule into a grantItem rule', async () => {
		const uuid = `Compendium.nimble.nimble-class-features.Item.${MAX_COMBAT_DIE_ITEM_ID}`;
		const item = {
			type: 'feature',
			name: 'Fit for Any Battlefield',
			system: {
				levelUpOptions: [
					{
						id: 'max-combat-die',
						rules: [
							{
								type: 'poolMaxBonus',
								poolIdentifier: 'combat-dice',
								amount: 1,
								grantItemUuid: uuid,
							},
						],
					},
				],
			},
		};

		await migration.updateItem(item as unknown as Record<string, unknown>);

		const [rule] = item.system.levelUpOptions[0].rules as Record<string, unknown>[];
		expect(rule.type).toBe('grantItem');
		expect(rule.uuid).toBe(uuid);
		expect(rule.allowDuplicate).toBe(true);
	});

	it('leaves sibling option rules untouched', async () => {
		const item = {
			type: 'feature',
			name: 'Fit for Any Battlefield',
			system: {
				levelUpOptions: [{ id: 'combat-tactic', rules: [{ type: 'note', text: 'keep me' }] }],
			},
		};

		await migration.updateItem(item as unknown as Record<string, unknown>);

		expect(item.system.levelUpOptions[0].rules).toEqual([{ type: 'note', text: 'keep me' }]);
	});
});
