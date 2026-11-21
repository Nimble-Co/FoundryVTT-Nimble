import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { testDependencies } from '../../../managers/ItemActivationManager.js';
import { ActionCostRule } from '../../../models/rules/actionCost.js';
import { SpellManaCostRule } from '../../../models/rules/spellManaCost.js';
import { effectEndsAt } from '../../../utils/lastsUntil/effectEndsAt.js';
import type { Moment } from '../../../utils/lastsUntil/momentReached.js';
import resolveCharacterItemActionCost from '../../actor/resolveCharacterItemActionCost.js';
import { NimbleSpellItem } from '../spell.js';

type Globals = Record<string, any>;
const globals = globalThis as Globals;

function hero({ mana = 5 } = {}) {
	const actor = {
		id: 'mage',
		uuid: 'Actor.mage',
		name: 'Mage',
		type: 'character',
		token: null,
		flags: {},
		rules: [] as unknown[],
		statuses: new Set<string>(),
		effects: [],
		items: { contents: [] as unknown[], get: () => undefined },
		system: {
			resources: { mana: { current: mana, max: 10 }, highestUnlockedSpellTier: 9 },
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

/** A rule that sits on an effect the creature has, as the effect of a feature gives it. */
function onEffect<T extends object>(actor: Hero, rule: T, fields: Record<string, unknown>): T {
	const effect = { name: 'Archmage', target: actor };
	Object.assign(rule, { id: 'rule', disabled: false, label: '', priority: 1, ...fields });
	Object.defineProperty(rule, 'parent', { get: () => effect, configurable: true });
	Object.defineProperty(rule, 'predicate', {
		get: () => ({ size: 0, test: () => true }),
		configurable: true,
	});
	actor.rules.push(rule);
	return rule;
}

/** The effect of Archmage: 5 fewer mana for a tiered spell. */
function giveManaCut(actor: Hero, value = '-5', itemIdentifier = '') {
	const rule = new SpellManaCostRule({ type: 'spellManaCost' } as never, { strict: false });
	return onEffect(actor, rule, { type: 'spellManaCost', value, itemIdentifier });
}

/** The effect of Archmage: 1 action less for a tiered spell. */
function giveActionCut(actor: Hero) {
	const rule = new ActionCostRule({ type: 'actionCost' } as never, { strict: false });
	return onEffect(actor, rule, {
		type: 'actionCost',
		applies: 'item',
		mode: 'delta',
		value: '-1',
		itemTypes: ['spell'],
		itemIdentifier: '',
		reactions: [],
		tieredOnly: true,
	});
}

function spell(actor: Hero, name = 'Fire Bolt', tier = 3) {
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
			activation: { effects: [], targets: { count: 1 }, cost: { type: 'action', quantity: 1 } },
			description: { baseEffect: '', higherLevelEffect: '', upcastEffect: '' },
			properties: { selected: [] },
			scaling: { mode: 'upcast', deltas: [] },
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

type Spell = ReturnType<typeof spell>;

function castManaSpent(item: Spell): unknown {
	return item.spellCardData[0]?.system.castManaSpent;
}

const dialog = {
	result: { rollMode: 0 } as Record<string, unknown> | null,
	opened: [] as Array<Record<string, unknown>>,
};

function FakeUpcastDialog(_actor: unknown, _item: unknown, _title: string, data: object) {
	dialog.opened.push(data as Record<string, unknown>);
	return { render: async () => undefined, promise: Promise.resolve(dialog.result) };
}

function castAt(tier: number) {
	dialog.result = { rollMode: 0, upcast: { manaToSpend: tier, choiceIndex: undefined } };
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

describe('a tiered spell cast while an effect lowers its mana cost', () => {
	it('spends 5 fewer mana, down to 0, and the card stores the mana spent', async () => {
		const actor = hero({ mana: 5 });
		giveManaCut(actor);
		const item = spell(actor, 'Fire Bolt', 3);

		await item.activate();

		expect(actor.system.resources.mana.current).toBe(5);
		expect(castManaSpent(item)).toBe(0);
		expect(notices()).toEqual([]);
	});

	it('takes the 5 off an upcast too, and lets the caster reach a tier above their mana', async () => {
		const actor = hero({ mana: 3 });
		giveManaCut(actor);
		const item = spell(actor, 'Fire Bolt', 3);
		castAt(7);

		await item.activate();

		expect(actor.system.resources.mana.current).toBe(1);
		expect(castManaSpent(item)).toBe(2);
		expect(item.spellCardData[0]?.system.upcast).toMatchObject({ upcastSteps: 4 });
		expect(dialog.opened[0]).toMatchObject({ manaCostChange: -5 });
	});

	it('refuses a tier whose lowered cost is still more than the caster has, and spends nothing', async () => {
		const actor = hero({ mana: 3 });
		giveManaCut(actor);
		const item = spell(actor, 'Fire Bolt', 3);
		castAt(9);

		await item.activate();

		expect(actor.update).not.toHaveBeenCalled();
		expect(item._createActivationCard).not.toHaveBeenCalled();
		expect(notices()).toEqual(['Fire Bolt needs 4 mana, but only 3 is available.']);
	});

	it('does not change a cantrip, or a spell another identifier names', async () => {
		const actor = hero({ mana: 5 });
		giveManaCut(actor, '-5', 'ice-lance');
		const named = spell(actor, 'Fire Bolt', 2);

		await named.activate();
		await spell(actor, 'Spark', 0).activate();

		expect(actor.system.resources.mana.current).toBe(3);
		expect(castManaSpent(named)).toBe(2);
	});
});

describe('a spell cast while an effect lowers the action cost of tiered spells', () => {
	it('costs 1 action less for a tiered spell, and the full cost for a cantrip', () => {
		const actor = hero();
		giveActionCut(actor);

		expect(resolveCharacterItemActionCost(actor, spell(actor, 'Fire Bolt', 3))).toBe(0);
		expect(resolveCharacterItemActionCost(actor, spell(actor, 'Spark', 0))).toBe(1);
	});
});

function moment(fields: Partial<Moment>): Moment {
	return {
		kind: 'event',
		boundary: null,
		clock: null,
		span: null,
		value: null,
		units: null,
		who: 'holder',
		event: null,
		effectName: '',
		...fields,
	};
}

describe('the effect that lowers the cost', () => {
	it('ends at the next tiered spell its holder casts, not at a cantrip', () => {
		const holder = new Actor({ uuid: 'Actor.mage', type: 'character' } as never);
		const archmage = Object.assign(Object.create(ActiveEffect.prototype), {
			parent: holder,
			active: true,
			origin: null,
			statuses: new Set<string>(),
			isTemporary: false,
			isMinor: false,
			lastsUntil: [moment({ event: 'nextSpell' }), moment({ event: 'combatEnd' })],
			start: { time: 0 },
		}) as ActiveEffect;
		expect(effectEndsAt(archmage, { type: 'event', event: 'nextSpell', actor: holder })).toBe(true);
		expect(effectEndsAt(archmage, { type: 'event', event: 'castSpell', actor: holder })).toBe(
			false,
		);
	});
});

describe('a free cast of a spell that a rule gives free of mana', () => {
	const free = {
		of: ['mana'] as ['mana'],
		reason: { key: 'NIMBLE.rules.useItemFree.cardLine', data: {} },
		window: true,
	};

	it('at the spell tier spends no mana', async () => {
		const actor = hero({ mana: 0 });
		const item = spell(actor, 'Enchant Weapon', 2);

		await item.activate({ free });

		expect(actor.update).not.toHaveBeenCalled();
		expect(castManaSpent(item)).toBe(0);
		expect(notices()).toEqual([]);
	});

	it('can still upcast, and the upcast spends only the mana above the spell tier', async () => {
		const actor = hero({ mana: 2 });
		const item = spell(actor, 'Enchant Weapon', 2);
		castAt(4);

		await item.activate({ free });

		expect(dialog.opened[0]).toMatchObject({ manaCostChange: -2 });
		expect(actor.system.resources.mana.current).toBe(0);
		expect(castManaSpent(item)).toBe(2);
		expect(item.spellCardData[0]?.system.upcast).toMatchObject({ upcastSteps: 2 });
	});

	it('refuses an upcast whose mana above the spell tier is more than the caster has', async () => {
		const actor = hero({ mana: 1 });
		const item = spell(actor, 'Enchant Weapon', 2);
		castAt(4);

		await item.activate({ free });

		expect(actor.update).not.toHaveBeenCalled();
		expect(notices()).toEqual(['Enchant Weapon needs 2 mana, but only 1 is available.']);
	});
});
