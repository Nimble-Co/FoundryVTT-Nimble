import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SYSTEM_ID } from '#system';
import { Predicate } from '../../../etc/Predicate.js';
import { DefendOptionRule } from '../../../models/rules/defendOption.js';
import { payCost } from '../../cost/costLedger.js';
import { canPayUseCost } from '../../cost/useCost.js';
import { consumeOnResolvedItemUse, validateItemChargeConsumption } from '../chargePoolConsume.js';

const globals = globalThis as Record<string, unknown>;
const BURST = 'packs/classFeatures/core/zephyr/zephyr-progression/burst-of-speed.json';

/** A Zephyr with Burst of Speed and 3 Bursts, its flags kept as `update` writes them. */
function zephyr() {
	const data = JSON.parse(readFileSync(resolve(BURST), 'utf8'));
	const item: Record<string, unknown> = {
		id: 'burst',
		uuid: 'Actor.zephyr.Item.burst',
		name: data.name,
		type: 'feature',
		flags: {
			[SYSTEM_ID]: {
				chargePools: { 'burst-of-speed': { current: 3, max: 99, seeded: true } },
			},
		},
		update: vi.fn(async (changes: Record<string, unknown>) => {
			for (const [path, value] of Object.entries(changes)) {
				foundry.utils.setProperty(item, path, value);
			}
		}),
	};
	const actor: Record<string, unknown> = {
		uuid: 'Actor.zephyr',
		type: 'character',
		system: { levelUpHistory: [] },
		items: { contents: [item], get: (id: string) => (id === 'burst' ? item : undefined) },
		flags: {},
		getDomain: () => new Set<string>(),
		getRollData: () => ({ dexterity: 3 }),
		getFlag: (scope: string, key: string) =>
			(actor.flags as Record<string, Record<string, unknown>>)[scope]?.[key],
		update: vi.fn(async (changes: Record<string, unknown>) => {
			for (const [path, value] of Object.entries(changes)) {
				foundry.utils.setProperty(actor, path, value);
			}
		}),
	};
	item.actor = actor;
	const rules: Record<string, unknown>[] = (data.system.rules as Record<string, unknown>[]).map(
		(rule) => ({ ...rule, appliesTo: () => true }),
	);
	item.rules = new Map(rules.map((rule, index) => [String(index), rule]));
	actor.rules = rules;

	const defendData = rules.find((rule) => rule.label === 'Slipstream');
	const defend = new DefendOptionRule({ type: 'defendOption' } as never, {
		parent: item as never,
		strict: false,
	});
	// The charge is left out, so the cost spends only the turn use.
	Object.assign(defend, { ...defendData, predicate: new Predicate({}), chargePoolIdentifier: '' });
	Object.defineProperty(defend, 'parent', { get: () => item, configurable: true });

	return { actor, item, defendCost: defend.optionCost };
}

describe('the 1/turn use of an item, shared with its 1/turn Defend options', () => {
	let saved: Record<string, unknown>;

	beforeEach(() => {
		const game = globals.game as Record<string, unknown>;
		saved = { combat: game.combat, settings: game.settings };
		game.combat = { id: 'c1', started: true, round: 2, turn: 1 };
		game.settings = { get: () => true };
	});

	afterEach(() => {
		const game = globals.game as Record<string, unknown>;
		game.combat = saved.combat;
		game.settings = saved.settings;
	});

	it('the Defend option and the item use the same turn use', () => {
		const { item, defendCost } = zephyr();
		expect(defendCost.turnUseKey).toBe(`${item.uuid}:oncePerTurn`);
	});

	it('after the item is used, its 1/turn Defend option cannot be used that turn', async () => {
		const { actor, item, defendCost } = zephyr();
		expect(canPayUseCost(actor as never, defendCost)).toBe(true);

		const used = await consumeOnResolvedItemUse(item as never);

		expect(used.ok).toBe(true);
		expect(used.consumption).toEqual([
			expect.objectContaining({ previousValue: 3, currentValue: 2 }),
		]);
		expect(canPayUseCost(actor as never, defendCost)).toBe(false);
		expect(await payCost(actor as never, defendCost)).toBeNull();
	});

	it('after the 1/turn Defend option is used, the item cannot be used that turn', async () => {
		const { actor, item, defendCost } = zephyr();
		expect(validateItemChargeConsumption(item as never).ok).toBe(true);

		expect(await payCost(actor as never, defendCost)).not.toBeNull();

		expect(validateItemChargeConsumption(item as never)).toMatchObject({
			ok: false,
			failure: { code: 'usedThisTurn' },
		});
	});

	it('the item is used again on the next turn', async () => {
		const { item } = zephyr();
		await consumeOnResolvedItemUse(item as never);
		expect(validateItemChargeConsumption(item as never).ok).toBe(false);

		(globals.game as Record<string, unknown>).combat = {
			id: 'c1',
			started: true,
			round: 2,
			turn: 2,
		};

		expect(validateItemChargeConsumption(item as never).ok).toBe(true);
	});

	it('outside combat there is no limit', async () => {
		(globals.game as Record<string, unknown>).combat = null;
		const { item } = zephyr();

		await consumeOnResolvedItemUse(item as never);

		expect(validateItemChargeConsumption(item as never).ok).toBe(true);
	});
});
