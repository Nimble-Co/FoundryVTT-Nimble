import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { testDependencies } from '../../../managers/ItemActivationManager.js';
import { UseOptionRule } from '../../../models/rules/useOption.js';
import { NimbleObjectItem } from '../object.js';

type Globals = Record<string, any>;
const globals = globalThis as Globals;

const POOL = 'actor:oath';

function oathPool() {
	return {
		id: 'oath-item',
		name: 'Oath',
		type: 'feature',
		flags: {},
		system: {},
		rules: new Map([
			[
				'pool',
				{
					type: 'chargePool',
					disabled: false,
					id: 'pool',
					identifier: 'oath',
					label: 'Oath (1/turn)',
					scope: 'actor',
					max: '1',
					initial: 'max',
					recoveries: [],
				},
			],
		]),
	};
}

function hero({ mana = 7, uses = 1 } = {}) {
	const actor = {
		id: 'oathsworn',
		uuid: 'Actor.oathsworn',
		name: 'Oathsworn',
		type: 'character',
		token: null,
		flags: {
			nimble: {
				chargePools: { [POOL]: { identifier: 'oath', current: uses, max: 1, seeded: true } },
			},
		},
		rules: [] as unknown[],
		statuses: new Set<string>(),
		effects: [],
		items: { contents: [oathPool()] as unknown[], get: () => undefined },
		system: {
			resources: { mana: { current: mana, max: 10 }, highestUnlockedSpellTier: 3 },
			attributes: { hp: { value: 20, max: 20, temp: 0 }, wounds: { value: 0, max: 6 } },
		},
		getRollData: () => ({ resources: { highestUnlockedSpellTier: 3 } }),
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

const CONDEMNING = {
	name: 'Condemning Strike',
	damage: '5',
	damageType: 'radiant',
	lowerArmorSteps: 0,
};
const BLESSED = { name: 'Blessed Aim', damage: '', damageType: '', lowerArmorSteps: 1 };

/** Zealot: spend mana up to the highest unlocked spell tier, split between two picks. */
function giveZealot(actor: Hero, pool = '') {
	const item = {
		name: 'Zealot',
		uuid: 'Actor.oathsworn.Item.zealot',
		actor,
		getDomain: () => new Set(),
	};
	const rule = new UseOptionRule({ type: 'useOption' } as never, { strict: false });
	Object.assign(rule, {
		id: 'zealot',
		type: 'useOption',
		disabled: false,
		label: '',
		target: 'meleeWeapon',
		tieredOnly: false,
		singleTargetOnly: false,
		schools: [],
		spells: [],
		kind: 'mana',
		spendMode: 'variable',
		amount: '',
		min: '0',
		max: '@resources.highestUnlockedSpellTier',
		beyond: 'notAllowed',
		chargePoolIdentifier: pool,
		actionDelta: 0,
		actionMinimum: 0,
		picks: [CONDEMNING, BLESSED],
	});
	Object.defineProperty(rule, 'parent', { get: () => item, configurable: true });
	Object.defineProperty(rule, 'predicate', {
		get: () => ({ size: 0, test: () => true }),
		configurable: true,
	});
	actor.rules.push(rule);
	return rule;
}

function weapon(actor: Hero, attackType: 'reach' | 'range' = 'reach') {
	return Object.assign(Object.create(NimbleObjectItem.prototype), {
		id: 'longsword',
		uuid: 'Item.longsword',
		name: 'Longsword',
		img: 'icon.webp',
		permission: 3,
		tags: new Set<string>(),
		actor,
		type: 'object',
		rules: new Map(),
		system: {
			objectType: 'weapon',
			equipped: true,
			properties: { selected: [] },
			activation: {
				targets: { attackType, count: 1 },
				effects: [
					{
						id: 'dmg',
						type: 'damage',
						damageType: 'slashing',
						formula: '1d8',
						canCrit: true,
						canMiss: true,
						parentNode: null,
						parentContext: null,
						on: {
							hit: [{ id: 'hit', type: 'damageOutcome', parentNode: 'dmg', parentContext: 'hit' }],
						},
					},
				],
			},
		},
		getDomain: () => new Set<string>(),
		_createActivationCard: vi.fn(async () => null),
		// The foundry mock merges shallowly, so the kind's card data would replace the base system.
		prepareChatCardData: vi.fn(async () => ({})),
	});
}

interface EffectNode {
	type: string;
	damageType?: string;
	formula?: string;
	lowerArmorSteps?: number;
	on?: Record<string, EffectNode[]>;
}

function cardOf(item: { _createActivationCard: ReturnType<typeof vi.fn> }) {
	return item._createActivationCard.mock.calls[0]?.[0] as
		| { system: { costs: unknown[]; activation: { effects: EffectNode[] } } }
		| undefined;
}

function damageNodes(item: { _createActivationCard: ReturnType<typeof vi.fn> }): EffectNode[] {
	return (cardOf(item)?.system.activation.effects ?? []).filter((node) => node.type === 'damage');
}

const dialog = {
	result: { rollMode: 0 } as Record<string, unknown> | null,
	opened: [] as Array<Record<string, unknown>>,
};

function FakeActivationDialog(_actor: unknown, _item: unknown, _title: string, data: object) {
	dialog.opened.push(data as Record<string, unknown>);
	return { render: async () => undefined, promise: Promise.resolve(dialog.result) };
}

class FakeDamageRoll {
	formula: string;
	options: Record<string, unknown>;

	constructor(formula: string, _data: unknown, options: Record<string, unknown> = {}) {
		this.formula = formula;
		this.options = options;
	}

	async evaluate() {
		return this;
	}

	toJSON() {
		return { class: 'DamageRoll', formula: this.formula, total: 6 };
	}
}

function setResourceSpending(on: boolean): void {
	globals.game.settings = {
		get: (_scope: string, key: string) => (key === 'automation.resourceSpending' ? on : false),
	};
}

function pick(key: string, picks: Record<string, number>) {
	dialog.result = { rollMode: 0, useOptions: [{ key, picks }] };
}

let saved: Record<string, unknown>;

beforeEach(() => {
	saved = {
		settings: globals.game.settings,
		ItemActivationConfigDialog: testDependencies.ItemActivationConfigDialog,
		DamageRoll: testDependencies.DamageRoll,
	};
	dialog.result = { rollMode: 0 };
	dialog.opened = [];
	testDependencies.ItemActivationConfigDialog = FakeActivationDialog as never;
	testDependencies.DamageRoll = FakeDamageRoll as never;
	setResourceSpending(true);
	(Hooks.call as ReturnType<typeof vi.fn>).mockReturnValue(true);
	globals.ChatMessage.getSpeaker = vi.fn(() => ({}));
	globals.CONST.CHAT_MESSAGE_STYLES = { OTHER: 0 };
	globals.CONFIG.sounds = { dice: 'dice' };
	vi.mocked(ui.notifications!.error).mockClear();
});

afterEach(() => {
	globals.game.settings = saved.settings;
	testDependencies.ItemActivationConfigDialog = saved.ItemActivationConfigDialog as never;
	testDependencies.DamageRoll = saved.DamageRoll as never;
});

describe('the options the activation dialog of a weapon offers', () => {
	it('has a split option on a melee weapon, with its picks and a cap of the highest unlocked tier', async () => {
		const actor = hero();
		const zealot = giveZealot(actor);

		await weapon(actor).activate();

		const groups = dialog.opened[0]?.useOptionGroups as Array<Record<string, any>>;
		expect(groups).toHaveLength(1);
		const [option] = groups[0].options;
		expect(option.key).toBe(zealot.key);
		expect(option.name).toBe('Zealot');
		expect(option.cost.spend).toEqual({ mode: 'variable', min: '0', max: '3' });
		expect(option.picks.map((each: { name: string }) => each.name)).toEqual([
			'Condemning Strike',
			'Blessed Aim',
		]);
	});

	it('has no option on a ranged weapon', async () => {
		const actor = hero();
		giveZealot(actor);

		await weapon(actor, 'range').activate();

		expect(dialog.opened[0]?.useOptionGroups).toEqual([]);
	});
});

describe('attacking with a melee weapon and a split option', () => {
	it('spends the mana of the picks, adds +5 radiant for each Condemning Strike, and shows the cost', async () => {
		const actor = hero({ mana: 7 });
		const zealot = giveZealot(actor);
		const item = weapon(actor);
		pick(zealot.key, { 0: 2 });

		await item.activate();

		expect(actor.system.resources.mana.current).toBe(5);
		expect(cardOf(item)?.system.costs).toEqual([{ kind: 'mana', amount: 2, source: 'Zealot' }]);
		const radiant = damageNodes(item).find((node) => node.damageType === 'radiant');
		expect(radiant?.formula).toBe('10');
		expect((radiant as { modifierOnly?: boolean } | undefined)?.modifierOnly).toBe(true);
		expect(damageNodes(item).every((node) => !node.lowerArmorSteps)).toBe(true);
	});

	it('counts the target armor one step lower for each Blessed Aim, on all the damage of the attack', async () => {
		const actor = hero({ mana: 7 });
		const zealot = giveZealot(actor);
		const item = weapon(actor);
		pick(zealot.key, { 0: 1, 1: 1 });

		await item.activate();

		expect(actor.system.resources.mana.current).toBe(5);
		const nodes = damageNodes(item);
		expect(nodes.map((node) => [node.damageType, node.formula])).toEqual([
			['slashing', '1d8'],
			['radiant', '5'],
		]);
		expect(nodes.map((node) => node.lowerArmorSteps)).toEqual([1, 1]);
	});

	it('keeps the picks inside the cap and what the creature has', async () => {
		const actor = hero({ mana: 2 });
		const zealot = giveZealot(actor);
		const item = weapon(actor);
		pick(zealot.key, { 0: 2, 1: 2 });

		await item.activate();

		expect(actor.system.resources.mana.current).toBe(0);
		expect(cardOf(item)?.system.costs).toEqual([{ kind: 'mana', amount: 2, source: 'Zealot' }]);
		expect(damageNodes(item).find((node) => node.damageType === 'radiant')?.formula).toBe('10');
		expect(damageNodes(item)[0]?.lowerArmorSteps).toBeUndefined();
	});

	it('with no pick, spends nothing and adds nothing', async () => {
		const actor = hero({ mana: 7 });
		giveZealot(actor);
		const item = weapon(actor);

		await item.activate();

		expect(actor.update).not.toHaveBeenCalled();
		expect(cardOf(item)?.system.costs).toEqual([]);
		expect(damageNodes(item)).toHaveLength(1);
	});

	it('with Resource Spending off, spends nothing but still applies the picks and shows the cost', async () => {
		setResourceSpending(false);
		const actor = hero({ mana: 0 });
		const zealot = giveZealot(actor);
		const item = weapon(actor);
		pick(zealot.key, { 1: 2 });

		await item.activate();

		expect(actor.update).not.toHaveBeenCalled();
		expect(cardOf(item)?.system.costs).toEqual([{ kind: 'mana', amount: 2, source: 'Zealot' }]);
		expect(damageNodes(item)[0]?.lowerArmorSteps).toBe(2);
	});

	it('spends a use of its Use limit, and refuses with no use left', async () => {
		const actor = hero({ mana: 7 });
		const zealot = giveZealot(actor, 'oath');
		const item = weapon(actor);
		pick(zealot.key, { 0: 1 });

		await item.activate();

		expect(actor.flags.nimble.chargePools[POOL].current).toBe(0);
		expect(actor.system.resources.mana.current).toBe(6);

		const again = weapon(actor);
		await again.activate();

		expect(again._createActivationCard).not.toHaveBeenCalled();
		expect(actor.system.resources.mana.current).toBe(6);
		expect(vi.mocked(ui.notifications!.error).mock.calls.map(([text]) => text)).toEqual([
			'Oath (1/turn) has no use left.',
		]);
	});
});
