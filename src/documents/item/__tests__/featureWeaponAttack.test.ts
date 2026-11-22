import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Predicate } from '../../../etc/Predicate.js';
import { testDependencies } from '../../../managers/ItemActivationManager.js';
import { AttackOutcomeRule } from '../../../models/rules/attackOutcome.js';
import { OfferAttackBonusRule } from '../../../models/rules/offerAttackBonus.js';
import { PrimaryDieBonusRule } from '../../../models/rules/primaryDieBonus.js';
import { RerollRule } from '../../../models/rules/reroll.js';
import { SYSTEM_ID } from '../../../utils/systemId.js';
import { NimbleFeatureItem } from '../feature.js';

type Globals = Record<string, any>;
const globals = globalThis as Globals;

interface Node {
	id: string;
	type: string;
	formula?: string;
	damageType?: string;
	outcome?: string;
	text?: string;
	canMiss?: boolean;
	parentNode?: string | null;
	parentContext?: string | null;
	on?: Record<string, Node[]>;
}

const hitOutcome = (id: string, parent: string): Node => ({
	id,
	type: 'damageOutcome',
	outcome: 'fullDamage',
	parentNode: parent,
	parentContext: 'hit',
});

const extraDamage = (id: string, parent: string, formula: string, damageType: string): Node => ({
	id,
	type: 'damage',
	formula,
	damageType,
	parentNode: parent,
	parentContext: 'hit',
	on: { hit: [hitOutcome(`${id}Full`, id)] },
});

function hero() {
	const items: unknown[] = [];
	const actor = {
		id: 'hunter',
		uuid: 'Actor.hunter',
		name: 'Hunter',
		type: 'character',
		token: null,
		flags: {},
		rules: [] as unknown[],
		statuses: new Set<string>(),
		effects: [],
		items: Object.assign(items, {
			contents: items,
			get: () => undefined,
		}),
		system: {
			attributes: { hp: { value: 20, max: 20, temp: 0 }, wounds: { value: 0, max: 6 } },
			damageBonuses: [] as unknown[],
		},
		getRollData: () => ({}),
		getDomain: () => new Set<string>(),
		getActiveTokens: () => [],
		update: vi.fn(async () => undefined),
	};
	return actor;
}

type Hero = ReturnType<typeof hero>;

interface WeaponSpec {
	identifier?: string;
	effects?: Node[];
	rules?: Map<string, unknown>;
}

function longbow(actor: Hero, spec: WeaponSpec = {}) {
	const weapon = {
		id: 'longbow',
		uuid: 'Actor.hunter.Item.longbow',
		name: 'Longbow',
		identifier: spec.identifier ?? 'longbow',
		type: 'object',
		actor,
		isEmbedded: true,
		getDomain: () => new Set<string>(),
		flags: {},
		rules: spec.rules ?? new Map(),
		system: {
			objectType: 'weapon',
			equipped: true,
			properties: { selected: [] },
			activation: {
				targets: { attackType: 'range', distance: 8 },
				effects: spec.effects ?? [
					{
						id: 'bowDmg',
						type: 'damage',
						damageType: 'piercing',
						formula: '1d8',
						canMiss: true,
						parentNode: null,
						parentContext: null,
						on: { hit: [hitOutcome('bowFull', 'bowDmg')] },
					},
				],
			},
		},
	};
	actor.items.push(weapon);
	return weapon;
}

/** A feature that attacks with a ranged weapon, cannot miss, and adds its own fire damage. */
function incendiaryShot(actor: Hero, weaponAttack = 'ranged') {
	return Object.assign(Object.create(NimbleFeatureItem.prototype), {
		id: 'incendiary',
		uuid: 'Actor.hunter.Item.incendiary',
		name: 'Incendiary Shot',
		img: 'icon.webp',
		permission: 3,
		tags: new Set<string>(),
		actor,
		type: 'feature',
		rules: new Map(),
		system: {
			identifier: 'incendiary-shot',
			properties: { selected: [] },
			activation: {
				weaponAttack,
				targets: { attackType: 'range', count: 1 },
				effects: [
					{
						id: 'shotDmg',
						type: 'damage',
						damageType: 'piercing',
						formula: '1d6',
						canCrit: true,
						canMiss: false,
						parentNode: null,
						parentContext: null,
						on: { hit: [hitOutcome('shotFull', 'shotDmg')] },
					},
					{
						id: 'fireDmg',
						type: 'damage',
						damageType: 'fire',
						formula: '2d8',
						canCrit: false,
						canMiss: false,
						parentNode: null,
						parentContext: null,
						on: { hit: [hitOutcome('fireFull', 'fireDmg')] },
					},
				],
			},
		},
		getDomain: () => new Set<string>(),
		_createActivationCard: vi.fn(async () => null),
		prepareChatCardData: vi.fn(async () => ({})),
	});
}

interface Card {
	flags: Record<string, Record<string, unknown>>;
	system: { activation: { effects: Node[] } };
}

function cardOf(item: { _createActivationCard: ReturnType<typeof vi.fn> }): Card {
	return item._createActivationCard.mock.calls[0]?.[0] as Card;
}

function everyNode(nodes: Node[]): Node[] {
	return nodes.flatMap((node) => [node, ...everyNode(Object.values(node.on ?? {}).flat())]);
}

const dialog = { result: { rollMode: 0 } as Record<string, unknown> | null };

function FakeActivationDialog() {
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
		return { class: 'DamageRoll', formula: this.formula, total: 6, options: this.options };
	}
}

let saved: Record<string, unknown>;

beforeEach(() => {
	saved = {
		settings: globals.game.settings,
		ItemActivationConfigDialog: testDependencies.ItemActivationConfigDialog,
		DamageRoll: testDependencies.DamageRoll,
	};
	dialog.result = { rollMode: 0 };
	testDependencies.ItemActivationConfigDialog = FakeActivationDialog as never;
	testDependencies.DamageRoll = FakeDamageRoll as never;
	globals.game.settings = {
		get: (_scope: string, key: string) => key === 'automation.applyRuleEffects',
	};
	(Hooks.call as ReturnType<typeof vi.fn>).mockReturnValue(true);
	globals.ChatMessage.getSpeaker = vi.fn(() => ({}));
	globals.CONST.CHAT_MESSAGE_STYLES = { OTHER: 0 };
	globals.CONFIG.sounds = { dice: 'dice' };
});

afterEach(() => {
	globals.game.settings = saved.settings;
	testDependencies.ItemActivationConfigDialog = saved.ItemActivationConfigDialog as never;
	testDependencies.DamageRoll = saved.DamageRoll as never;
	vi.unstubAllGlobals();
});

function findItems(actor: Hero) {
	vi.stubGlobal('fromUuidSync', (uuid: string) =>
		(actor.items as unknown as Array<{ uuid: string }>).find((item) => item.uuid === uuid),
	);
}

describe('a feature attack with a weapon that has its own on-hit damage', () => {
	function flamingBow(actor: Hero) {
		return longbow(actor, {
			effects: [
				{
					id: 'bowDmg',
					type: 'damage',
					damageType: 'piercing',
					formula: '1d8',
					canMiss: true,
					parentNode: null,
					parentContext: null,
					on: {
						hit: [hitOutcome('bowFull', 'bowDmg'), extraDamage('bowFire', 'bowDmg', '1d4', 'fire')],
						criticalHit: [
							{
								id: 'bowCrit',
								type: 'note',
								text: 'The target is Smoldering.',
								parentNode: 'bowDmg',
								parentContext: 'criticalHit',
							},
						],
					},
				},
			],
		});
	}

	it('shows the feature rider and the weapon rider on the card', async () => {
		const actor = hero();
		flamingBow(actor);
		findItems(actor);
		const feature = incendiaryShot(actor);

		await feature.activate();

		const nodes = everyNode(cardOf(feature).system.activation.effects);
		const damage = nodes.filter((node) => node.type === 'damage');
		expect(damage.map((node) => [node.damageType, node.formula])).toEqual([
			['piercing', '1d8'],
			['fire', '1d4'],
			['fire', '2d8'],
		]);
		const attack = cardOf(feature).system.activation.effects[0];
		expect(attack.on?.hit?.map((node) => node.formula ?? node.outcome)).toEqual([
			'fullDamage',
			'1d4',
		]);
		expect(attack.on?.criticalHit?.map((node) => node.text)).toEqual(['The target is Smoldering.']);
	});

	it('keeps every node id unique, and the weapon nodes point at their new parents', async () => {
		const actor = hero();
		flamingBow(actor);
		findItems(actor);
		const feature = incendiaryShot(actor);

		await feature.activate();

		const nodes = everyNode(cardOf(feature).system.activation.effects);
		const ids = nodes.map((node) => node.id);
		expect(new Set(ids).size).toBe(ids.length);
		const byId = new Map(nodes.map((node) => [node.id, node]));
		for (const node of nodes) {
			if (node.parentNode) expect(byId.has(node.parentNode), node.id).toBe(true);
		}
		const rider = nodes.find((node) => node.formula === '1d4');
		expect(rider?.parentNode).toBe('shotDmg');
	});

	it('adds the damage of the hit only once', async () => {
		const actor = hero();
		flamingBow(actor);
		findItems(actor);
		const feature = incendiaryShot(actor);

		await feature.activate();

		const attack = cardOf(feature).system.activation.effects[0];
		expect(attack.on?.hit?.filter((node) => node.type === 'damageOutcome')).toHaveLength(1);
	});

	it("keeps the feature's cannot miss for the attack", async () => {
		const actor = hero();
		flamingBow(actor);
		findItems(actor);
		const feature = incendiaryShot(actor);

		await feature.activate();

		const attack = cardOf(feature).system.activation.effects[0] as Node & {
			roll: { options: { canMiss?: boolean } };
		};
		expect(attack.roll.options.canMiss).toBe(false);
	});

	it('adds the other nodes of the weapon after the nodes of the feature', async () => {
		const actor = hero();
		longbow(actor, {
			effects: [
				{
					id: 'bowDmg',
					type: 'damage',
					damageType: 'piercing',
					formula: '1d8',
					parentNode: null,
					parentContext: null,
					on: { hit: [hitOutcome('bowFull', 'bowDmg')] },
				},
				{
					id: 'bowNote',
					type: 'note',
					text: 'Only against the creature it was made for.',
					parentNode: null,
					parentContext: null,
				},
			],
		});
		findItems(actor);
		const feature = incendiaryShot(actor);

		await feature.activate();

		const top = cardOf(feature).system.activation.effects;
		expect(top.map((node) => node.text ?? node.formula)).toEqual([
			'1d8',
			'2d8',
			'Only against the creature it was made for.',
		]);
		expect(top[2].id).not.toBe('bowNote');
	});

	it('adds nothing for an Unarmed Strike', async () => {
		const actor = hero();
		Object.assign(actor.system, { unarmedDamage: '1' });
		findItems(actor);
		const feature = incendiaryShot(actor, 'unarmed');

		await feature.activate();

		const nodes = everyNode(cardOf(feature).system.activation.effects);
		expect(nodes.map((node) => node.id)).toEqual(['shotDmg', 'shotFull', 'fireDmg', 'fireFull']);
	});
});

describe('the card of a feature attack with a weapon', () => {
	it('records the weapon next to the feature', async () => {
		const actor = hero();
		longbow(actor);
		findItems(actor);
		const feature = incendiaryShot(actor);

		await feature.activate();

		expect(cardOf(feature).flags[SYSTEM_ID]).toMatchObject({
			itemUuid: 'Actor.hunter.Item.incendiary',
			weaponUuid: 'Actor.hunter.Item.longbow',
		});
	});

	it('records an Unarmed Strike', async () => {
		const actor = hero();
		Object.assign(actor.system, { unarmedDamage: '1' });
		findItems(actor);
		const feature = incendiaryShot(actor, 'unarmed');

		await feature.activate();

		expect(cardOf(feature).flags[SYSTEM_ID].weaponUuid).toBe('unarmedStrike');
	});

	it('records no weapon for a feature with its own damage', async () => {
		const actor = hero();
		longbow(actor);
		findItems(actor);
		const feature = incendiaryShot(actor, '');

		await feature.activate();

		expect(cardOf(feature).flags[SYSTEM_ID]).not.toHaveProperty('weaponUuid');
	});
});

describe('the rules of the weapon on a feature attack with it', () => {
	const bonus = (entry: Record<string, unknown>) => ({
		value: null,
		formula: null,
		damageType: '',
		delivery: 'any',
		source: 'any',
		itemIdentifier: '',
		targetCondition: null,
		...entry,
	});

	function attackFormula(feature: { _createActivationCard: ReturnType<typeof vi.fn> }) {
		const attack = cardOf(feature).system.activation.effects[0] as Node & {
			roll: { formula: string };
		};
		return attack.roll.formula;
	}

	it('adds a damage bonus that is only for attacks with that weapon', async () => {
		const actor = hero();
		longbow(actor, { identifier: 'flame-tongue' });
		actor.system.damageBonuses.push(
			bonus({ value: 2, itemIdentifier: 'flame-tongue' }),
			bonus({ formula: '1d6', itemIdentifier: 'flame-tongue' }),
			bonus({ value: 5, itemIdentifier: 'other-sword' }),
		);
		findItems(actor);
		const feature = incendiaryShot(actor);

		await feature.activate();

		expect(attackFormula(feature)).toBe('1d8 + 2 + 1d6');
	});

	it('keeps a damage bonus that is only for attacks with the feature', async () => {
		const actor = hero();
		longbow(actor);
		actor.system.damageBonuses.push(bonus({ value: 1, itemIdentifier: 'incendiary-shot' }));
		findItems(actor);
		const feature = incendiaryShot(actor);

		await feature.activate();

		expect(attackFormula(feature)).toBe('1d8 + 1');
	});

	it('adds the damage of an enchanted weapon (a weapon damage bonus from an effect)', async () => {
		const actor = hero();
		longbow(actor);
		actor.system.damageBonuses.push(bonus({ value: 3, source: 'weapon' }));
		findItems(actor);
		const feature = incendiaryShot(actor);

		await feature.activate();

		expect(attackFormula(feature)).toBe('1d8 + 3');
	});
});

describe('an Attack Outcome rule and a feature attack with a weapon', () => {
	function attackOutcome(owner: object, config: Record<string, unknown>) {
		const rule = new AttackOutcomeRule({ type: 'attackOutcome' } as never, { strict: false });
		Object.assign(rule, {
			type: 'attackOutcome',
			id: 'outcome',
			disabled: false,
			label: '',
			side: 'yourAttacks',
			cannotMiss: false,
			critRange: 0,
			forceCrit: 'none',
			anyDieCrits: false,
			attackDelivery: 'any',
			attackSource: 'any',
			thisItemOnly: false,
			exceptItemIdentifier: '',
			otherCreature: new Predicate({}),
			chargePoolIdentifier: '',
			predicate: new Predicate({}),
			...config,
		});
		Object.defineProperty(rule, 'parent', { get: () => owner, configurable: true });
		return rule;
	}

	function attackOptions(feature: { _createActivationCard: ReturnType<typeof vi.fn> }) {
		const attack = cardOf(feature).system.activation.effects[0] as Node & {
			roll: { options: Record<string, unknown> };
		};
		return attack.roll.options;
	}

	it("applies a rule for the weapon's own attacks", async () => {
		const actor = hero();
		const bow = longbow(actor);
		actor.rules.push(attackOutcome(bow, { thisItemOnly: true, forceCrit: 'always' }));
		findItems(actor);
		const feature = incendiaryShot(actor);

		await feature.activate();

		expect(attackOptions(feature).forcedCrit).toBe('always');
	});

	it('does not apply a rule that leaves out attacks with that weapon', async () => {
		const actor = hero();
		longbow(actor);
		const other = {
			isEmbedded: true,
			actor,
			uuid: 'Actor.hunter.Item.ring',
			getDomain: () => new Set(),
		};
		actor.rules.push(
			attackOutcome(other, { exceptItemIdentifier: 'longbow', forceCrit: 'always' }),
		);
		findItems(actor);
		const feature = incendiaryShot(actor);

		await feature.activate();

		expect(attackOptions(feature).forcedCrit).toBeUndefined();
	});
});

describe('a reroll for the attacks of a weapon, on a feature attack with it', () => {
	function rerollOn(owner: object) {
		const rule = new RerollRule({ type: 'reroll' } as never, { strict: false });
		Object.assign(rule, {
			type: 'reroll',
			id: 'lucky',
			label: 'Lucky Bow',
			rolls: ['attack'],
			usedBy: 'roller',
			outcome: 'always',
			attackDelivery: 'any',
			attackSource: 'any',
			thisItemOnly: true,
			automatic: false,
			discardedCritTriggers: false,
			rollModeChange: 0,
			primaryDieBonus: 0,
			extraDamage: '',
			chargePoolIdentifier: '',
			chargeCost: 1,
			manaCost: 0,
			woundCost: 0,
			heroicReaction: '',
			oncePerRoll: false,
			disabled: false,
			saves: [],
			skills: [],
			abilities: [],
			reach: 0,
			die: 'wholeRoll',
			keep: 'new',
		});
		Object.defineProperty(rule, 'parent', { get: () => owner, configurable: true });
		Object.defineProperty(rule, 'predicate', { get: () => ({ size: 0 }), configurable: true });
		return rule;
	}

	it('offers the reroll on the card', async () => {
		const actor = hero();
		const bow = longbow(actor);
		actor.rules.push(rerollOn(bow));
		findItems(actor);
		const feature = incendiaryShot(actor);

		await feature.activate();

		const card = cardOf(feature) as unknown as {
			system: { incomingReactions: Array<{ kind: string; ruleId: string }> };
		};
		expect(card.system.incomingReactions).toEqual([
			expect.objectContaining({ kind: 'reroll', ruleId: 'lucky' }),
		]);
	});
});

describe('a damage multiplier of the weapon, on a feature attack with it', () => {
	const doubling = () =>
		new Map([['double', { type: 'damageMultiplier', label: 'Giant Slayer', multiplier: 2 }]]);

	it('multiplies the damage when the player ticks it', async () => {
		const actor = hero();
		longbow(actor, { rules: doubling() });
		findItems(actor);
		const feature = incendiaryShot(actor);
		dialog.result = { rollMode: 0, damageMultiplier: true };

		await feature.activate();

		const attack = cardOf(feature).system.activation.effects[0] as Node & {
			damageMultiplier?: number;
		};
		expect(attack.damageMultiplier).toBe(2);
	});
});

describe('the built Incendiary Shot with a weapon that has its own on-hit damage', () => {
	const PACK = 'packs/classFeatures/core/hunter/thrill-of-the-hunt/incendiary-shot.json';

	it('has the weapon damage, the fire of the shot and the rider of the weapon, and cannot miss', async () => {
		const actor = hero();
		longbow(actor, {
			effects: [
				{
					id: 'bowDmg',
					type: 'damage',
					damageType: 'piercing',
					formula: '1d8',
					canMiss: true,
					parentNode: null,
					parentContext: null,
					on: {
						hit: [hitOutcome('bowFull', 'bowDmg'), extraDamage('bowCold', 'bowDmg', '1d4', 'cold')],
					},
				},
			],
		});
		findItems(actor);
		const feature = incendiaryShot(actor);
		feature.system.activation = JSON.parse(readFileSync(resolve(PACK), 'utf8')).system.activation;

		await feature.activate();

		const effects = cardOf(feature).system.activation.effects as Array<
			Node & { roll?: { options: { canMiss?: boolean } } }
		>;
		const damage = everyNode(effects).filter((node) => node.type === 'damage');
		expect(damage.map((node) => [node.damageType, node.formula])).toEqual([
			['piercing', '1d8'],
			['cold', '1d4'],
			['fire', '(@will)d8'],
		]);
		expect(effects[0].roll?.options.canMiss).toBe(false);
	});
});

describe('the origin of an attack', () => {
	function attackOptions(feature: { _createActivationCard: ReturnType<typeof vi.fn> }) {
		const attack = cardOf(feature).system.activation.effects[0] as Node & {
			roll: { options: Record<string, unknown> };
		};
		return attack.roll.options;
	}

	const incendiaryOrigin = { uuid: 'Actor.hunter.Item.incendiary', identifier: 'incendiary-shot' };

	it('is the feature itself when the feature is the attack, on the card and on the roll', async () => {
		const actor = hero();
		longbow(actor);
		findItems(actor);
		const feature = incendiaryShot(actor);

		await feature.activate();

		expect(cardOf(feature).flags[SYSTEM_ID].origin).toEqual(incendiaryOrigin);
		expect(attackOptions(feature).origin).toEqual(incendiaryOrigin);
	});

	function grantingFeature(actor: Hero) {
		const granting = {
			uuid: 'Actor.hunter.Item.granting',
			name: 'Granting Feature',
			identifier: 'granting-feature',
			type: 'feature',
			flags: {},
		};
		actor.items.push(granting);
		return granting;
	}

	const grantingOrigin = { uuid: 'Actor.hunter.Item.granting', identifier: 'granting-feature' };

	it('is the granting feature for an attack made through it', async () => {
		const actor = hero();
		longbow(actor);
		const granting = grantingFeature(actor);
		findItems(actor);
		const feature = incendiaryShot(actor);

		await feature.activate({ originUuid: granting.uuid });

		expect(cardOf(feature).flags[SYSTEM_ID].origin).toEqual(grantingOrigin);
		expect(attackOptions(feature).origin).toEqual(grantingOrigin);
	});

	it('takes the granting feature by its old option name too', async () => {
		const actor = hero();
		longbow(actor);
		const granting = grantingFeature(actor);
		findItems(actor);
		const feature = incendiaryShot(actor);

		await feature.activate({ offerSourceUuid: granting.uuid });

		expect(attackOptions(feature).origin).toEqual(grantingOrigin);
	});

	describe('a damage bonus for attacks made through one feature', () => {
		const bonus = (entry: Record<string, unknown>) => ({
			value: null,
			formula: null,
			damageType: '',
			delivery: 'any',
			source: 'any',
			itemIdentifier: '',
			attackOrigin: '',
			targetCondition: null,
			...entry,
		});

		function attackFormula(feature: { _createActivationCard: ReturnType<typeof vi.fn> }) {
			const attack = cardOf(feature).system.activation.effects[0] as Node & {
				roll: { formula: string };
			};
			return attack.roll.formula;
		}

		function scopedHero() {
			const actor = hero();
			longbow(actor);
			const granting = grantingFeature(actor);
			actor.system.damageBonuses.push(
				bonus({ value: 2, attackOrigin: 'granting-feature' }),
				bonus({ formula: '1d6', attackOrigin: 'granting-feature' }),
			);
			findItems(actor);
			return { actor, granting };
		}

		it('adds to an attack made through that feature', async () => {
			const { actor, granting } = scopedHero();
			const feature = incendiaryShot(actor);

			await feature.activate({ originUuid: granting.uuid });

			expect(attackFormula(feature)).toBe('1d8 + 2 + 1d6');
		});

		it('adds nothing to an attack made another way', async () => {
			const { actor } = scopedHero();
			const feature = incendiaryShot(actor);

			await feature.activate();

			expect(attackFormula(feature)).toBe('1d8');
		});

		it('adds to every attack when the field is blank', async () => {
			const actor = hero();
			longbow(actor);
			actor.system.damageBonuses.push(bonus({ value: 3 }));
			findItems(actor);
			const feature = incendiaryShot(actor);

			await feature.activate();

			expect(attackFormula(feature)).toBe('1d8 + 3');
		});
	});

	describe('a Primary Die bonus for attacks made through one feature', () => {
		function primaryDieBonus(owner: object) {
			const rule = new PrimaryDieBonusRule({ type: 'primaryDieBonus' } as never, { strict: false });
			Object.assign(rule, {
				type: 'primaryDieBonus',
				id: 'steady',
				disabled: false,
				label: 'Steady',
				value: '1',
				attackDelivery: 'any',
				attackOrigin: 'granting-feature',
				otherCreature: new Predicate({}),
				predicate: new Predicate({}),
				resolveFormula: () => 1,
			});
			Object.defineProperty(rule, 'parent', { get: () => owner, configurable: true });
			return rule;
		}

		it('adds to an attack made through that feature, and not to another attack', async () => {
			const actor = hero();
			longbow(actor);
			const granting = grantingFeature(actor);
			actor.rules.push(
				primaryDieBonus({ ...granting, isEmbedded: true, actor, getDomain: () => new Set() }),
			);
			findItems(actor);
			const through = incendiaryShot(actor);
			const plain = incendiaryShot(actor);

			await through.activate({ originUuid: granting.uuid });
			await plain.activate();

			expect(attackOptions(through).primaryDieModifier).toBe(1);
			expect(attackOptions(plain).primaryDieModifier).toBe(0);
		});
	});

	describe('an attack bonus for attacks made through one feature', () => {
		function attackBonus(owner: object) {
			const rule = new OfferAttackBonusRule({ type: 'offerAttackBonus' } as never, {
				strict: false,
			});
			Object.assign(rule, {
				type: 'offerAttackBonus',
				id: 'heavy',
				disabled: false,
				label: 'Heavy Hand',
				offerSource: 'granting-feature',
				damage: '5',
				primaryDie: 1,
				predicate: new Predicate({}),
				resolveFormula: () => 5,
			});
			Object.defineProperty(rule, 'parent', { get: () => owner, configurable: true });
			return rule;
		}

		it('adds to an attack made through that feature, and not to another attack', async () => {
			const actor = hero();
			longbow(actor);
			const granting = grantingFeature(actor);
			actor.rules.push(
				attackBonus({ ...granting, isEmbedded: true, actor, getDomain: () => new Set() }),
			);
			findItems(actor);
			const through = incendiaryShot(actor);
			const plain = incendiaryShot(actor);

			await through.activate({ originUuid: granting.uuid });
			await plain.activate();

			const formulaOf = (feature: typeof through) =>
				(cardOf(feature).system.activation.effects[0] as Node & { roll: { formula: string } }).roll
					.formula;
			expect(formulaOf(through)).toBe('1d8 + 5');
			expect(attackOptions(through).primaryDieModifier).toBe(1);
			expect(formulaOf(plain)).toBe('1d8');
			expect(attackOptions(plain).primaryDieModifier).toBe(0);
		});
	});
});
