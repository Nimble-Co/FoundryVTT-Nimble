import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ResourceCostKind } from '#types/resourceCost.d.ts';
import { testDependencies } from '../../../managers/ItemActivationManager.js';
import { ResourceCostRule } from '../../../models/rules/resourceCost.js';
import { NimbleFeatureItem } from '../feature.js';
import { NimbleSpellItem } from '../spell.js';

type Globals = Record<string, any>;
const globals = globalThis as Globals;

interface HeroOptions {
	mana?: number;
	hp?: number;
	temp?: number;
	wounds?: number;
	maxWounds?: number;
}

function hero(options: HeroOptions = {}) {
	const actor = {
		id: 'hero',
		uuid: 'Actor.hero',
		name: 'Hero',
		type: 'character',
		token: null,
		flags: {},
		rules: [],
		statuses: new Set<string>(),
		effects: [],
		items: { contents: [] as unknown[], get: () => undefined },
		system: {
			resources: { mana: { current: options.mana ?? 0, max: 10 }, highestUnlockedSpellTier: 3 },
			attributes: {
				hp: { value: options.hp ?? 20, max: 20, temp: options.temp ?? 0 },
				wounds: { value: options.wounds ?? 0, max: options.maxWounds ?? 6 },
			},
		},
		getRollData: () => ({ will: 3 }),
		getDomain: () => new Set<string>(),
		getActiveTokens: () => [],
		update: vi.fn(async (changes: Record<string, unknown>) => {
			for (const [path, value] of Object.entries(changes)) {
				foundry.utils.setProperty(actor, path, value);
			}
		}),
	};
	return actor;
}

type Hero = ReturnType<typeof hero>;

interface Variable {
	min: string;
	max: string;
}

function costRule(item: object, kind: ResourceCostKind, amount: string, variable?: Variable) {
	const rule = new ResourceCostRule({ type: 'resourceCost' } as never, { strict: false });
	Object.assign(rule, {
		id: `cost-${kind}`,
		type: 'resourceCost',
		disabled: false,
		kind,
		amount,
		spendMode: variable ? 'variable' : 'fixed',
		min: variable?.min ?? '',
		max: variable?.max ?? '',
	});
	Object.defineProperty(rule, 'parent', { get: () => item, configurable: true });
	Object.defineProperty(rule, 'predicate', {
		get: () => ({ size: 0, test: () => true }),
		configurable: true,
	});
	return rule;
}

type Cost = [ResourceCostKind, string] | [ResourceCostKind, string, Variable];

function itemOf(
	prototype: object,
	actor: Hero,
	name: string,
	costs: Cost[],
	extra: Record<string, unknown> = {},
) {
	const item = Object.assign(Object.create(prototype), {
		id: name,
		uuid: `Item.${name}`,
		name,
		img: 'icon.webp',
		permission: 3,
		tags: new Set<string>(),
		actor,
		getDomain: () => new Set<string>(),
		_createActivationCard: vi.fn(async () => null),
		// The foundry mock merges shallowly, so the kind's card data would replace the base system.
		prepareChatCardData: vi.fn(async () => ({})),
		...extra,
	});
	item.rules = new Map(
		costs.map(([kind, amount, variable]) => [kind, costRule(item, kind, amount, variable)]),
	);
	return item;
}

function feature(actor: Hero, name: string, costs: Cost[], effects: unknown[] = []) {
	return itemOf(NimbleFeatureItem.prototype, actor, name, costs, {
		type: 'feature',
		system: { activation: { effects }, description: '', class: '' },
	});
}

function spell(actor: Hero, name: string, costs: Cost[]) {
	return itemOf(NimbleSpellItem.prototype, actor, name, costs, {
		type: 'spell',
		system: {
			tier: 1,
			school: 'ice',
			activation: { effects: [] },
			description: { baseEffect: '', higherLevelEffect: '', upcastEffect: '' },
			scaling: null,
		},
	});
}

function cardOf(item: { _createActivationCard: ReturnType<typeof vi.fn> }) {
	return item._createActivationCard.mock.calls[0]?.[0] as
		| { system: Record<string, unknown> }
		| undefined;
}

function setResourceSpending(on: boolean): void {
	globals.game.settings = {
		get: (_scope: string, key: string) => (key === 'automation.resourceSpending' ? on : false),
	};
}

let saved: Record<string, unknown>;

const dialog = {
	result: { rollMode: 0 } as Record<string, unknown> | null,
	opened: [] as Array<Record<string, unknown>>,
};

function FakeActivationDialog(_actor: unknown, _item: unknown, _title: string, data: object) {
	dialog.opened.push(data as Record<string, unknown>);
	return { render: async () => undefined, promise: Promise.resolve(dialog.result) };
}

beforeEach(() => {
	saved = {
		settings: globals.game.settings,
		ItemActivationConfigDialog: testDependencies.ItemActivationConfigDialog,
	};
	dialog.result = { rollMode: 0 };
	dialog.opened = [];
	testDependencies.ItemActivationConfigDialog = FakeActivationDialog as never;
	setResourceSpending(true);
	(Hooks.call as ReturnType<typeof vi.fn>).mockReturnValue(true);
	globals.ChatMessage.getSpeaker = vi.fn(() => ({}));
	globals.CONST.CHAT_MESSAGE_STYLES = { OTHER: 0 };
	globals.CONFIG.sounds = { dice: 'dice' };
	vi.mocked(ui.notifications!.error).mockClear();
	vi.mocked(ui.notifications!.warn).mockClear();
});

afterEach(() => {
	globals.game.settings = saved.settings;
	testDependencies.ItemActivationConfigDialog = saved.ItemActivationConfigDialog as never;
	vi.mocked(Roll).mockReset();
});

function notices(): string[] {
	return [
		...vi.mocked(ui.notifications!.error).mock.calls,
		...vi.mocked(ui.notifications!.warn).mock.calls,
	].map(([message]) => String(message));
}

describe('using a feature with a Spend or Sacrifice cost', () => {
	it('spends the mana and puts the cost on the card', async () => {
		const actor = hero({ mana: 5 });
		const item = feature(actor, 'Storm Wake', [['mana', '3']]);

		await item.activate();

		expect(actor.system.resources.mana.current).toBe(2);
		expect(cardOf(item)?.system.costs).toEqual([{ kind: 'mana', amount: 3, source: 'Storm Wake' }]);
	});

	it('refuses the use with a notice when the creature has too little mana, and spends nothing', async () => {
		const actor = hero({ mana: 2 });
		const item = feature(actor, 'Storm Wake', [['mana', '3']]);

		await item.activate();

		expect(actor.update).not.toHaveBeenCalled();
		expect(item._createActivationCard).not.toHaveBeenCalled();
		expect(notices()).toEqual(['Storm Wake needs 3 mana. You have 2.']);
	});

	it('sacrifices HP as a change to HP, not as damage', async () => {
		const actor = hero({ hp: 12, temp: 4 });
		const item = feature(actor, 'Blood Price', [['hp', '5']]);

		await item.activate();

		expect(actor.system.attributes.hp).toEqual({ value: 7, max: 20, temp: 4 });
		expect(actor.update).toHaveBeenCalledWith({ 'system.attributes.hp.value': 7 });
		expect(cardOf(item)?.system.costs).toEqual([{ kind: 'hp', amount: 5, source: 'Blood Price' }]);
	});

	it('refuses an HP cost that would leave the creature at 0 HP', async () => {
		const actor = hero({ hp: 5 });
		const item = feature(actor, 'Blood Price', [['hp', '5']]);

		await item.activate();

		expect(actor.update).not.toHaveBeenCalled();
		expect(notices()).toEqual(['Blood Price needs more than 5 HP.']);
	});

	it('spends only temp HP for a temp HP cost', async () => {
		const actor = hero({ hp: 20, temp: 10 });
		const item = feature(actor, 'Shadowfrost', [['tempHp', '10']]);

		await item.activate();

		expect(actor.system.attributes.hp).toEqual({ value: 20, max: 20, temp: 0 });
		expect(cardOf(item)?.system.costs).toEqual([
			{ kind: 'tempHp', amount: 10, source: 'Shadowfrost' },
		]);
	});

	it('refuses a temp HP cost with too little temp HP, whatever the HP', async () => {
		const actor = hero({ hp: 20, temp: 6 });
		const item = feature(actor, 'Shadowfrost', [['tempHp', '10']]);

		await item.activate();

		expect(actor.update).not.toHaveBeenCalled();
		expect(notices()).toEqual(['Shadowfrost needs 10 temp HP. You have 6.']);
	});

	it('gives the Wounds of a Wound cost', async () => {
		const actor = hero({ wounds: 2, maxWounds: 6 });
		const item = feature(actor, 'Dark Bargain', [['wounds', '1']]);

		await item.activate();

		expect(actor.system.attributes.wounds.value).toBe(3);
		expect(cardOf(item)?.system.costs).toEqual([
			{ kind: 'wounds', amount: 1, source: 'Dark Bargain' },
		]);
	});

	it('refuses a Wound cost that would go past the maximum Wounds', async () => {
		const actor = hero({ wounds: 5, maxWounds: 6 });
		const item = feature(actor, 'Dark Bargain', [['wounds', '2']]);

		await item.activate();

		expect(actor.update).not.toHaveBeenCalled();
		expect(notices()).toEqual(['Dark Bargain needs room for 2 more Wounds. You have room for 1.']);
	});

	it('spends every cost of the use, and refuses the whole use when one is short', async () => {
		const rich = hero({ mana: 4, hp: 12 });
		const paid = feature(rich, 'Storm Pact', [
			['mana', '2'],
			['hp', '3'],
		]);
		await paid.activate();
		expect(rich.system.resources.mana.current).toBe(2);
		expect(rich.system.attributes.hp.value).toBe(9);

		const poor = hero({ mana: 4, hp: 3 });
		const refused = feature(poor, 'Storm Pact', [
			['mana', '2'],
			['hp', '3'],
		]);
		await refused.activate();
		expect(poor.update).not.toHaveBeenCalled();
	});

	it('gives the costs back when the card fails to post', async () => {
		const actor = hero({ mana: 5, hp: 12 });
		const item = feature(actor, 'Storm Pact', [
			['mana', '2'],
			['hp', '3'],
		]);
		const failure = new Error('card failed');
		item._createActivationCard.mockRejectedValue(failure);

		await expect(item.activate()).rejects.toBe(failure);

		expect(actor.system.resources.mana.current).toBe(5);
		expect(actor.system.attributes.hp.value).toBe(12);
	});

	it('with Resource Spending off, checks and spends nothing but still shows the cost', async () => {
		setResourceSpending(false);
		const actor = hero({ mana: 0 });
		const item = feature(actor, 'Storm Wake', [['mana', '3']]);

		await item.activate();

		expect(actor.update).not.toHaveBeenCalled();
		expect(notices()).toEqual([]);
		expect(cardOf(item)?.system.costs).toEqual([{ kind: 'mana', amount: 3, source: 'Storm Wake' }]);
	});
});

describe('casting a spell with a Spend or Sacrifice cost', () => {
	it('spends the spell mana and the cost, and the card shows only the cost', async () => {
		const actor = hero({ mana: 5, hp: 20 });
		const item = spell(actor, 'Frost Pact', [['hp', '4']]);

		await item.activate({ fastForward: true });

		expect(actor.system.resources.mana.current).toBe(4);
		expect(actor.system.attributes.hp.value).toBe(16);
		expect(cardOf(item)?.system.costs).toEqual([{ kind: 'hp', amount: 4, source: 'Frost Pact' }]);
	});

	it('gives the cost back when the spell mana is short', async () => {
		const actor = hero({ mana: 0, hp: 20 });
		const item = spell(actor, 'Frost Pact', [['hp', '4']]);

		await item.activate({ fastForward: true });

		expect(actor.system.attributes.hp.value).toBe(20);
		expect(item._createActivationCard).not.toHaveBeenCalled();
	});
});

describe('using a feature with a variable Spend or Sacrifice cost', () => {
	const upToWill: Cost = ['mana', '1', { min: '1', max: '@will' }];

	it('asks for the amount and spends what the player chose', async () => {
		const actor = hero({ mana: 5 });
		const item = feature(actor, 'Supercharge', [upToWill]);
		dialog.result = { rollMode: 0, resourceAmounts: { 'cost-mana': 3 } };

		await item.activate();

		expect(dialog.opened).toHaveLength(1);
		expect(actor.system.resources.mana.current).toBe(2);
		expect(cardOf(item)?.system.costs).toEqual([
			{ kind: 'mana', amount: 3, source: 'Supercharge' },
		]);
	});

	it('asks for the amount on a fast forward too', async () => {
		const actor = hero({ mana: 5 });
		const item = feature(actor, 'Supercharge', [upToWill]);
		dialog.result = { rollMode: 0, resourceAmounts: { 'cost-mana': 3 } };

		await item.activate({ fastForward: true });

		expect(dialog.opened).toHaveLength(1);
		expect(actor.system.resources.mana.current).toBe(2);
	});

	it("gives the chosen amount to the item's formulas as @cost, and keeps @spent for charges", async () => {
		const actor = hero({ mana: 5 });
		const healing = { id: 'heal', type: 'healing', healingType: 'healing', formula: '@cost.mana' };
		const item = feature(actor, 'Supercharge', [upToWill], [healing]);
		dialog.result = { rollMode: 0, resourceAmounts: { 'cost-mana': 2 } };

		await item.activate();

		const healingRoll = vi.mocked(Roll).mock.calls.find(([formula]) => formula === '@cost.mana');
		expect(healingRoll?.[1]).toMatchObject({
			spent: 0,
			cost: { mana: 2, hp: 0, tempHp: 0, wounds: 0 },
		});
	});

	it('takes no more than the creature has when the amount changed while the dialog waited', async () => {
		const actor = hero({ mana: 2 });
		const item = feature(actor, 'Supercharge', [upToWill]);
		dialog.result = { rollMode: 0, resourceAmounts: { 'cost-mana': 3 } };

		await item.activate();

		expect(actor.system.resources.mana.current).toBe(0);
		expect(cardOf(item)?.system.costs).toEqual([
			{ kind: 'mana', amount: 2, source: 'Supercharge' },
		]);
	});

	it('refuses the use when the creature has less than the minimum', async () => {
		const actor = hero({ mana: 1 });
		const item = feature(actor, 'Supercharge', [['mana', '2', { min: '2', max: '@will' }]]);

		await item.activate();

		expect(dialog.opened).toHaveLength(0);
		expect(actor.update).not.toHaveBeenCalled();
		expect(notices()).toEqual(['Supercharge needs 2 mana. You have 1.']);
	});

	it('with Resource Spending off, still asks, spends nothing, and the amount reaches the card', async () => {
		setResourceSpending(false);
		const actor = hero({ mana: 0 });
		const item = feature(actor, 'Supercharge', [upToWill]);
		dialog.result = { rollMode: 0, resourceAmounts: { 'cost-mana': 3 } };

		await item.activate();

		expect(dialog.opened).toHaveLength(1);
		expect(actor.update).not.toHaveBeenCalled();
		expect(cardOf(item)?.system.costs).toEqual([
			{ kind: 'mana', amount: 3, source: 'Supercharge' },
		]);
	});
});

/** A 1d4 that rolls `result`; its lowest result is 1. */
function rollsOn1d4(result: number) {
	vi.mocked(Roll).mockImplementation(((formula: string) => {
		if (formula !== '1d4') return undefined;
		const roll = {
			formula,
			total: undefined as number | undefined,
			evaluateSync: ({ minimize = false } = {}) => {
				roll.total = minimize ? 1 : result;
				return roll;
			},
			evaluate: async () => {
				roll.total = result;
				return roll;
			},
		};
		return roll;
	}) as never);
}

describe('using a feature with a rolled Spend or Sacrifice cost', () => {
	it('rolls the Wounds at use and the card shows the roll', async () => {
		rollsOn1d4(3);
		const actor = hero({ wounds: 1, maxWounds: 6 });
		const item = feature(actor, 'Enveloped', [['wounds', '1d4']]);

		await item.activate();

		expect(actor.system.attributes.wounds.value).toBe(4);
		expect(cardOf(item)?.system.costs).toEqual([
			{ kind: 'wounds', amount: 3, source: 'Enveloped', roll: '1d4' },
		]);
	});

	it('is checked against its lowest result before the roll', async () => {
		rollsOn1d4(3);
		const actor = hero({ wounds: 6, maxWounds: 6 });
		const item = feature(actor, 'Enveloped', [['wounds', '1d4']]);

		await item.activate();

		expect(actor.update).not.toHaveBeenCalled();
		expect(notices()).toEqual(['Enveloped needs room for 1 more Wound. You have room for 0.']);
	});

	it('refuses a roll that would pass the maximum Wounds, and takes nothing', async () => {
		rollsOn1d4(3);
		const actor = hero({ wounds: 4, maxWounds: 6 });
		const item = feature(actor, 'Enveloped', [['wounds', '1d4']]);

		await item.activate();

		expect(actor.update).not.toHaveBeenCalled();
		expect(item._createActivationCard).not.toHaveBeenCalled();
		expect(notices()).toEqual(['Enveloped needs room for 3 more Wounds. You have room for 2.']);
	});

	it('with Resource Spending off, still rolls and shows the roll, and gives no Wounds', async () => {
		setResourceSpending(false);
		rollsOn1d4(4);
		const actor = hero({ wounds: 6, maxWounds: 6 });
		const item = feature(actor, 'Enveloped', [['wounds', '1d4']]);

		await item.activate();

		expect(actor.update).not.toHaveBeenCalled();
		expect(cardOf(item)?.system.costs).toEqual([
			{ kind: 'wounds', amount: 4, source: 'Enveloped', roll: '1d4' },
		]);
	});
});

describe('using a feature with a formula Spend or Sacrifice cost', () => {
	it("reads the formula against the creature's roll data", async () => {
		const actor = hero({ mana: 5 });
		const item = feature(actor, 'Will Drain', [['mana', '@will']]);

		await item.activate();

		expect(actor.system.resources.mana.current).toBe(2);
		expect(cardOf(item)?.system.costs).toEqual([{ kind: 'mana', amount: 3, source: 'Will Drain' }]);
	});
});

describe('using a cost beyond what the creature has', () => {
	const confirm = () =>
		vi.mocked(foundry.applications.api.DialogV2.confirm as (...args: unknown[]) => unknown);

	function answer(yes: boolean) {
		confirm().mockReset();
		confirm().mockResolvedValue(yes as never);
	}

	function asked(): string {
		const options = confirm().mock.calls[0]?.[0] as { content?: string } | undefined;
		return (options?.content ?? '')
			.replace(/<[^>]+>/g, ' ')
			.replace(/\s+/g, ' ')
			.trim();
	}

	function beyond<T extends { rules: Map<string, unknown> }>(
		item: T,
		kind: ResourceCostKind,
		value: string,
	): T {
		Object.assign(item.rules.get(kind) as object, { beyond: value });
		return item;
	}

	it('asks, then spends what the creature has, down to 0, and the card shows what was spent', async () => {
		answer(true);
		const actor = hero({ mana: 1 });
		const item = beyond(feature(actor, 'Stretch Time', [['mana', '2']]), 'mana', 'allowed');

		await item.activate();

		expect(asked()).toBe('You have 1 mana. Stretch Time needs 2. Use it anyway?');
		expect(actor.system.resources.mana.current).toBe(0);
		expect(notices()).toEqual([]);
		expect(cardOf(item)?.system.costs).toEqual([
			{ kind: 'mana', amount: 1, source: 'Stretch Time' },
		]);
	});

	it('stops the use with nothing spent and no notice when the player cancels', async () => {
		answer(false);
		const actor = hero({ mana: 1 });
		const item = beyond(feature(actor, 'Stretch Time', [['mana', '2']]), 'mana', 'allowed');

		await item.activate();

		expect(confirm()).toHaveBeenCalledTimes(1);
		expect(actor.update).not.toHaveBeenCalled();
		expect(item._createActivationCard).not.toHaveBeenCalled();
		expect(notices()).toEqual([]);
	});

	it('does not ask when the creature has enough', async () => {
		answer(true);
		const actor = hero({ mana: 3 });
		const item = beyond(feature(actor, 'Stretch Time', [['mana', '2']]), 'mana', 'allowed');

		await item.activate();

		expect(confirm()).not.toHaveBeenCalled();
		expect(actor.system.resources.mana.current).toBe(1);
	});

	it('does not ask when the cost is Not Allowed, and refuses as before', async () => {
		answer(true);
		const actor = hero({ mana: 1 });
		const item = feature(actor, 'Stretch Time', [['mana', '2']]);

		await item.activate();

		expect(confirm()).not.toHaveBeenCalled();
		expect(notices()).toEqual(['Stretch Time needs 2 mana. You have 1.']);
	});

	it('sacrifices HP down to 0, never below', async () => {
		answer(true);
		const actor = hero({ hp: 4, temp: 3 });
		const item = beyond(feature(actor, 'Blood Price', [['hp', '5']]), 'hp', 'allowed');

		await item.activate();

		expect(asked()).toBe('You have 4 HP. Blood Price needs more than 5. Use it anyway?');
		expect(actor.system.attributes.hp).toEqual({ value: 0, max: 20, temp: 3 });
		expect(cardOf(item)?.system.costs).toEqual([{ kind: 'hp', amount: 4, source: 'Blood Price' }]);
	});

	it('spends temp HP down to 0 and leaves HP alone', async () => {
		answer(true);
		const actor = hero({ hp: 20, temp: 6 });
		const item = beyond(feature(actor, 'Shadowfrost', [['tempHp', '10']]), 'tempHp', 'allowed');

		await item.activate();

		expect(asked()).toBe('You have 6 temp HP. Shadowfrost needs 10. Use it anyway?');
		expect(actor.system.attributes.hp).toEqual({ value: 20, max: 20, temp: 0 });
		expect(cardOf(item)?.system.costs).toEqual([
			{ kind: 'tempHp', amount: 6, source: 'Shadowfrost' },
		]);
	});

	it('gives every Wound, even past the max', async () => {
		answer(true);
		const actor = hero({ wounds: 5, maxWounds: 6 });
		const item = beyond(feature(actor, 'Dark Bargain', [['wounds', '2']]), 'wounds', 'allowed');

		await item.activate();

		expect(asked()).toBe('You have room for 1 more Wound. Dark Bargain needs 2. Use it anyway?');
		expect(actor.system.attributes.wounds.value).toBe(7);
		expect(cardOf(item)?.system.costs).toEqual([
			{ kind: 'wounds', amount: 2, source: 'Dark Bargain' },
		]);
	});

	it('applies the consequence when the player confirms', async () => {
		answer(true);
		const actor = Object.assign(hero({ mana: 1 }), { applyDamage: vi.fn(async () => undefined) });
		const item = beyond(feature(actor, 'Stretch Time', [['mana', '2']]), 'mana', 'halfMaxHpDamage');

		await item.activate();

		expect(asked()).toBe(
			'You have 1 mana. Stretch Time needs 2. Using it anyway deals 10 damage to you (half your max HP). Use it anyway?',
		);
		expect(actor.system.resources.mana.current).toBe(0);
		expect(actor.applyDamage).toHaveBeenCalledWith(10);
	});

	it('gives the cost back when the consequence throws', async () => {
		answer(true);
		const failure = new Error('damage failed');
		const actor = Object.assign(hero({ mana: 1 }), {
			applyDamage: vi.fn(async () => {
				throw failure;
			}),
		});
		const item = beyond(feature(actor, 'Stretch Time', [['mana', '2']]), 'mana', 'halfMaxHpDamage');

		await expect(item.activate()).rejects.toBe(failure);

		expect(actor.system.resources.mana.current).toBe(1);
	});

	it('applies no consequence when the player cancels, or when the use stops after the cost', async () => {
		answer(false);
		const cancelled = Object.assign(hero({ mana: 1 }), {
			applyDamage: vi.fn(async () => undefined),
		});
		await beyond(
			feature(cancelled, 'Stretch Time', [['mana', '2']]),
			'mana',
			'halfMaxHpDamage',
		).activate();
		expect(cancelled.applyDamage).not.toHaveBeenCalled();

		answer(true);
		const stopped = Object.assign(hero({ mana: 0, hp: 4 }), {
			applyDamage: vi.fn(async () => undefined),
		});
		const item = beyond(spell(stopped, 'Frost Pact', [['hp', '5']]), 'hp', 'halfMaxHpDamage');
		await item.activate({ fastForward: true });
		expect(stopped.applyDamage).not.toHaveBeenCalled();
		expect(stopped.system.attributes.hp.value).toBe(4);
	});

	it('takes every rolled Wound past the max', async () => {
		answer(true);
		rollsOn1d4(3);
		const actor = hero({ wounds: 4, maxWounds: 6 });
		const item = beyond(feature(actor, 'Enveloped', [['wounds', '1d4']]), 'wounds', 'allowed');

		await item.activate();

		expect(asked()).toBe('You have room for 2 more Wounds. Enveloped needs 3. Use it anyway?');
		expect(actor.system.attributes.wounds.value).toBe(7);
		expect(cardOf(item)?.system.costs).toEqual([
			{ kind: 'wounds', amount: 3, source: 'Enveloped', roll: '1d4' },
		]);
	});

	it('takes what there is when a rolled amount comes out higher than the creature has', async () => {
		answer(true);
		rollsOn1d4(3);
		const actor = hero({ mana: 2 });
		const item = beyond(feature(actor, 'Mana Burn', [['mana', '1d4']]), 'mana', 'allowed');

		await item.activate();

		expect(asked()).toBe('You have 2 mana. Mana Burn needs 3. Use it anyway?');
		expect(actor.system.resources.mana.current).toBe(0);
		expect(cardOf(item)?.system.costs).toEqual([
			{ kind: 'mana', amount: 2, source: 'Mana Burn', roll: '1d4' },
		]);
	});

	it('with Resource Spending off, asks nothing and takes nothing', async () => {
		setResourceSpending(false);
		answer(true);
		const actor = hero({ mana: 1 });
		const item = beyond(feature(actor, 'Stretch Time', [['mana', '2']]), 'mana', 'allowed');

		await item.activate();

		expect(confirm()).not.toHaveBeenCalled();
		expect(actor.update).not.toHaveBeenCalled();
		expect(cardOf(item)?.system.costs).toEqual([
			{ kind: 'mana', amount: 2, source: 'Stretch Time' },
		]);
	});
});
