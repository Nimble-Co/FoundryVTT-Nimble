import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { testDependencies } from '../../../managers/ItemActivationManager.js';
import { UseOptionRule } from '../../../models/rules/useOption.js';
import { NimbleSpellItem } from '../spell.js';

type Globals = Record<string, any>;
const globals = globalThis as Globals;

const POOL = 'actor:spellshaper';

function hero({ mana = 5, uses = 1 } = {}) {
	const pool = {
		id: 'spellshaper-item',
		name: 'Spellshaper',
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
					identifier: 'spellshaper',
					label: 'Spellshaper (1/turn)',
					scope: 'actor',
					max: '1',
					initial: 'max',
					recoveries: [],
				},
			],
		]),
	};
	const actor = {
		id: 'mage',
		uuid: 'Actor.mage',
		name: 'Mage',
		type: 'character',
		token: null,
		flags: {
			nimble: {
				chargePools: { [POOL]: { identifier: 'spellshaper', current: uses, max: 1, seeded: true } },
			},
		},
		rules: [] as unknown[],
		statuses: new Set<string>(),
		effects: [],
		items: { contents: [pool] as unknown[], get: () => undefined },
		system: {
			resources: { mana: { current: mana, max: 10 }, highestUnlockedSpellTier: 3 },
			attributes: { hp: { value: 20, max: 20, temp: 0 }, wounds: { value: 0, max: 6 } },
		},
		getRollData: () => ({}),
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

function usesLeft(actor: Hero): number {
	return actor.flags.nimble.chargePools[POOL].current;
}

interface OptionData {
	amount?: string;
	pool?: string;
	actionDelta?: number;
	actionMinimum?: number;
	tieredOnly?: boolean;
	schools?: string[];
}

/** A feature on the actor with a Spell or Attack Option rule. */
function giveOption(actor: Hero, name: string, data: OptionData = {}) {
	const item = { name, uuid: `Actor.mage.Item.${name}`, actor, getDomain: () => new Set() };
	const rule = new UseOptionRule({ type: 'useOption' } as never, { strict: false });
	Object.assign(rule, {
		id: 'option',
		type: 'useOption',
		disabled: false,
		label: '',
		target: 'spell',
		tieredOnly: data.tieredOnly ?? true,
		singleTargetOnly: false,
		schools: data.schools ?? [],
		spells: [],
		kind: 'mana',
		spendMode: 'fixed',
		amount: data.amount ?? '2',
		min: '',
		max: '',
		beyond: 'notAllowed',
		chargePoolIdentifier: data.pool ?? 'spellshaper',
		actionDelta: data.actionDelta ?? 0,
		actionMinimum: data.actionMinimum ?? 0,
	});
	Object.defineProperty(rule, 'parent', { get: () => item, configurable: true });
	Object.defineProperty(rule, 'predicate', {
		get: () => ({ size: 0, test: () => true }),
		configurable: true,
	});
	actor.rules.push(rule);
	return rule;
}

function spell(actor: Hero, name = 'Fire Bolt', tier = 1) {
	return Object.assign(Object.create(NimbleSpellItem.prototype), {
		id: name,
		uuid: `Item.${name}`,
		name,
		img: 'icon.webp',
		permission: 3,
		tags: new Set<string>(),
		actor,
		type: 'spell',
		rules: new Map(),
		system: {
			identifier: name.toLowerCase().replace(/ /g, '-'),
			tier,
			school: 'fire',
			activation: { effects: [], targets: { count: 1 } },
			description: { baseEffect: '', higherLevelEffect: '', upcastEffect: '' },
			properties: { selected: [] },
			scaling: null,
		},
		getDomain: () => new Set<string>(),
		_createActivationCard: vi.fn(async () => null),
		spellCardData: [] as Array<{ system: Record<string, unknown> }>,
		// The foundry mock merges shallowly, so the spell's card data is kept apart.
		async prepareChatCardData(this: any, options: object, manager: unknown) {
			const data = await NimbleSpellItem.prototype.prepareChatCardData.call(
				this,
				options,
				manager as never,
			);
			this.spellCardData.push(data);
			return {};
		},
	});
}

function cardOf(item: { _createActivationCard: ReturnType<typeof vi.fn> }) {
	return item._createActivationCard.mock.calls[0]?.[0] as
		| { system: Record<string, unknown>; flags: Record<string, Record<string, unknown>> }
		| undefined;
}

const dialog = {
	result: { rollMode: 0 } as Record<string, unknown> | null,
	opened: [] as Array<Record<string, unknown>>,
};

function FakeUpcastDialog(_actor: unknown, _item: unknown, _title: string, data: object) {
	dialog.opened.push(data as Record<string, unknown>);
	return { render: async () => undefined, promise: Promise.resolve(dialog.result) };
}

function setResourceSpending(on: boolean): void {
	globals.game.settings = {
		get: (_scope: string, key: string) => (key === 'automation.resourceSpending' ? on : false),
	};
}

let saved: Record<string, unknown>;

beforeEach(() => {
	saved = {
		settings: globals.game.settings,
		SpellUpcastDialog: testDependencies.SpellUpcastDialog,
	};
	dialog.result = { rollMode: 0 };
	dialog.opened = [];
	testDependencies.SpellUpcastDialog = FakeUpcastDialog as never;
	setResourceSpending(true);
	(Hooks.call as ReturnType<typeof vi.fn>).mockReturnValue(true);
	(Hooks.call as ReturnType<typeof vi.fn>).mockClear();
	globals.ChatMessage.getSpeaker = vi.fn(() => ({}));
	globals.CONST.CHAT_MESSAGE_STYLES = { OTHER: 0 };
	globals.CONFIG.sounds = { dice: 'dice' };
	vi.mocked(ui.notifications!.error).mockClear();
	vi.mocked(ui.notifications!.warn).mockClear();
});

afterEach(() => {
	globals.game.settings = saved.settings;
	testDependencies.SpellUpcastDialog = saved.SpellUpcastDialog as never;
});

function notices(): string[] {
	return [
		...vi.mocked(ui.notifications!.error).mock.calls,
		...vi.mocked(ui.notifications!.warn).mock.calls,
	].map(([message]) => String(message));
}

function choose(...keys: string[]) {
	dialog.result = { rollMode: 0, useOptions: keys.map((key) => ({ key })) };
}

describe('the options a spell dialog offers', () => {
	it('are the options the caster owns that apply to the spell, in one group for each pool', async () => {
		const actor = hero();
		const stretch = giveOption(actor, 'Stretch Time');
		giveOption(actor, 'Frost Focus', { schools: ['ice'] });

		await spell(actor).activate();

		const groups = dialog.opened[0]?.useOptionGroups as Array<Record<string, any>>;
		expect(groups).toHaveLength(1);
		expect(groups[0]).toMatchObject({ label: 'Spellshaper (1/turn)', used: false });
		expect(groups[0].options.map((each: { key: string }) => each.key)).toEqual([stretch.key]);
		expect(groups[0].options[0].cost).toMatchObject({ kind: 'mana', amount: 2 });
	});

	it('leave out an option for tiered spells on a cantrip', async () => {
		const actor = hero();
		giveOption(actor, 'Stretch Time');

		await spell(actor, 'Spark', 0).activate();

		expect(dialog.opened[0]?.useOptionGroups).toEqual([]);
	});

	it('mark a group as used when its pool has no use left', async () => {
		const actor = hero({ uses: 0 });
		giveOption(actor, 'Stretch Time');

		await spell(actor).activate();

		expect((dialog.opened[0]?.useOptionGroups as Array<{ used: boolean }>)[0].used).toBe(true);
	});
});

describe('casting a spell with a Spell or Attack Option', () => {
	it('spends the spell mana and the option mana, uses the pool, and shows the cost on the card', async () => {
		const actor = hero({ mana: 5 });
		const stretch = giveOption(actor, 'Stretch Time', { actionDelta: -1, actionMinimum: 1 });
		const item = spell(actor);
		choose(stretch.key);

		await item.activate();

		expect(actor.system.resources.mana.current).toBe(2);
		expect(usesLeft(actor)).toBe(0);
		const card = cardOf(item);
		expect(card?.system.costs).toEqual([{ kind: 'mana', amount: 2, source: 'Stretch Time' }]);
		expect(item.spellCardData[0]?.system.castManaSpent).toBe(1);
		expect(card?.flags.nimble.actionCostChanges).toEqual([{ delta: -1, minimum: 1 }]);
	});

	it('checks the spell mana and the option mana together, and spends nothing when they do not fit', async () => {
		const actor = hero({ mana: 2 });
		const stretch = giveOption(actor, 'Stretch Time');
		const item = spell(actor);
		choose(stretch.key);

		await item.activate();

		expect(actor.update).not.toHaveBeenCalled();
		expect(item._createActivationCard).not.toHaveBeenCalled();
		expect(notices()).toEqual(['Fire Bolt needs 3 mana, but only 2 is available.']);
	});

	it('refuses an option whose pool has no use left, and spends nothing', async () => {
		const actor = hero({ mana: 5, uses: 0 });
		const stretch = giveOption(actor, 'Stretch Time');
		const item = spell(actor);
		choose(stretch.key);

		await item.activate();

		expect(actor.update).not.toHaveBeenCalled();
		expect(notices()).toEqual(['Spellshaper (1/turn) has no use left.']);
	});

	it('does not count the option mana as mana spent on the spell', async () => {
		const actor = hero({ mana: 5 });
		const stretch = giveOption(actor, 'Stretch Time');
		choose(stretch.key);

		await spell(actor).activate();

		const preUse = vi
			.mocked(Hooks.call)
			.mock.calls.find(([name]) => String(name) === 'nimble.preUseItem');
		expect(preUse?.[2]).toMatchObject({ manaSpent: 1 });
	});

	it('with no option chosen, costs only the spell', async () => {
		const actor = hero({ mana: 5 });
		giveOption(actor, 'Stretch Time');
		const item = spell(actor);

		await item.activate();

		expect(actor.system.resources.mana.current).toBe(4);
		expect(usesLeft(actor)).toBe(1);
		expect(cardOf(item)?.system.costs).toEqual([]);
		expect(cardOf(item)?.flags.nimble.actionCostChanges).toBeUndefined();
	});

	it('stores on the card the mana the cast spent after less mana, without the option mana', async () => {
		const actor = hero({ mana: 5 });
		const stretch = giveOption(actor, 'Stretch Time');
		const item = spell(actor, 'Fire Bolt', 2);
		dialog.result = { rollMode: 0, lessMana: true, useOptions: [{ key: stretch.key }] };

		await item.activate();

		expect(actor.system.resources.mana.current).toBe(2);
		expect(item.spellCardData[0]?.system.castManaSpent).toBe(1);
	});

	it('with Resource Spending off, spends nothing but still shows the cost', async () => {
		setResourceSpending(false);
		const actor = hero({ mana: 0, uses: 0 });
		const stretch = giveOption(actor, 'Stretch Time');
		const item = spell(actor);
		choose(stretch.key);

		await item.activate();

		expect(actor.update).not.toHaveBeenCalled();
		expect(cardOf(item)?.system.costs).toEqual([
			{ kind: 'mana', amount: 2, source: 'Stretch Time' },
		]);
	});
});
