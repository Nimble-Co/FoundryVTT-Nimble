import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SpellCostActorLike } from '#types/spellCost.d.ts';
import { NimbleBaseActor } from '../../../documents/actor/base.svelte.js';
import { FreeSpellCostRule } from '../../../models/rules/freeSpellCost.js';
import { paySpellCost } from '../paySpellCost.js';
import { resolveSpellCost } from '../spellCost.js';

const POOL = 'pilfered-power';

function setResourceSpendingAutomation(enabled: boolean): void {
	(
		globalThis as unknown as { game: { settings?: { get: ReturnType<typeof vi.fn> } } }
	).game.settings = { get: vi.fn(() => enabled) };
}

/** A rule on an effect on a creature, as the effect's rules manager makes it. */
function freeRule(poolIdentifier = POOL, disabled = false): FreeSpellCostRule {
	const holder = Object.setPrototypeOf({ getDomain: () => new Set<string>() }, Actor.prototype);
	const effect = {
		documentName: 'ActiveEffect',
		uuid: 'Actor.hero.ActiveEffect.e',
		parent: holder,
		target: holder,
		origin: null,
	};
	const rule = new FreeSpellCostRule(
		{ id: 'free-rule', type: 'freeSpellCost', poolIdentifier, disabled } as never,
		{ parent: effect as unknown as foundry.abstract.DataModel.Any, strict: false },
	);
	rule.type = 'freeSpellCost';
	rule.poolIdentifier = poolIdentifier;
	rule.disabled = disabled;
	Object.defineProperty(rule, 'predicate', {
		get: () => ({ size: 0, test: () => true }),
		configurable: true,
	});
	Object.defineProperty(rule, 'parent', { get: () => effect, configurable: true });
	return rule;
}

/** The rules the actor reads: those of the effects that change it now, with no disabled rule. */
function preparedRules(effects: { rules: FreeSpellCostRule[]; modifiesActor?: boolean }[]) {
	const stub = {
		items: { contents: [] },
		*allApplicableEffects() {
			for (const effect of effects) {
				yield {
					rules: new Map(effect.rules.map((rule, index) => [String(index), rule])),
					modifiesActor: effect.modifiesActor ?? true,
				};
			}
		},
	};
	const prepare = (
		NimbleBaseActor.prototype as unknown as { prepareRules(this: unknown): unknown[] }
	).prepareRules;
	return prepare.call(stub);
}

/** A caster whose one class pays tiered spells from a charge pool, with that pool on the class. */
function createCaster(options: {
	current?: number;
	poolIdentifier?: string;
	overdraftConsequence?: string;
	mana?: number;
	rules?: unknown[];
	withPoolClass?: boolean;
}) {
	const poolIdentifier = options.poolIdentifier ?? POOL;
	const flags = {
		nimble: {
			chargePools: { [poolIdentifier]: { current: options.current ?? 0, max: 3 } } as Record<
				string,
				unknown
			>,
		},
	};
	const classItem = {
		id: 'class-1',
		name: 'Test Class',
		type: 'class',
		system: {
			spellcasting: {
				castAtHighestTier: false,
				cost: {
					poolIdentifier,
					amount: '1',
					overdraftConsequence: options.overdraftConsequence ?? 'halfMaxHpDamage',
				},
			},
		},
		rules: new Map([
			[
				'0',
				{
					type: 'chargePool',
					id: 'pool-rule',
					identifier: poolIdentifier,
					label: 'Test Pool',
					scope: 'item',
					max: '3',
					initial: 'max',
					recoveries: [],
				},
			],
		]),
		flags,
		update: vi.fn(async () => ({})),
	};
	const actor = {
		type: 'character',
		system: {
			resources: { mana: { current: options.mana ?? 0, max: options.mana ?? 0 } },
			attributes: { hp: { max: 20 } },
		},
		items: {
			contents: options.withPoolClass === false ? [] : [classItem],
			get: () => classItem,
		},
		flags: { nimble: { chargePools: {} } },
		rules: options.rules ?? [],
		getRollData: () => ({}),
		getFlag: () => undefined,
		update: vi.fn(async () => ({})),
		applyDamage: vi.fn(async () => undefined),
	};
	return { actor: actor as typeof actor & SpellCostActorLike, classItem };
}

const tiered = { system: { tier: 2 } };
const cantrip = { system: { tier: 0 } };

beforeEach(() => setResourceSpendingAutomation(true));

afterEach(() => {
	(globalThis as unknown as { game: { settings?: unknown } }).game.settings = undefined;
});

describe('a free spell cost', () => {
	it('makes a pool cost 0, with no pool change, no overdraw ask and no overdraw damage', async () => {
		const { actor, classItem } = createCaster({ current: 0, rules: [freeRule()] });
		const confirmOverdraft = vi.fn(() => true);

		const cost = resolveSpellCost(actor, tiered);
		const payment = await paySpellCost(actor, cost, { confirmOverdraft });

		expect(cost).toMatchObject({ type: 'pool', poolIdentifier: POOL, amount: 0 });
		expect(payment).toMatchObject({ paid: true });
		expect(payment.overdrawn).toBeUndefined();
		expect(payment.receipt?.paid.charges).toBe(0);
		expect(confirmOverdraft).not.toHaveBeenCalled();
		expect(actor.applyDamage).not.toHaveBeenCalled();
		expect(classItem.update).not.toHaveBeenCalled();
		expect(actor.update).not.toHaveBeenCalled();
	});

	it('does not change a cost from another pool', async () => {
		const { actor, classItem } = createCaster({
			current: 2,
			poolIdentifier: 'stolen-power',
			rules: [freeRule(POOL)],
		});

		const cost = resolveSpellCost(actor, tiered);
		await paySpellCost(actor, cost, { confirmOverdraft: () => true });

		expect(cost).toMatchObject({ type: 'pool', amount: 1 });
		expect(classItem.update).toHaveBeenCalled();
	});

	it('makes a cost from any pool free when its pool is blank', () => {
		const { actor } = createCaster({
			current: 2,
			poolIdentifier: 'stolen-power',
			rules: [freeRule('')],
		});

		expect(resolveSpellCost(actor, tiered)).toMatchObject({ type: 'pool', amount: 0 });
	});

	it('leaves a cantrip at no cost', () => {
		const { actor } = createCaster({ current: 0, rules: [freeRule()] });

		expect(resolveSpellCost(actor, cantrip)).toEqual({ type: 'none' });
	});

	it('does not change a mana cost', () => {
		const { actor } = createCaster({ mana: 5, rules: [freeRule('')], withPoolClass: false });

		expect(resolveSpellCost(actor, tiered)).toEqual({ type: 'mana', amount: 2 });
	});

	it('does not count a disabled rule', () => {
		const disabled = freeRule(POOL, true);
		const fromPrepared = createCaster({
			current: 2,
			rules: preparedRules([{ rules: [disabled] }]),
		});
		const unfiltered = createCaster({ current: 2, rules: [disabled] });

		expect(resolveSpellCost(fromPrepared.actor, tiered)).toMatchObject({ amount: 1 });
		expect(resolveSpellCost(unfiltered.actor, tiered)).toMatchObject({ amount: 1 });
	});

	it('does not count the rule of a disabled effect', () => {
		const { actor } = createCaster({
			current: 2,
			rules: preparedRules([{ rules: [freeRule()], modifiesActor: false }]),
		});

		expect(resolveSpellCost(actor, tiered)).toMatchObject({ amount: 1 });
	});

	it('counts the rule of an effect that changes the creature', () => {
		const { actor } = createCaster({
			current: 2,
			rules: preparedRules([{ rules: [freeRule()] }]),
		});

		expect(resolveSpellCost(actor, tiered)).toMatchObject({ amount: 0 });
	});

	it('does not depend on the automation settings, as the cost does not', () => {
		setResourceSpendingAutomation(false);
		const { actor } = createCaster({ current: 2, rules: [freeRule()] });

		expect(resolveSpellCost(actor, tiered)).toMatchObject({ amount: 0 });
	});
});
