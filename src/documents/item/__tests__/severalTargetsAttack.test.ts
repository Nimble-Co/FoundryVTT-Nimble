import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { testDependencies } from '../../../managers/ItemActivationManager.js';
import { NimbleFeatureItem } from '../feature.js';

type Globals = Record<string, any>;
const globals = globalThis as Globals;

interface Node {
	id: string;
	type: string;
	formula?: string;
	damageType?: string;
	forTarget?: string;
	canMiss?: boolean;
	roll?: { formula: string; options: Record<string, unknown> };
	on?: Record<string, Node[]>;
}

function packFeature(path: string) {
	return JSON.parse(readFileSync(resolve(__dirname, '../../../../packs', path), 'utf8'));
}

function hero(level = 1) {
	const items: unknown[] = [];
	return {
		id: 'hero',
		uuid: 'Actor.hero',
		name: 'Hero',
		type: 'character',
		token: null,
		flags: {},
		rules: [] as unknown[],
		statuses: new Set<string>(),
		effects: [],
		items: Object.assign(items, { contents: items, get: () => undefined }),
		system: {
			attributes: { hp: { value: 20, max: 20, temp: 0 }, wounds: { value: 0, max: 6 } },
			damageBonuses: [] as unknown[],
		},
		getRollData: () => ({ level, dexterity: 3 }),
		getFlag: () => undefined,
		getDomain: () => new Set<string>(),
		getActiveTokens: () => [],
		update: vi.fn(async () => undefined),
	};
}

type Hero = ReturnType<typeof hero>;

function greataxe(actor: Hero) {
	const weapon = {
		id: 'greataxe',
		uuid: 'Actor.hero.Item.greataxe',
		name: 'Greataxe',
		identifier: 'greataxe',
		type: 'object',
		actor,
		isEmbedded: true,
		getDomain: () => new Set<string>(),
		flags: {},
		rules: new Map(),
		system: {
			objectType: 'weapon',
			equipped: true,
			properties: { selected: ['twoHanded'] },
			activation: {
				targets: { attackType: 'reach', distance: 1 },
				effects: [
					{
						id: 'axeDmg',
						type: 'damage',
						damageType: 'slashing',
						formula: '1d12',
						canMiss: true,
						parentNode: null,
						parentContext: null,
						on: {
							hit: [
								{
									id: 'axeFull',
									type: 'damageOutcome',
									outcome: 'fullDamage',
									parentNode: 'axeDmg',
									parentContext: 'hit',
								},
							],
						},
					},
				],
			},
		},
	};
	actor.items.push(weapon);
	return weapon;
}

function featureOf(actor: Hero, path: string) {
	const source = packFeature(path);
	return Object.assign(Object.create(NimbleFeatureItem.prototype), {
		id: source._id,
		uuid: `Actor.hero.Item.${source._id}`,
		name: source.name,
		img: source.img,
		permission: 3,
		tags: new Set<string>(),
		actor,
		type: 'feature',
		rules: new Map(),
		system: { ...source.system, properties: { selected: [] } },
		getDomain: () => new Set<string>(),
		_createActivationCard: vi.fn(async () => null),
		prepareChatCardData: vi.fn(async () => ({})),
	});
}

interface Card {
	system: { targets: string[]; activation: { effects: Node[]; targets: Record<string, unknown> } };
}

function cardOf(item: { _createActivationCard: ReturnType<typeof vi.fn> }): Card {
	return item._createActivationCard.mock.calls[0]?.[0] as Card;
}

function everyNode(nodes: Node[]): Node[] {
	return nodes.flatMap((node) => [node, ...everyNode(Object.values(node.on ?? {}).flat())]);
}

const rolls: FakeDamageRoll[] = [];

class FakeDamageRoll {
	formula: string;
	options: Record<string, unknown>;

	constructor(formula: string, _data: unknown, options: Record<string, unknown> = {}) {
		this.formula = formula;
		this.options = options;
		rolls.push(this);
	}

	async evaluate() {
		return this;
	}

	toJSON() {
		return { class: 'DamageRoll', formula: this.formula, total: 6, options: this.options };
	}
}

const dialog = {
	result: { rollMode: 0 } as Record<string, unknown> | null,
	opened: null as Record<string, unknown> | null,
};

function FakeActivationDialog(_actor: unknown, _item: unknown, _title: string, options: object) {
	dialog.opened = options as Record<string, unknown>;
	return { render: async () => undefined, promise: Promise.resolve(dialog.result) };
}

function target(name: string) {
	const actor = {
		uuid: `Actor.${name}`,
		name,
		rules: [],
		getFlag: () => undefined,
		getDomain: () => new Set<string>(),
	};
	return { name, actor, document: { uuid: `Token.${name}`, name, actor } };
}

let saved: Record<string, unknown>;

beforeEach(() => {
	saved = {
		settings: globals.game.settings,
		targets: globals.game.user.targets,
		ItemActivationConfigDialog: testDependencies.ItemActivationConfigDialog,
		DamageRoll: testDependencies.DamageRoll,
	};
	rolls.length = 0;
	dialog.result = { rollMode: 0 };
	dialog.opened = null;
	testDependencies.ItemActivationConfigDialog = FakeActivationDialog as never;
	testDependencies.DamageRoll = FakeDamageRoll as never;
	globals.game.settings = {
		get: (_scope: string, key: string) => key === 'automation.applyRuleEffects',
	};
	globals.game.user.targets = [target('goblin'), target('kobold'), target('orc')];
	(Hooks.call as ReturnType<typeof vi.fn>).mockReturnValue(true);
	globals.ChatMessage.getSpeaker = vi.fn(() => ({}));
	globals.CONST.CHAT_MESSAGE_STYLES = { OTHER: 0 };
	globals.CONFIG.sounds = { dice: 'dice' };
});

afterEach(() => {
	globals.game.settings = saved.settings;
	globals.game.user.targets = saved.targets;
	testDependencies.ItemActivationConfigDialog = saved.ItemActivationConfigDialog as never;
	testDependencies.DamageRoll = saved.DamageRoll as never;
	vi.unstubAllGlobals();
});

function findItems(actor: Hero) {
	vi.stubGlobal('canvas', { tokens: { placeables: [] } });
	vi.stubGlobal('fromUuidSync', (uuid: string) =>
		(actor.items as unknown as Array<{ uuid: string }>).find((item) => item.uuid === uuid),
	);
}

describe.each([
	['Whirlwind', 'classFeatures/core/berserker/savage-arsenal/whirlwind.json', true],
	['Sweeping Strike', 'classFeatures/core/commander/combat-tactics/sweeping-strike.json', false],
])('%s', (_name, path, canMiss) => {
	it('costs 2 actions and attacks with a melee weapon', () => {
		const { activation } = packFeature(path).system;

		expect(activation.cost).toMatchObject({ type: 'action', quantity: 2 });
		expect(activation.weaponAttack).toBe('melee');
	});

	it('rolls once with the weapon for every target, and each target is on the card', async () => {
		const actor = hero();
		greataxe(actor);
		findItems(actor);
		const feature = featureOf(actor, path);

		await feature.activate();

		expect(rolls).toHaveLength(1);
		expect(rolls[0].formula).toBe('1d12');
		expect(cardOf(feature).system.targets).toEqual(['Token.goblin', 'Token.kobold', 'Token.orc']);
		expect(cardOf(feature).system.activation.targets).toMatchObject({
			singleTargetAttack: true,
			distance: 1,
		});
	});

	it(`can crit${canMiss ? ' and miss' : ', and does not miss on a 1'}`, async () => {
		const actor = hero();
		greataxe(actor);
		findItems(actor);
		const feature = featureOf(actor, path);

		await feature.activate();

		expect(rolls[0].options).toMatchObject({ canCrit: true, canMiss });
		expect(rolls[0].options).not.toHaveProperty('multiTarget');
	});
});

describe('the Bonescythe', () => {
	const BONESCYTHE =
		'classFeatures/core/shadowmancer/shadowmancer-subclasses/reaver/bonescythe.json';
	const RollGlobal = Roll as unknown as Record<string, unknown>;
	const original = { replace: RollGlobal.replaceFormulaData, safeEval: RollGlobal.safeEval };

	beforeEach(() => {
		RollGlobal.replaceFormulaData = (formula: string, data: Record<string, number>) =>
			formula.replace(/@(\w+)/g, (_match, key: string) => String(data[key] ?? 0));
		RollGlobal.safeEval = (expression: string) =>
			Function('floor', `"use strict"; return (${expression});`)(Math.floor);
	});

	afterEach(() => {
		RollGlobal.replaceFormulaData = original.replace;
		RollGlobal.safeEval = original.safeEval;
	});

	function damageOf(feature: { _createActivationCard: ReturnType<typeof vi.fn> }) {
		return everyNode(cardOf(feature).system.activation.effects)
			.filter((node) => node.type === 'damage')
			.map((node) => [node.forTarget ?? null, node.damageType, node.formula]);
	}

	it('strikes with 2d12 slashing and DEX necrotic for each die, at Reach 2', async () => {
		globals.game.user.targets = [target('goblin')];
		const actor = hero(1);
		findItems(actor);
		const feature = featureOf(actor, BONESCYTHE);

		await feature.activate();

		expect(rolls[0].formula).toBe('2d12');
		expect(rolls[0].options).toMatchObject({ canCrit: true, canMiss: true });
		expect(damageOf(feature)).toEqual([
			[null, 'slashing', '(2 + floor(@level / 5))d12'],
			[null, 'necrotic', '(2 + floor(@level / 5)) * @dexterity'],
		]);
		expect(cardOf(feature).system.activation.targets).toMatchObject({
			attackType: 'reach',
			distance: 2,
		});
	});

	describe('with Grim Harrow', () => {
		function grimHarrow(actor: Hero) {
			const source = packFeature(
				'classFeatures/core/shadowmancer/shadowmancer-subclasses/reaver/grim-harrow.json',
			);
			const data = source.system.rules[0];
			actor.rules.push({
				...data,
				dividesDiceFor: (origin: string) =>
					origin === data.attackOrigin ? { source: 'Grim Harrow' } : null,
			});
		}

		function reaver(level = 5) {
			const actor = hero(level);
			grimHarrow(actor);
			findItems(actor);
			return { actor, feature: featureOf(actor, BONESCYTHE) };
		}

		it('asks in the window how to divide the dice among the targets', async () => {
			const { feature } = reaver();

			await feature.activate();

			expect(dialog.opened?.diceDivision).toEqual({
				source: 'Grim Harrow',
				dice: 3,
				targets: [
					{ uuid: 'Token.goblin', name: 'goblin' },
					{ uuid: 'Token.kobold', name: 'kobold' },
					{ uuid: 'Token.orc', name: 'orc' },
				],
			});
		});

		it('rolls the dice of the first target as the attack, and the dice of the others as their damage', async () => {
			const { feature } = reaver();
			dialog.result = {
				rollMode: 0,
				diceShares: [
					{ targetUuid: 'Token.goblin', dice: 2 },
					{ targetUuid: 'Token.kobold', dice: 0 },
					{ targetUuid: 'Token.orc', dice: 1 },
				],
			};

			await feature.activate();

			expect(rolls).toHaveLength(1);
			expect(rolls[0].formula).toBe('2d12');
			expect(rolls[0].options).toMatchObject({ canCrit: true, canMiss: true });
			expect(rolls[0].options).not.toHaveProperty('multiTarget');
			expect(damageOf(feature)).toEqual([
				['Token.goblin', 'slashing', '2d12'],
				['Token.orc', 'slashing', '1d12'],
				['Token.goblin', 'necrotic', 'floor(((2 + floor(@level / 5)) * @dexterity) * 2 / 3)'],
				['Token.orc', 'necrotic', 'floor(((2 + floor(@level / 5)) * @dexterity) * 1 / 3)'],
			]);
			expect(cardOf(feature).system.targets).toEqual(['Token.goblin', 'Token.orc']);
		});

		it('rolls all the dice as the attack when one target gets them all', async () => {
			globals.game.user.targets = [target('goblin'), target('kobold')];
			const { feature } = reaver(1);
			dialog.result = {
				rollMode: 0,
				diceShares: [
					{ targetUuid: 'Token.goblin', dice: 2 },
					{ targetUuid: 'Token.kobold', dice: 0 },
				],
			};

			await feature.activate();

			expect(rolls).toHaveLength(1);
			expect(rolls[0].formula).toBe('2d12');
			expect(cardOf(feature).system.targets).toEqual(['Token.goblin']);
		});

		it('spreads the dice evenly over the targets with no window', async () => {
			const { feature } = reaver(1);

			await feature.activate({ fastForward: true });

			expect(rolls[0].formula).toBe('1d12');
			expect(cardOf(feature).system.targets).toEqual(['Token.goblin', 'Token.kobold']);
		});

		it('asks nothing with one target', async () => {
			globals.game.user.targets = [target('goblin')];
			const { feature } = reaver();

			await feature.activate();

			expect(dialog.opened).not.toHaveProperty('diceDivision');
			expect(rolls[0].formula).toBe('3d12');
		});
	});
});
