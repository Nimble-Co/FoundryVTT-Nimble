import { describe, expect, it } from 'vitest';
import { SYSTEM_ID } from '#system';
import { Migration094MonsterConditions } from '../migrations/Migration094MonsterConditions.js';

const GREAT_WORM = 'Compendium.nimble.nimble-monsters.Actor.lQ83gZRlm3bTgsbp';
const SWALLOWED_ITEM = `${GREAT_WORM}.Item.Zp4cNwRt9LkGvHqD`;

function migration(): Migration094MonsterConditions {
	return new Migration094MonsterConditions();
}

function actor(extra: Record<string, unknown> = {}) {
	return { name: 'Hero', items: [], ...extra };
}

describe('Migration094MonsterConditions', () => {
	it('gives a live Swallowed effect cannot-miss and ignore-armor, beside the rules it has', async () => {
		const effect = {
			statuses: ['swallowed'],
			system: { rules: [{ id: 'swallowedDamage', type: 'turnDamage' }] } as {
				rules: Record<string, unknown>[];
				lastsUntil?: unknown;
			},
		};

		await migration().alwaysUpdateEffect(effect, actor());
		await migration().alwaysUpdateEffect(effect, actor());

		expect(effect.system.rules).toEqual([
			{ id: 'swallowedDamage', type: 'turnDamage' },
			{
				id: 'swallowedAttacks',
				type: 'attackOutcome',
				side: 'yourAttacks',
				cannotMiss: true,
				ignoreArmor: true,
			},
		]);
		expect(effect.system.lastsUntil).toBeUndefined();
	});

	it('gives a live Latched effect its attacks, its end, and the creature the actor holds', async () => {
		const effect: {
			statuses: string[];
			system: { rules: { id: string; type: string }[]; lastsUntil?: unknown };
			flags?: Record<string, Record<string, unknown>>;
		} = { statuses: ['latched'], system: { rules: [] } };
		const stirge = actor({
			flags: { [SYSTEM_ID]: { heldCreature: { uuid: 'Actor.hero', name: 'Hero' } } },
		});

		await migration().alwaysUpdateEffect(effect, stirge);

		expect(effect.system.rules).toEqual([
			{
				id: 'latchedAttacks',
				type: 'attackOutcome',
				side: 'yourAttacks',
				cannotMiss: true,
			},
		]);
		expect(effect.system.lastsUntil).toEqual([
			expect.objectContaining({ kind: 'event', event: 'die', who: 'holder' }),
			expect.objectContaining({ kind: 'event', event: 'die', who: 'linked' }),
		]);
		expect(effect.flags?.[SYSTEM_ID]?.linkedActorUuid).toBe('Actor.hero');
	});

	it('leaves a Latched effect that already ends, and already names its creature', async () => {
		const lastsUntil = [{ kind: 'event', event: 'rest', who: 'holder' }];
		const effect = {
			statuses: ['latched'],
			system: {
				rules: [{ id: 'latchedAttacks', type: 'attackOutcome' }],
				lastsUntil,
			},
			flags: { [SYSTEM_ID]: { linkedActorUuid: 'Actor.kept' } },
		};

		await migration().alwaysUpdateEffect(
			effect,
			actor({ flags: { [SYSTEM_ID]: { heldCreature: { uuid: 'Actor.other', name: 'Other' } } } }),
		);

		expect(effect.system.rules).toEqual([{ id: 'latchedAttacks', type: 'attackOutcome' }]);
		expect(effect.system.lastsUntil).toBe(lastsUntil);
		expect(effect.flags[SYSTEM_ID].linkedActorUuid).toBe('Actor.kept');
	});

	it('does not change an effect stored on an item', async () => {
		const effect = { statuses: ['swallowed'], system: { rules: [] } };

		await migration().alwaysUpdateEffect(effect, { name: 'Bite/Swallow.', type: 'monsterFeature' });

		expect(effect.system.rules).toEqual([]);
	});

	it('removes the old cannot-miss rule from a stirge feature, and leaves the rest', async () => {
		const item = {
			name: 'Latched On.',
			type: 'monsterFeature',
			system: {
				rules: [
					{ id: 'latchedCannotMis', type: 'attackOutcome' },
					{ id: 'keep', type: 'hitCondition' },
				],
			},
		};

		await migration().updateItem(item);
		await migration().updateItem(item);

		expect(item.system.rules).toEqual([{ id: 'keep', type: 'hitCondition' }]);
	});

	it('gives a Great Worm the Swallowed. feature once, including a dev-build source id', async () => {
		const worm = {
			name: 'Renamed',
			items: [] as { name?: string; _stats?: { compendiumSource?: string } }[],
			_stats: { compendiumSource: 'Compendium.nimble-dev.nimble-monsters.Actor.lQ83gZRlm3bTgsbp' },
		};

		await migration().updateActor(worm);
		await migration().updateActor(worm);

		expect(worm.items).toHaveLength(1);
		expect(worm.items[0]?.name).toBe('Swallowed.');
		expect(worm.items[0]?._stats?.compendiumSource).toBe(SWALLOWED_ITEM);
	});

	it('gives a Great Worm with no source id the feature, and not a different compendium actor of that name', async () => {
		const madeByHand = { name: 'Great Worm', items: [] as unknown[] };
		const other = {
			name: 'Great Worm',
			items: [] as unknown[],
			flags: { core: { sourceId: 'Compendium.nimble.nimble-monsters.Actor.someoneElse' } },
		};

		await migration().updateActor(madeByHand);
		await migration().updateActor(other);

		expect(madeByHand.items).toHaveLength(1);
		expect(other.items).toEqual([]);
	});

	it('does not give a Great Worm a second Swallowed. feature', async () => {
		const worm = {
			name: 'Great Worm',
			items: [{ name: 'Swallowed', type: 'monsterFeature', system: {} }],
			_stats: { compendiumSource: GREAT_WORM },
		};

		await migration().updateActor(worm);

		expect(worm.items).toHaveLength(1);
	});
});
