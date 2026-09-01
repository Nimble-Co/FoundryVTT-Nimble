import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SpellCostActorLike } from '#types/spellCost.d.ts';
import {
	applyOverdraftConsequence,
	exceedsUnlockedSpellTier,
	formatSpellCostLabel,
	resolvePinnedCastTier,
	resolveSpellCost,
	synthesizePinnedUpcast,
} from './spellCost.js';
import { spendSpellCost } from './spendSpellCost.js';
import { validateSpellCost } from './validateSpellCost.js';

function setResourceSpendingAutomation(enabled: boolean): void {
	(
		globalThis as unknown as { game: { settings?: { get: ReturnType<typeof vi.fn> } } }
	).game.settings = { get: vi.fn(() => enabled) };
}

type MockRule = Record<string, unknown>;

type MockItem = {
	id: string;
	name: string;
	type: string;
	system: Record<string, unknown>;
	rules: Map<string, MockRule>;
	flags: { nimble: { chargePools: Record<string, unknown> } };
	update: ReturnType<typeof vi.fn>;
};

function applyPoolPayload(
	existing: Record<string, unknown>,
	payload: unknown,
): Record<string, unknown> {
	if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return existing;
	const next = { ...existing };
	for (const [key, value] of Object.entries(payload as Record<string, unknown>)) {
		if (value instanceof foundry.data.operators.ForcedDeletion) {
			delete next[key];
			continue;
		}
		next[key] = value;
	}
	return next;
}

function createMockItem(source: {
	id: string;
	name: string;
	type?: string;
	system?: Record<string, unknown>;
	rules?: MockRule[];
	chargePools?: Record<string, unknown>;
}): MockItem {
	const flags = { nimble: { chargePools: source.chargePools ?? {} } };
	const item: MockItem = {
		id: source.id,
		name: source.name,
		type: source.type ?? 'feature',
		system: source.system ?? {},
		rules: new Map((source.rules ?? []).map((rule, index) => [String(index), rule])),
		flags,
		update: vi.fn(async (changes: Record<string, unknown>) => {
			const payload = changes['flags.nimble.chargePools'];
			flags.nimble.chargePools = applyPoolPayload(flags.nimble.chargePools, payload);
			return {};
		}),
	};
	return item;
}

type MockActor = {
	type: 'character';
	system: Record<string, unknown>;
	items: { contents: MockItem[]; get: (id: string) => MockItem | undefined };
	flags: { nimble: { chargePools: Record<string, unknown> } };
	getRollData: () => Record<string, unknown>;
	getFlag: (scope: string, key: string) => unknown;
	update: ReturnType<typeof vi.fn>;
	applyDamage: ReturnType<typeof vi.fn>;
};

function createMockActor(params: {
	items?: MockItem[];
	mana?: { current: number; max: number };
	hpMax?: number;
	unlockedTier?: number | null;
}): MockActor & SpellCostActorLike {
	const actor: MockActor = {
		type: 'character',
		system: {
			resources: {
				mana: params.mana ?? { current: 0, max: 0 },
				highestUnlockedSpellTier: params.unlockedTier ?? 0,
			},
			attributes: { hp: { max: params.hpMax ?? 0 } },
		},
		items: {
			contents: params.items ?? [],
			get: (id: string) => actor.items.contents.find((item) => item.id === id),
		},
		flags: { nimble: { chargePools: {} } },
		getRollData: () => ({}),
		getFlag: (scope: string, key: string) => {
			if (scope !== 'nimble' || key !== 'chargePools') return undefined;
			return actor.flags.nimble.chargePools;
		},
		update: vi.fn(async (changes: Record<string, unknown>) => {
			const payload = changes['flags.nimble.chargePools'];
			if (payload) {
				actor.flags.nimble.chargePools = applyPoolPayload(actor.flags.nimble.chargePools, payload);
			}
			return actor;
		}),
		applyDamage: vi.fn(async () => undefined),
	};
	return actor as unknown as MockActor & SpellCostActorLike;
}

function createSpell(tier: number) {
	return { system: { tier } };
}

function createPoolClass(options: {
	poolIdentifier?: string;
	amount?: string;
	overdraftConsequence?: string;
	castAtHighestTier?: boolean;
	poolMax?: string;
	poolCurrent?: number;
}): MockItem {
	const identifier = options.poolIdentifier ?? 'stolen-power';
	const item = createMockItem({
		id: 'class-1',
		name: 'Test Class',
		type: 'class',
		system: {
			spellcasting: {
				castAtHighestTier: options.castAtHighestTier ?? false,
				cost: {
					poolIdentifier: identifier,
					amount: options.amount ?? '1',
					overdraftConsequence: options.overdraftConsequence ?? '',
				},
			},
		},
		rules: [
			{
				type: 'chargePool',
				id: 'rule-1',
				identifier,
				label: 'Stolen Power',
				scope: 'item',
				max: options.poolMax ?? '3',
				initial: 'max',
				recoveries: [],
			},
		],
		chargePools:
			options.poolCurrent === undefined
				? {}
				: { [identifier]: { current: options.poolCurrent, max: 3 } },
	});
	return item;
}

beforeEach(() => {
	vi.clearAllMocks();
	setResourceSpendingAutomation(true);
});

afterEach(() => {
	(globalThis as unknown as { game: { settings?: unknown } }).game.settings = undefined;
});

describe('resolveSpellCost', () => {
	it('resolves a cantrip to no cost', () => {
		const actor = createMockActor({});
		expect(resolveSpellCost(actor, createSpell(0))).toEqual({ type: 'none' });
	});

	it('resolves tier in mana for a caster with no class cost declared', () => {
		const actor = createMockActor({ mana: { current: 5, max: 10 } });
		expect(resolveSpellCost(actor, createSpell(3))).toEqual({ type: 'mana', amount: 3 });
	});

	it('charges the chosen cast tier in mana when one is supplied', () => {
		const actor = createMockActor({ mana: { current: 5, max: 10 } });
		expect(resolveSpellCost(actor, createSpell(2), { castTier: 4 })).toEqual({
			type: 'mana',
			amount: 4,
		});
	});

	it('resolves a class-declared pool cost instead of mana', () => {
		const actor = createMockActor({ items: [createPoolClass({})] });
		const cost = resolveSpellCost(actor, createSpell(3));
		expect(cost).toMatchObject({
			type: 'pool',
			poolIdentifier: 'stolen-power',
			amount: 1,
			overdraftConsequence: '',
		});
	});

	it('charges the same pool amount at every cast tier', () => {
		const actor = createMockActor({ items: [createPoolClass({})] });
		for (let castTier = 1; castTier <= 9; castTier += 1) {
			const cost = resolveSpellCost(actor, createSpell(1), { castTier });
			expect(cost).toMatchObject({ type: 'pool', amount: 1 });
		}
	});

	it('resolves the declared amount formula', () => {
		const actor = createMockActor({ items: [createPoolClass({ amount: '2' })] });
		expect(resolveSpellCost(actor, createSpell(1))).toMatchObject({ type: 'pool', amount: 2 });
	});

	it('carries the declared overdraft consequence', () => {
		const actor = createMockActor({
			items: [createPoolClass({ overdraftConsequence: 'halfMaxHpDamage' })],
		});
		expect(resolveSpellCost(actor, createSpell(1))).toMatchObject({
			overdraftConsequence: 'halfMaxHpDamage',
		});
	});

	it('labels the cost with the pool label', () => {
		const actor = createMockActor({ items: [createPoolClass({})] });
		expect(resolveSpellCost(actor, createSpell(1))).toMatchObject({ poolLabel: 'Stolen Power' });
	});
});

describe('resolvePinnedCastTier', () => {
	it('returns null when no class pins the cast tier', () => {
		const actor = createMockActor({ items: [createPoolClass({})], unlockedTier: 4 });
		expect(resolvePinnedCastTier(actor, createSpell(1))).toBeNull();
	});

	it('returns null for cantrips', () => {
		const actor = createMockActor({
			items: [createPoolClass({ castAtHighestTier: true })],
			unlockedTier: 4,
		});
		expect(resolvePinnedCastTier(actor, createSpell(0))).toBeNull();
	});

	it('pins the cast tier to the highest unlocked tier', () => {
		const actor = createMockActor({
			items: [createPoolClass({ castAtHighestTier: true })],
			unlockedTier: 4,
		});
		expect(resolvePinnedCastTier(actor, createSpell(1))).toBe(4);
	});

	it('never pins below the spell base tier', () => {
		const actor = createMockActor({
			items: [createPoolClass({ castAtHighestTier: true })],
			unlockedTier: 0,
		});
		expect(resolvePinnedCastTier(actor, createSpell(2))).toBe(2);
	});
});

describe('exceedsUnlockedSpellTier', () => {
	it('refuses a spell above the tier the caster has unlocked', () => {
		const actor = createMockActor({
			items: [createPoolClass({ castAtHighestTier: true })],
			unlockedTier: 4,
		});
		expect(exceedsUnlockedSpellTier(actor, createSpell(5))).toBe(true);
	});

	it('permits a spell at the unlocked tier', () => {
		const actor = createMockActor({
			items: [createPoolClass({ castAtHighestTier: true })],
			unlockedTier: 4,
		});
		expect(exceedsUnlockedSpellTier(actor, createSpell(4))).toBe(false);
	});

	it('permits a spell below the unlocked tier', () => {
		const actor = createMockActor({
			items: [createPoolClass({ castAtHighestTier: true })],
			unlockedTier: 4,
		});
		expect(exceedsUnlockedSpellTier(actor, createSpell(1))).toBe(false);
	});

	it('permits a cantrip whatever the caster has unlocked', () => {
		const actor = createMockActor({ items: [createPoolClass({})], unlockedTier: 0 });
		expect(exceedsUnlockedSpellTier(actor, createSpell(0))).toBe(false);
	});

	it('refuses any tiered spell for a character who has unlocked nothing', () => {
		const actor = createMockActor({ items: [createPoolClass({})], unlockedTier: 0 });
		expect(exceedsUnlockedSpellTier(actor, createSpell(1))).toBe(true);
	});
});

describe('validateSpellCost', () => {
	it('validates nothing when resource spending automation is off', () => {
		setResourceSpendingAutomation(false);
		const actor = createMockActor({ items: [createPoolClass({ poolCurrent: 0 })] });
		const cost = resolveSpellCost(actor, createSpell(1));

		expect(validateSpellCost(actor, cost)).toEqual({ ok: true, overdrawn: false });
	});

	it('passes when the pool can afford the cast', () => {
		const actor = createMockActor({ items: [createPoolClass({ poolCurrent: 2 })] });
		const cost = resolveSpellCost(actor, createSpell(1));

		expect(validateSpellCost(actor, cost)).toEqual({ ok: true, overdrawn: false });
	});

	it('permits an empty pool when a consequence is declared', () => {
		const actor = createMockActor({
			items: [createPoolClass({ poolCurrent: 0, overdraftConsequence: 'halfMaxHpDamage' })],
		});
		const cost = resolveSpellCost(actor, createSpell(1));

		expect(validateSpellCost(actor, cost)).toEqual({ ok: true, overdrawn: true, available: 0 });
	});

	it('blocks an empty pool when no consequence is declared', () => {
		const actor = createMockActor({ items: [createPoolClass({ poolCurrent: 0 })] });
		const cost = resolveSpellCost(actor, createSpell(1));

		const result = validateSpellCost(actor, cost);
		expect(result.ok).toBe(false);
		expect(result.failure).toMatchObject({
			code: 'insufficientCharges',
			required: 1,
			available: 0,
		});
	});

	it('fails when the declared pool does not exist', () => {
		const classItem = createMockItem({
			id: 'class-1',
			name: 'Test Class',
			type: 'class',
			system: {
				spellcasting: {
					castAtHighestTier: false,
					cost: { poolIdentifier: 'missing-pool', amount: '1', overdraftConsequence: '' },
				},
			},
		});
		const actor = createMockActor({ items: [classItem] });
		const cost = resolveSpellCost(actor, createSpell(1));

		const result = validateSpellCost(actor, cost);
		expect(result.ok).toBe(false);
		expect(result.failure).toMatchObject({ code: 'poolMissing' });
	});
});

describe('spendSpellCost', () => {
	it('deducts mana and clamps at zero', async () => {
		const actor = createMockActor({ mana: { current: 2, max: 10 } });

		const outcome = await spendSpellCost(actor, { type: 'mana', amount: 5 });

		expect(outcome).toEqual({ ok: true, overdrawn: false });
		expect(actor.update).toHaveBeenCalledWith({ 'system.resources.mana.current': 0 });
	});

	it('deducts a pool cost from the stored pool', async () => {
		const classItem = createPoolClass({ poolCurrent: 3 });
		const actor = createMockActor({ items: [classItem] });
		const cost = resolveSpellCost(actor, createSpell(1));

		const outcome = await spendSpellCost(actor, cost);

		expect(outcome).toEqual({ ok: true, overdrawn: false });
		const stored = classItem.flags.nimble.chargePools['stolen-power'] as { current: number };
		expect(stored.current).toBe(2);
	});

	it('floors the pool at zero and reports the overdraw', async () => {
		const classItem = createPoolClass({
			poolCurrent: 0,
			overdraftConsequence: 'halfMaxHpDamage',
		});
		const actor = createMockActor({ items: [classItem] });
		const cost = resolveSpellCost(actor, createSpell(1));

		const outcome = await spendSpellCost(actor, cost);

		expect(outcome).toEqual({ ok: true, overdrawn: true });
		const stored = classItem.flags.nimble.chargePools['stolen-power'] as { current: number };
		expect(stored.current).toBe(0);
	});

	it('spends nothing when resource spending automation is off', async () => {
		setResourceSpendingAutomation(false);
		const classItem = createPoolClass({ poolCurrent: 3 });
		const actor = createMockActor({
			items: [classItem],
			mana: { current: 5, max: 10 },
		});

		const manaOutcome = await spendSpellCost(actor, { type: 'mana', amount: 3 });
		const poolOutcome = await spendSpellCost(actor, resolveSpellCost(actor, createSpell(1)));

		expect(manaOutcome).toEqual({ ok: true, overdrawn: false });
		expect(poolOutcome).toEqual({ ok: true, overdrawn: false });
		expect(actor.update).not.toHaveBeenCalled();
		expect(classItem.update).not.toHaveBeenCalled();
	});

	it('spends nothing for a free cast', async () => {
		const actor = createMockActor({ mana: { current: 5, max: 10 } });

		const outcome = await spendSpellCost(actor, { type: 'none' });

		expect(outcome).toEqual({ ok: true, overdrawn: false });
		expect(actor.update).not.toHaveBeenCalled();
	});
});

describe('applyOverdraftConsequence', () => {
	it('damages the caster for half their maximum hit points', async () => {
		const actor = createMockActor({
			items: [createPoolClass({ poolCurrent: 0, overdraftConsequence: 'halfMaxHpDamage' })],
			hpMax: 25,
		});
		const cost = resolveSpellCost(actor, createSpell(1));

		const damage = await applyOverdraftConsequence(actor, cost);

		expect(damage).toBe(12);
		expect(actor.applyDamage).toHaveBeenCalledWith(12);
	});

	it('does nothing when the cost declares no consequence', async () => {
		const actor = createMockActor({
			items: [createPoolClass({ poolCurrent: 0 })],
			hpMax: 25,
		});
		const cost = resolveSpellCost(actor, createSpell(1));

		const damage = await applyOverdraftConsequence(actor, cost);

		expect(damage).toBe(0);
		expect(actor.applyDamage).not.toHaveBeenCalled();
	});
});

describe('multiclass cost attribution', () => {
	function createPlainClass(identifier: string) {
		return createMockItem({
			id: `class-${identifier}`,
			name: identifier,
			type: 'class',
			system: { identifier },
		});
	}

	it('charges the pool when the sole class declares one', () => {
		const actor = createMockActor({ items: [createPoolClass({ poolCurrent: 3 })] });

		expect(resolveSpellCost(actor, createSpell(1))).toMatchObject({ type: 'pool' });
	});

	it("does not charge one class's pool for another class's spell", () => {
		const actor = createMockActor({
			items: [createPoolClass({ poolCurrent: 3 }), createPlainClass('mage')],
		});
		const mageSpell = { system: { tier: 2, classes: ['mage'] } };

		expect(resolveSpellCost(actor, mageSpell)).toEqual({ type: 'mana', amount: 2 });
	});

	it('charges the pool for a spell restricted to the declaring class', () => {
		const poolClass = createPoolClass({ poolCurrent: 3 });
		poolClass.system.identifier = 'shadowmancer';
		const actor = createMockActor({ items: [poolClass, createPlainClass('mage')] });
		const shadowSpell = { system: { tier: 2, classes: ['shadowmancer'] } };

		expect(resolveSpellCost(actor, shadowSpell)).toMatchObject({ type: 'pool' });
	});

	it('falls back to mana when a multiclass caster who holds mana names no class', () => {
		const actor = createMockActor({
			items: [createPoolClass({ poolCurrent: 3 }), createPlainClass('mage')],
			mana: { current: 8, max: 12 },
		});

		expect(resolveSpellCost(actor, createSpell(2))).toEqual({ type: 'mana', amount: 2 });
	});

	it('charges the only declared pool when a multiclass caster holds no mana', () => {
		const actor = createMockActor({
			items: [createPoolClass({ poolCurrent: 3 }), createPlainClass('berserker')],
		});

		expect(resolveSpellCost(actor, createSpell(2))).toMatchObject({ type: 'pool' });
	});

	it('falls back to mana when more than one class declares a pool', () => {
		const second = createPoolClass({ poolIdentifier: 'other-power', poolCurrent: 3 });
		second.id = 'class-2';
		const actor = createMockActor({ items: [createPoolClass({ poolCurrent: 3 }), second] });

		expect(resolveSpellCost(actor, createSpell(2))).toEqual({ type: 'mana', amount: 2 });
	});

	it("does not pin the cast tier for another class's spell", () => {
		const poolClass = createPoolClass({ poolCurrent: 3 });
		(poolClass.system.spellcasting as { castAtHighestTier: boolean }).castAtHighestTier = true;
		const actor = createMockActor({
			items: [poolClass, createPlainClass('mage')],
			unlockedTier: 4,
		});
		const mageSpell = { system: { tier: 1, classes: ['mage'] } };

		expect(resolvePinnedCastTier(actor, mageSpell)).toBeNull();
	});
});

describe('overdraft level bound', () => {
	function createBoundedActor(level: number) {
		const poolClass = createPoolClass({
			poolCurrent: 0,
			overdraftConsequence: 'halfMaxHpDamage',
		});
		(
			poolClass.system.spellcasting as { cost: { overdraftMaxLevel: number | null } }
		).cost.overdraftMaxLevel = 11;
		const actor = createMockActor({ items: [poolClass], hpMax: 20 });
		(actor as unknown as { levels: { character: number } }).levels = { character: level };
		return actor;
	}

	it('applies the consequence at or below the declared level', async () => {
		setResourceSpendingAutomation(true);
		const actor = createBoundedActor(11);
		const cost = resolveSpellCost(actor, createSpell(1));

		expect(cost).toMatchObject({ overdraftResolvedAtTable: false });
		expect(await applyOverdraftConsequence(actor, cost)).toBe(10);
	});

	it('applies nothing above the declared level, leaving the cost to the table', async () => {
		setResourceSpendingAutomation(true);
		const actor = createBoundedActor(12);
		const cost = resolveSpellCost(actor, createSpell(1));

		expect(cost).toMatchObject({ overdraftResolvedAtTable: true });
		expect(await applyOverdraftConsequence(actor, cost)).toBe(0);
		expect(actor.applyDamage).not.toHaveBeenCalled();
	});

	it('still permits the overdraw above the declared level', () => {
		setResourceSpendingAutomation(true);
		const actor = createBoundedActor(12);
		const cost = resolveSpellCost(actor, createSpell(1));

		expect(validateSpellCost(actor, cost)).toMatchObject({ ok: true, overdrawn: true });
	});

	it('applies the consequence at every level when no bound is declared', async () => {
		setResourceSpendingAutomation(true);
		const actor = createMockActor({
			items: [createPoolClass({ poolCurrent: 0, overdraftConsequence: 'halfMaxHpDamage' })],
			hpMax: 20,
		});
		(actor as unknown as { levels: { character: number } }).levels = { character: 20 };
		const cost = resolveSpellCost(actor, createSpell(1));

		expect(await applyOverdraftConsequence(actor, cost)).toBe(10);
	});
});

describe('formatSpellCostLabel', () => {
	it('renders a mana cost with the localized unit', () => {
		expect(formatSpellCostLabel({ type: 'mana', amount: 3 })).toBe('3 Mana');
	});

	it('renders a pool cost as the amount and the pool label', () => {
		expect(
			formatSpellCostLabel({
				type: 'pool',
				poolIdentifier: 'pilfered-power',
				poolLabel: 'Pilfered Power',
				amount: 1,
				overdraftConsequence: 'halfMaxHpDamage',
				overdraftResolvedAtTable: false,
			}),
		).toBe('1 Pilfered Power');
	});

	it('renders nothing for a free cast', () => {
		expect(formatSpellCostLabel({ type: 'none' })).toBeNull();
		expect(formatSpellCostLabel({ type: 'mana', amount: 0 })).toBeNull();
	});
});

describe('synthesizePinnedUpcast', () => {
	function scalingSpell(tier: number, mode: string) {
		return { system: { tier, scaling: { mode } } };
	}

	it('synthesizes the pinned tier for a scaling spell below it', () => {
		expect(synthesizePinnedUpcast(scalingSpell(1, 'upcast'), 4)).toEqual({
			manaToSpend: 4,
			choiceIndex: undefined,
		});
	});

	it('selects the first choice for a choice-scaled spell', () => {
		expect(synthesizePinnedUpcast(scalingSpell(1, 'upcastChoice'), 3)).toEqual({
			manaToSpend: 3,
			choiceIndex: 0,
		});
	});

	it('synthesizes nothing when no tier is pinned', () => {
		expect(synthesizePinnedUpcast(scalingSpell(1, 'upcast'), null)).toBeNull();
	});

	it('synthesizes nothing for a spell that does not scale', () => {
		expect(synthesizePinnedUpcast(scalingSpell(1, 'none'), 4)).toBeNull();
		expect(synthesizePinnedUpcast({ system: { tier: 1 } }, 4)).toBeNull();
	});

	it('synthesizes nothing for a cantrip', () => {
		expect(synthesizePinnedUpcast(scalingSpell(0, 'upcast'), 4)).toBeNull();
	});

	it('synthesizes nothing when the pinned tier adds no upcast steps', () => {
		expect(synthesizePinnedUpcast(scalingSpell(3, 'upcast'), 3)).toBeNull();
	});

	it("leaves a spell above the caster's unlocked tier at its own tier", () => {
		// resolvePinnedCastTier floors at the spell's tier, so a tier-5 spell held
		// by a caster who has unlocked tier 2 pins at 5. Synthesizing that would
		// exceed the upcast tier bound and error the cast.
		expect(synthesizePinnedUpcast(scalingSpell(5, 'upcast'), 5)).toBeNull();
	});
});
