import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { taggedCreature } from '../../../../tests/fixtures/conditionCreature.js';

const conditionalBonuses = vi.fn(() => []);
const dicePools = vi.fn((): unknown[] => []);
const fixedCosts = vi.fn((): unknown[] => []);
const chargePools = vi.fn((): unknown[] => []);

// Setup loads this module through game.ts, so a hoisted vi.mock would miss it.
let createState: typeof import('../itemActivationConfigDialogState.svelte.ts').createItemActivationConfigDialogState;

const math = Math as unknown as { clamp?: (value: number, min: number, max: number) => number };
const ownClamp = math.clamp;

beforeAll(async () => {
	math.clamp ??= (value, min, max) => Math.min(max, Math.max(min, value));
	vi.resetModules();
	vi.doMock('#utils/actor/conditionalBonuses.js', () => ({
		getActiveConditionalBonuses: conditionalBonuses,
	}));
	vi.doMock('#utils/chargePool/fixedChargeCosts.js', () => ({ fixedChargeCostsOf: fixedCosts }));
	vi.doMock('#utils/chargePool/chargePoolSync.js', async (importOriginal) => ({
		...(await importOriginal<object>()),
		getPools: chargePools,
	}));
	vi.doMock('#utils/dicePool/dicePoolSync.js', async (importOriginal) => ({
		...(await importOriginal<object>()),
		getPools: dicePools,
	}));
	({ createItemActivationConfigDialogState: createState } = await import(
		'../itemActivationConfigDialogState.svelte.ts'
	));
});

const user = (globalThis as unknown as { game: { user: { targets?: unknown } } }).game.user;
const before = user.targets;

afterEach(() => {
	user.targets = before;
	conditionalBonuses.mockClear();
});

afterAll(() => {
	math.clamp = ownClamp;
});

function openWith(targetActors: object[]) {
	user.targets = new Set(targetActors.map((actor) => ({ actor })));
	createState({
		actor: () => ({ rules: [], system: {}, items: [], getFlag: () => undefined }) as never,
		item: () => ({ type: 'weapon', system: { activation: { effects: [] } } }) as never,
		hideRollsDefault: false,
	});
	return (conditionalBonuses.mock.calls[0] as unknown[])[2];
}

describe('the activation dialog conditional bonuses', () => {
	it('test the target when there is one', () => {
		const goblin = { uuid: 'Actor.goblin' };

		expect(openWith([goblin])).toBe(goblin);
	});

	it('have no target to test with two targets', () => {
		expect(openWith([{ uuid: 'Actor.goblin' }, { uuid: 'Actor.kobold' }])).toBeUndefined();
	});

	it('test the first target when the targets share one attack', () => {
		const goblin = { uuid: 'Actor.goblin' };
		user.targets = new Set([{ actor: goblin }, { actor: { uuid: 'Actor.kobold' } }]);
		createState({
			actor: () => ({ rules: [], system: {}, items: [], getFlag: () => undefined }) as never,
			item: () => ({ type: 'weapon', system: { activation: { effects: [] } } }) as never,
			hideRollsDefault: false,
			sharesOneAttack: true,
		});

		expect((conditionalBonuses.mock.calls[0] as unknown[])[2]).toBe(goblin);
	});

	it('are asked for the feature the attack is made through', () => {
		user.targets = new Set();
		createState({
			actor: () => ({ rules: [], system: {}, items: [], getFlag: () => undefined }) as never,
			item: () => ({ type: 'weapon', system: { activation: { effects: [] } } }) as never,
			hideRollsDefault: false,
			attackOrigin: 'granting-feature',
		});
		expect((conditionalBonuses.mock.calls[0] as unknown[])[4]).toBe('granting-feature');
	});
});

describe('the activation dialog bonus of an item damage', () => {
	const assist = {
		key: 'Item.assist:rule',
		label: 'Assist Me',
		advantage: 0,
		damageValue: null,
		damageFormula: '1d6+@will',
		damageType: '',
		fromItemIdentifier: 'lifebinding-spirit',
		startsChosen: false,
	};

	function open(options: object[]) {
		user.targets = new Set();
		conditionalBonuses.mockReturnValueOnce(options as never);
		return createState({
			actor: () => ({ rules: [], system: {}, items: [], getFlag: () => undefined }) as never,
			item: () =>
				({
					type: 'weapon',
					system: {
						activation: {
							effects: [{ id: 'd', type: 'damage', formula: '1d8', damageType: 'bludgeoning' }],
						},
					},
				}) as never,
			hideRollsDefault: false,
		});
	}

	it('starts on None when the bonus does not start chosen', () => {
		const state = open([assist, { ...assist, key: 'Item.other:rule', startsChosen: true }]);

		expect(state.conditionalChoices).toEqual({
			'Item.assist:rule': 'none',
			'Item.other:rule': 'damage',
		});
		expect(state.conditionalTypedDamages).toEqual([
			{
				formula: '1d6+@will',
				damageType: '',
				label: 'Assist Me',
				fromItemIdentifier: 'lifebinding-spirit',
			},
		]);
	});

	it('rolls the chosen damage of an item as its own step, never in the first damage', () => {
		const state = open([assist]);

		state.setConditionalChoice(assist.key, 'damage');

		expect(state.conditionalTypedDamages).toEqual([
			{
				formula: '1d6+@will',
				damageType: '',
				label: 'Assist Me',
				fromItemIdentifier: 'lifebinding-spirit',
			},
		]);
		expect(state.damagePreviews[0].formula).toBe('1d8');
	});
});

describe('the activation dialog bonus that spends a charge', () => {
	const lunging = {
		key: 'Item.lunging:rule',
		label: 'Lunging Strike (+1 Reach)',
		advantage: 0,
		damageValue: null,
		damageFormula: '1d8*2',
		damageType: '',
		startsChosen: false,
		charge: { poolId: 'combat-dice', label: 'Combat Dice', current: 2, hidden: false },
	};
	const assist = {
		...lunging,
		key: 'Item.assist:rule',
		label: 'Using Assist Me, My Friend! (1/round)',
		charge: { poolId: 'assist-round', label: 'Assist Me (1/round)', current: 1, hidden: true },
	};

	function open(options: object[]) {
		user.targets = new Set();
		conditionalBonuses.mockReturnValueOnce(options as never);
		return createState({
			actor: () => ({ rules: [], system: {}, items: [], getFlag: () => undefined }) as never,
			item: () =>
				({
					type: 'weapon',
					system: { activation: { effects: [{ id: 'd', type: 'damage', formula: '1d8' }] } },
				}) as never,
			hideRollsDefault: false,
		});
	}

	it('spends nothing until it is chosen', () => {
		const state = open([lunging]);

		expect(state.consumedChargePools).toEqual([]);
		expect(state.chargeCosts).toEqual([]);
	});

	it('spends one charge, and says so, once it is chosen', () => {
		const state = open([lunging]);

		state.setConditionalChoice(lunging.key, 'damage');

		expect(state.consumedChargePools).toEqual([{ poolId: 'combat-dice', count: 1 }]);
		expect(state.chargeCosts).toEqual([{ label: 'Combat Dice', amount: 1, current: 2 }]);
		expect(state.modifiedFormulas[0].formula).toBe('1d8+1d8*2[Lunging Strike (+1 Reach)]');
	});

	it('puts the charge in the one spend line, with what is left after the roll', () => {
		const state = open([lunging]);

		expect(state.spendLine).toBe('');

		state.setConditionalChoice(lunging.key, 'damage');

		expect(state.spendLine).toBe('When you roll, it spends 1 from Combat Dice (1 left after).');
	});

	it('is not there when the use already spends from that pool by itself', () => {
		fixedCosts.mockReturnValueOnce([
			{ poolId: 'combat-dice', label: 'Combat Dice', amount: 1, current: 2 },
		]);
		const state = open([lunging, assist]);

		expect(state.conditionalBonusOptions.map((o) => o.key)).toEqual([assist.key]);
	});

	it('spends the charge of a hidden pool with no line for it', () => {
		const state = open([assist]);

		state.setConditionalChoice(assist.key, 'damage');

		expect(state.consumedChargePools).toEqual([{ poolId: 'assist-round', count: 1 }]);
		expect(state.chargeCosts).toEqual([]);
		expect(state.spendLine).toBe('');
	});
});

describe('the activation dialog spend from a charge pool with a die', () => {
	const combatDice = {
		id: 'combat-dice',
		identifier: 'combat-dice',
		label: 'Combat Dice',
		dieSize: 'd6',
		current: 3,
		max: 3,
		hidden: false,
	};
	const lunging = {
		key: 'Item.lunging:rule',
		label: 'Lunging Strike (+1 Reach)',
		advantage: 0,
		damageValue: null,
		damageFormula: '1d6',
		damageType: '',
		startsChosen: false,
		charge: { poolId: 'combat-dice', label: 'Combat Dice', current: 3, hidden: false },
	};

	function open(options: object[] = []) {
		user.targets = new Set();
		chargePools.mockReturnValue([combatDice]);
		conditionalBonuses.mockReturnValueOnce(options as never);
		return createState({
			actor: () => ({ rules: [], system: {}, items: [], getFlag: () => undefined }) as never,
			item: () =>
				({
					type: 'weapon',
					system: { activation: { effects: [{ id: 'd', type: 'damage', formula: '1d8' }] } },
				}) as never,
			hideRollsDefault: false,
		});
	}

	afterEach(() => {
		chargePools.mockReset();
		chargePools.mockReturnValue([]);
	});

	it('is offered on an attack that spends nothing from the pool', () => {
		const state = open();

		expect(state.spendableChargePools.map((pool) => pool.id)).toEqual(['combat-dice']);
	});

	it('is not offered when the use already spends from that pool by itself', () => {
		fixedCosts.mockReturnValueOnce([
			{ poolId: 'combat-dice', label: 'Combat Dice', amount: 1, current: 3 },
		]);
		const state = open();

		expect(state.spendableChargePools).toEqual([]);
		expect(state.hasSpendablePools).toBe(false);
	});

	it('is not offered while a chosen bonus spends from that pool', () => {
		const state = open([lunging]);

		state.setConditionalChoice(lunging.key, 'damage');

		expect(state.spendableChargePools).toEqual([]);
		expect(state.hasSpendablePools).toBe(false);
		expect(state.consumedChargePools).toEqual([{ poolId: 'combat-dice', count: 1 }]);
	});

	it('never shows a chosen bonus, its spend line and the pool row together for one pool', () => {
		const state = open([lunging]);

		state.setConditionalChoice(lunging.key, 'damage');
		expect(state.conditionalBonusOptions.map((o) => o.key)).toEqual([lunging.key]);
		expect(state.spendLine).toBe('When you roll, it spends 1 from Combat Dice (2 left after).');
		expect(state.hasSpendablePools).toBe(false);

		state.setConditionalChoice(lunging.key, 'none');
		state.adjustChargeSpend('combat-dice', 1);
		expect(state.conditionalBonusOptions).toEqual([]);
		expect(state.spendLine).toBe('');
		expect(state.spendableChargePools.map((pool) => pool.id)).toEqual(['combat-dice']);
	});

	it('hides the bonus that spends from that pool once the player spends from it', () => {
		const assist = {
			...lunging,
			key: 'Item.assist:rule',
			charge: { poolId: 'assist-round', label: 'Assist Me', current: 1, hidden: true },
		};
		const state = open([lunging, assist]);

		state.adjustChargeSpend('combat-dice', 1);

		expect(state.conditionalBonusOptions.map((o) => o.key)).toEqual([assist.key]);
		expect(state.consumedChargePools).toEqual([{ poolId: 'combat-dice', count: 1 }]);
		expect(state.modifiedFormulas[0].formula).toBe('1d8+1d6[Combat Dice]');

		state.adjustChargeSpend('combat-dice', -1);

		expect(state.conditionalBonusOptions.map((o) => o.key)).toEqual([lunging.key, assist.key]);
	});
});

describe('the activation dialog Max Damage tick', () => {
	function openWithRule(rule: object, effects: object[]) {
		user.targets = new Set();
		return createState({
			actor: () => ({ rules: [rule], system: {}, items: [], getFlag: () => undefined }) as never,
			item: () => ({ type: 'feature', system: { activation: { effects } } }) as never,
			hideRollsDefault: false,
		});
	}
	const healing = {
		type: 'maxDamage',
		id: 'heal',
		use: 'healing',
		parentDocument: { name: 'Powerful Healer', uuid: 'Actor.h.Item.p' },
		tempHpChoice: true,
		chargePoolIdentifier: 'powerful-healer',
		chargeCost: 1,
		canPay: true,
		covers: () => true,
	};

	it('shows for an item with healing dice, with its cost', () => {
		const state = openWithRule(healing, [{ id: 'n', type: 'healing', formula: '2d6' }]);

		expect(state.maxDamageOffers).toEqual([
			{
				key: 'Actor.h.Item.p:heal',
				label: 'Powerful Healer',
				use: 'healing',
				tempHpChoice: true,
				chargeCost: 1,
				canPay: true,
			},
		]);
	});

	it('does not show for an item with no healing dice', () => {
		const state = openWithRule(healing, [{ id: 'n', type: 'damage', formula: '2d6' }]);

		expect(state.maxDamageOffers).toEqual([]);
	});

	it('starts with no tick', () => {
		const state = openWithRule(healing, [{ id: 'n', type: 'healing', formula: '2d6' }]);

		expect(state.maxDamageChoice).toBeNull();
	});
});

describe('the activation dialog tick for a use with no charge', () => {
	function openWithConsumer(allowFree: boolean) {
		user.targets = new Set();
		return createState({
			actor: () =>
				({
					type: 'character',
					rules: [],
					system: {},
					items: { contents: [] },
					flags: {},
					getFlag: () => undefined,
					getRollData: () => ({}),
				}) as never,
			item: () =>
				({
					id: 'beastshift',
					type: 'feature',
					system: { activation: { effects: [] } },
					rules: new Map([
						['0', { type: 'chargeConsumer', poolIdentifier: 'beastshift', cost: '1', allowFree }],
					]),
				}) as never,
			hideRollsDefault: false,
		});
	}

	it('shows for an item whose charge cost allows it, and starts off', () => {
		const state = openWithConsumer(true);

		expect(state.offersFreeUse).toBe(true);
		expect(state.freeUse).toBe(false);
	});

	it('does not show for an item that always spends its charge', () => {
		expect(openWithConsumer(false).offersFreeUse).toBe(false);
	});
});

describe('the activation dialog kept amount', () => {
	const kept = {
		id: 'kept',
		name: 'Rampage',
		origin: null,
		system: {
			rules: [
				{
					id: 'kept-rule',
					type: 'heldRoll',
					heldKind: 'wholeAmount',
					value: 13,
					whichRoll: 'holderAttacks',
					usedUp: true,
				},
			],
		},
		flags: {},
	};

	function openAttack(effects: object[]) {
		user.targets = new Set();
		return createState({
			actor: () =>
				({ rules: [], system: {}, items: [], getFlag: () => undefined, effects }) as never,
			item: () =>
				({
					type: 'weapon',
					system: {
						activation: {
							effects: [
								{ id: 'd', type: 'damage', formula: '1d8', damageType: 'slashing', canCrit: true },
							],
							targets: { attackType: 'reach' },
						},
					},
				}) as never,
			hideRollsDefault: false,
		});
	}

	it('is ticked at the start, and the preview shows the amount', () => {
		const state = openAttack([kept]);

		expect(state.keptAmount?.value).toBe(13);
		expect(state.usesKeptAmount).toBe(true);
		expect(state.damagePreviews).toEqual([{ formula: '13', damageType: 'slashing' }]);
	});

	it('shows the roll again when it is unticked', () => {
		const state = openAttack([kept]);

		state.usesKeptAmount = false;

		expect(state.damagePreviews[0]?.formula).toBe('1d8');
	});

	it('is absent with no kept amount', () => {
		const state = openAttack([]);

		expect(state.keptAmount).toBeNull();
		expect(state.usesKeptAmount).toBe(false);
	});
});

describe('the activation dialog Held Changes', () => {
	const opening = {
		id: 'opening',
		name: 'Create an Opening',
		origin: null,
		system: {
			rules: [
				{
					id: 'opening-rule',
					type: 'heldRoll',
					heldKind: 'advantage',
					value: 1,
					whichRoll: 'holderAttacks',
					usedUp: true,
				},
			],
		},
		flags: {},
	};
	const kept = {
		...opening,
		id: 'kept',
		name: 'Rampage',
		system: {
			rules: [{ ...opening.system.rules[0], id: 'kept-rule', heldKind: 'wholeAmount', value: 13 }],
		},
	};

	const gameGlobal = globalThis as unknown as { game: { settings?: unknown } };
	let realSettings: unknown;

	afterEach(() => {
		gameGlobal.game.settings = realSettings;
	});

	function openAttack(featureEffects: boolean) {
		realSettings = gameGlobal.game.settings;
		gameGlobal.game.settings = {
			get: (_scope: string, key: string) => key !== 'automation.applyRuleEffects' || featureEffects,
		};
		user.targets = new Set();
		return createState({
			actor: () =>
				({
					uuid: 'Actor.hero',
					rules: [],
					system: {},
					items: [],
					getFlag: () => undefined,
					effects: [opening, kept],
				}) as never,
			item: () =>
				({
					type: 'weapon',
					system: {
						activation: {
							effects: [
								{ id: 'd', type: 'damage', formula: '1d8', damageType: 'slashing', canCrit: true },
							],
							targets: { attackType: 'reach' },
						},
					},
				}) as never,
			hideRollsDefault: false,
		});
	}

	it('are read-only lines with Feature Effects on', () => {
		const state = openAttack(true);

		expect(state.heldLines.map((line) => line.key)).toEqual(['Actor.hero.opening.opening-rule']);
		expect(state.choosesHeldChanges).toBe(false);
		expect(state.usesKeptAmount).toBe(true);
	});

	it('are tick boxes that start unticked with Feature Effects off, and so is the kept amount', () => {
		const state = openAttack(false);

		expect(state.choosesHeldChanges).toBe(true);
		expect(state.chosenHeldChanges).toEqual([]);
		expect(state.usesKeptAmount).toBe(false);

		state.chosenHeldChanges = ['Actor.hero.opening.opening-rule'];

		expect(state.chosenHeldChanges).toEqual(['Actor.hero.opening.opening-rule']);
	});

	it('with Feature Effects on, a held advantage leaves the slider where it is', () => {
		const state = openAttack(true);

		expect(state.selectedRollMode).toBe(0);
		expect(state.submittedRollMode).toBe(0);
	});

	it('with Feature Effects off, a ticked advantage moves the slider, and its untick puts it back', () => {
		const state = openAttack(false);

		state.chosenHeldChanges = ['Actor.hero.opening.opening-rule'];

		expect(state.selectedRollMode).toBe(1);
		// The roll adds the ticked change itself.
		expect(state.submittedRollMode).toBe(0);

		state.chosenHeldChanges = [];

		expect(state.selectedRollMode).toBe(0);
		expect(state.submittedRollMode).toBe(0);
	});

	it('with Feature Effects off, the player can still move the slider past a ticked advantage', () => {
		const state = openAttack(false);
		state.chosenHeldChanges = ['Actor.hero.opening.opening-rule'];

		state.selectedRollMode = 2;

		expect(state.submittedRollMode).toBe(1);
		state.chosenHeldChanges = [];
		expect(state.selectedRollMode).toBe(1);
	});
});

describe('the activation dialog damage multiplier tick', () => {
	it('is offered and starts off', () => {
		user.targets = new Set();
		const state = createState({
			actor: () => ({ rules: [], system: {}, items: [], getFlag: () => undefined }) as never,
			item: () =>
				({
					type: 'feature',
					rules: [{ type: 'damageMultiplier', label: 'Sharpshooter', multiplier: 2 }],
					system: { activation: { effects: [] } },
				}) as never,
			hideRollsDefault: false,
		});

		expect(state.damageMultiplier).toEqual({ label: 'Sharpshooter', multiplier: 2 });
		expect(state.usesDamageMultiplier).toBe(false);
	});

	it('is offered for the weapon a feature attacks with, while that weapon is chosen', () => {
		user.targets = new Set();
		const bow = (name: string, rules: unknown[]) => ({
			uuid: `Item.${name}`,
			name,
			type: 'object',
			flags: {},
			rules,
			system: {
				objectType: 'weapon',
				equipped: true,
				activation: {
					targets: { attackType: 'range' },
					effects: [{ type: 'damage', formula: '1d8', damageType: 'piercing' }],
				},
			},
		});
		const items = [
			bow('Slayer', [{ type: 'damageMultiplier', label: 'Giant Slayer', multiplier: 3 }]),
			bow('Shortbow', []),
		];
		const state = createState({
			actor: () =>
				({
					type: 'character',
					rules: [],
					system: {},
					items: Object.assign([...items], { contents: items }),
					getFlag: () => undefined,
				}) as never,
			item: () =>
				({
					type: 'feature',
					rules: [],
					system: {
						activation: {
							weaponAttack: 'ranged',
							targets: {},
							effects: [{ id: 'd', type: 'damage', formula: '0' }],
						},
					},
				}) as never,
			hideRollsDefault: false,
		});

		expect(state.damageMultiplier).toEqual({ label: 'Giant Slayer', multiplier: 3 });
		state.weaponUuid = 'Item.Shortbow';
		expect(state.damageMultiplier).toBeNull();
	});
});

describe('the activation dialog condition ticks', () => {
	const spear = {
		type: 'weapon',
		system: {
			activation: {
				targets: { attackType: 'reach' },
				effects: [{ id: 'd', type: 'damage', formula: '1d8', canCrit: true, canMiss: true }],
			},
		},
	};

	function open(
		attackerConditions: string[],
		targetConditions: string[],
		initialRollMode = 0,
		item: object = spear,
		items: object[] = [],
	) {
		user.targets = new Set([{ actor: taggedCreature('Goblin', targetConditions) }]);
		return createState({
			actor: () =>
				({
					...taggedCreature('Kael', attackerConditions),
					rules: [],
					system: {},
					items,
					getFlag: () => undefined,
				}) as never,
			item: () => item as never,
			initialRollMode,
			hideRollsDefault: false,
		});
	}

	it('lists each condition ticked, and the slider opens with their steps', () => {
		const state = open(['poisoned'], ['blinded', 'prone'], -1);

		expect(state.conditionOptions.map((option) => [option.label, option.value])).toEqual([
			['Poisoned (Kael)', -1],
			['Blinded (Goblin)', 1],
			['Prone, melee attack (Goblin)', 1],
		]);
		expect(state.selectedRollMode).toBe(0);
		expect(state.submittedRollMode).toBe(-1);
		expect(state.conditionRollModes.map((line) => line.key)).toEqual([
			'self:poisoned',
			'target:blinded',
			'target:prone',
		]);
	});

	it('sends only the ticks that are on, and the player own roll mode apart', () => {
		const state = open([], ['blinded', 'prone']);
		state.appliedTicks = { 'target:blinded': 1 };
		state.selectedRollMode = 2;

		expect(state.submittedRollMode).toBe(1);
		expect(state.conditionRollModes.map((line) => line.key)).toEqual(['target:blinded']);
	});

	it('has no tick on a roll that is not an attack', () => {
		const potion = {
			type: 'object',
			system: { activation: { effects: [{ id: 'h', type: 'healing', formula: '2d4' }] } },
		};

		const state = open(['poisoned'], ['blinded'], 0, potion);

		expect(state.conditionOptions).toEqual([]);
		expect(state.selectedRollMode).toBe(0);
	});

	it('reads a spell with Range as a ranged attack', () => {
		const zap = {
			type: 'spell',
			system: {
				properties: { selected: ['range'] },
				activation: {
					targets: {},
					effects: [{ id: 'd', type: 'damage', formula: '2d6', canCrit: true, canMiss: true }],
				},
			},
		};

		const state = open([], ['prone'], 0, zap);

		expect(state.conditionOptions.map((option) => [option.label, option.value])).toEqual([
			['Prone, ranged attack (Goblin)', -1],
		]);
		expect(state.selectedRollMode).toBe(-1);
	});

	it('reads the lines again for the weapon the player picks', () => {
		const weapon = (id: string, attackType: string) => ({
			id,
			uuid: `Item.${id}`,
			name: id,
			type: 'object',
			system: {
				objectType: 'weapon',
				equipped: true,
				activation: {
					targets: { attackType },
					effects: [{ type: 'damage', formula: '1d6' }],
				},
			},
		});
		const ability = {
			type: 'feature',
			system: {
				activation: {
					weaponAttack: 'any',
					targets: { attackType: 'reach' },
					effects: [{ id: 'd', type: 'damage', formula: '1d6', canCrit: true, canMiss: true }],
				},
			},
		};

		const state = open([], ['prone'], 0, ability, [
			weapon('sword', 'reach'),
			weapon('bow', 'range'),
		]);
		expect(state.selectedRollMode).toBe(1);

		state.weaponUuid = 'Item.bow';

		expect(state.conditionOptions.map((option) => option.label)).toEqual([
			'Prone, ranged attack (Goblin)',
		]);
		expect(state.selectedRollMode).toBe(-1);
		expect(state.submittedRollMode).toBe(0);
	});

	it('gives the dual wield field the player own roll mode, without the ticks', () => {
		const state = open([], ['blinded']);

		expect(state.selectedRollMode).toBe(1);
		expect(state.ownRollMode).toBe(0);
	});
});

describe('the activation dialog spend line', () => {
	const cost = (kind: 'mana' | 'hp' | 'tempHp' | 'wounds', amount: number) => ({
		kind,
		amount,
		spend: { mode: 'fixed' as const },
		beyond: 'notAllowed' as const,
		source: 'Blood Rite',
	});

	function open(options: { spendsActions?: number; resourceCosts?: ReturnType<typeof cost>[] }) {
		user.targets = new Set();
		return createState({
			actor: () => ({ rules: [], system: {}, items: [], getFlag: () => undefined }) as never,
			item: () => ({ type: 'feature', system: { activation: { effects: [] } } }) as never,
			hideRollsDefault: false,
			...options,
		});
	}

	it('says what the use sacrifices', () => {
		expect(open({ resourceCosts: [cost('hp', 5)] }).spendLine).toBe(
			'When you roll, you sacrifice 5 HP.',
		);
	});

	it('joins what the use spends and what it sacrifices with "and"', () => {
		expect(open({ resourceCosts: [cost('mana', 2), cost('hp', 14)] }).spendLine).toBe(
			'When you roll, it spends 2 Mana and you sacrifice 14 HP.',
		);
		expect(
			open({ spendsActions: 1, resourceCosts: [cost('tempHp', 10), cost('wounds', 1)] }).spendLine,
		).toBe('When you roll, it spends 1 action and 10 temp HP and you sacrifice 1 Wound.');
	});

	it('keeps the actions line of a use with no cost', () => {
		expect(open({ spendsActions: 2 }).spendLine).toBe('When you roll, it spends 2 actions.');
		expect(open({}).spendLine).toBe('');
	});

	it('puts the charge a use spends by itself in the same line', () => {
		fixedCosts.mockReturnValueOnce([
			{ poolId: 'combat-dice', label: 'Combat Dice', amount: 1, current: 3 },
		]);
		expect(open({ spendsActions: 2 }).spendLine).toBe(
			'When you roll, it spends 2 actions and 1 from Combat Dice (2 left after).',
		);
	});
});

describe('the activation dialog amount of a variable cost', () => {
	const gameGlobal = globalThis as unknown as { game: { settings?: unknown } };
	let realSettings: unknown;

	afterEach(() => {
		gameGlobal.game.settings = realSettings;
	});

	function variable(kind: 'mana' | 'hp', min: number, max: number) {
		return {
			kind,
			amount: min,
			spend: { mode: 'variable' as const, min: String(min), max: String(max) },
			beyond: 'notAllowed' as const,
			source: 'Supercharge',
			id: `cost-${kind}`,
		};
	}

	function open(
		resourceCosts: ReturnType<typeof variable>[],
		{ mana = 4, hp = 10, resourceSpending = true } = {},
	) {
		realSettings = gameGlobal.game.settings;
		gameGlobal.game.settings = {
			get: (_scope: string, key: string) =>
				key === 'automation.resourceSpending' ? resourceSpending : true,
		};
		user.targets = new Set();
		return createState({
			actor: () =>
				({
					rules: [],
					system: {
						resources: { mana: { current: mana } },
						attributes: { hp: { value: hp, temp: 0 }, wounds: { value: 0, max: 6 } },
					},
					items: [],
					getFlag: () => undefined,
				}) as never,
			item: () => ({ type: 'feature', system: { activation: { effects: [] } } }) as never,
			hideRollsDefault: false,
			resourceCosts,
		});
	}

	it('opens at the minimum, and stops at the max or at what the creature has', () => {
		expect(open([variable('mana', 1, 3)], { mana: 7 }).variableResourceCosts).toEqual([
			{ id: 'cost-mana', kind: 'mana', minimum: 1, limit: 3, amount: 1 },
		]);
		expect(open([variable('mana', 1, 5)], { mana: 2 }).variableResourceCosts).toEqual([
			{ id: 'cost-mana', kind: 'mana', minimum: 1, limit: 2, amount: 1 },
		]);
	});

	it('keeps 1 HP: an HP amount stops at current HP - 1', () => {
		expect(open([variable('hp', 1, 20)], { hp: 8 }).variableResourceCosts[0]?.limit).toBe(7);
	});

	it('with Resource Spending off, stops only at the max', () => {
		const state = open([variable('mana', 1, 5)], { mana: 0, resourceSpending: false });
		expect(state.variableResourceCosts[0]?.limit).toBe(5);
	});

	it('steps inside the range, and the spend line and the submitted amount follow', () => {
		const state = open([variable('mana', 1, 3)], { mana: 7 });
		expect(state.spendLine).toBe('When you roll, it spends 1 Mana.');

		state.adjustResourceAmount('cost-mana', 1);
		state.adjustResourceAmount('cost-mana', 1);
		state.adjustResourceAmount('cost-mana', 1);
		expect(state.resourceAmounts).toEqual({ 'cost-mana': 3 });
		expect(state.spendLine).toBe('When you roll, it spends 3 Mana.');

		state.setResourceAmount('cost-mana', 0);
		expect(state.resourceAmounts).toEqual({ 'cost-mana': 1 });
	});

	it('names a rolled cost by its roll', () => {
		const rolled = {
			kind: 'wounds' as const,
			amount: '1d4',
			spend: { mode: 'fixed' as const },
			beyond: 'notAllowed' as const,
			source: 'Enveloped',
		};
		expect(open([rolled as never]).spendLine).toBe('When you roll, you sacrifice 1d4 Wounds.');
	});
});

describe('the activation dialog weapon pick', () => {
	const weapon = (name: string, attackType: string, equipped: boolean) => ({
		uuid: `Item.${name}`,
		name,
		type: 'object',
		flags: {},
		system: {
			objectType: 'weapon',
			equipped,
			activation: {
				targets: { attackType },
				effects: [{ type: 'damage', formula: '1d6', damageType: 'piercing' }],
			},
		},
	});
	const feature = (weaponAttack: string, extra: object = {}) => ({
		type: 'feature',
		system: {
			activation: {
				...extra,
				weaponAttack,
				targets: {},
				effects: [{ id: 'd', type: 'damage', formula: '0', canCrit: true, canMiss: true }],
			},
		},
	});

	function open(weaponAttack: string, items: object[], extra: object = {}) {
		user.targets = new Set();
		return createState({
			actor: () =>
				({
					type: 'character',
					rules: [],
					system: {},
					items: Object.assign([...items], { contents: items }),
					getFlag: () => undefined,
				}) as never,
			item: () => feature(weaponAttack, extra) as never,
			hideRollsDefault: false,
		});
	}

	const groupNames = (state: ReturnType<typeof open>) =>
		state.weaponGroups.map((group) => [group.label, group.weapons.map((each) => each.name)]);

	it('groups the equipped and the not equipped weapons, and starts on the first equipped one', () => {
		const state = open('any', [
			weapon('Longbow', 'range', false),
			weapon('Shortbow', 'range', true),
			weapon('Greataxe', 'reach', false),
			weapon('Dagger', 'reach', true),
		]);

		expect(groupNames(state)).toEqual([
			['Equipped', ['Shortbow', 'Dagger', 'Unarmed Strike']],
			['Not equipped', ['Longbow', 'Greataxe']],
		]);
		expect(state.weaponUuid).toBe('Item.Shortbow');
	});

	it('has no headings when only one group has a weapon', () => {
		expect(groupNames(open('ranged', [weapon('Longbow', 'range', false)]))).toEqual([
			[null, ['Longbow']],
		]);
		expect(groupNames(open('melee', []))).toEqual([[null, ['Unarmed Strike']]]);
	});

	it('reads the conditional bonuses for the chosen weapon, and again when the player picks another', () => {
		const state = open('any', [weapon('Shortbow', 'range', true), weapon('Dagger', 'reach', true)]);

		const asked = () =>
			conditionalBonuses.mock.calls.map((call) => {
				const [, item, , chosen] = call as unknown as [
					unknown,
					{ system: { activation: { targets: { attackType: string } } } },
					unknown,
					{ name: string } | null,
				];
				return [item.system.activation.targets.attackType, chosen?.name];
			});
		expect(asked()).toEqual([['range', 'Shortbow']]);

		state.weaponUuid = 'Item.Dagger';
		expect(asked()).toEqual([
			['range', 'Shortbow'],
			['reach', 'Dagger'],
		]);
	});

	it('adds a ranged-only bonus pool while a ranged weapon is chosen, and not for a melee one', () => {
		dicePools.mockReturnValue([
			{
				id: 'volley',
				identifier: 'volley',
				label: 'Volley',
				dieSize: 'd6',
				faces: [4],
				consumption: 'autoBonus',
				bonusOnAttackDelivery: 'ranged',
			},
		]);
		const state = open('any', [weapon('Shortbow', 'range', true), weapon('Dagger', 'reach', true)]);
		dicePools.mockReturnValue([]);

		expect(state.autoBonusSummaries.map((pool) => pool.label)).toEqual(['Volley']);
		state.weaponUuid = 'Item.Dagger';
		expect(state.autoBonusSummaries).toEqual([]);
	});

	describe('and a melee-only Held Change, with Feature Effects off', () => {
		const gameGlobal = globalThis as unknown as { game: { settings?: unknown } };
		let realSettings: unknown;
		const KEY = 'Actor.hero.opening.opening-rule';

		afterEach(() => {
			gameGlobal.game.settings = realSettings;
		});

		function openWithOpening() {
			realSettings = gameGlobal.game.settings;
			gameGlobal.game.settings = {
				get: (_scope: string, key: string) => key !== 'automation.applyRuleEffects',
			};
			user.targets = new Set();
			const items = [weapon('Shortbow', 'range', true), weapon('Dagger', 'reach', true)];
			return createState({
				actor: () =>
					({
						uuid: 'Actor.hero',
						type: 'character',
						rules: [],
						system: {},
						items: Object.assign([...items], { contents: items }),
						getFlag: () => undefined,
						effects: [
							{
								id: 'opening',
								name: 'Create an Opening',
								origin: null,
								flags: {},
								system: {
									rules: [
										{
											id: 'opening-rule',
											type: 'heldRoll',
											heldKind: 'advantage',
											value: 1,
											whichRoll: 'holderAttacks',
											meleeOnly: true,
										},
									],
								},
							},
						],
					}) as never,
				item: () => feature('any') as never,
				hideRollsDefault: false,
			});
		}

		it('lists the change only while a melee weapon is chosen, and takes back its tick', () => {
			const state = openWithOpening();
			expect(state.heldLines).toEqual([]);

			state.weaponUuid = 'Item.Dagger';
			expect(state.heldLines.map((line) => line.key)).toEqual([KEY]);
			state.chosenHeldChanges = [KEY];
			expect(state.selectedRollMode).toBe(1);

			state.weaponUuid = 'Item.Shortbow';
			expect(state.heldLines).toEqual([]);
			expect(state.chosenHeldChanges).toEqual([]);
			expect(state.selectedRollMode).toBe(0);
		});
	});

	it('cannot roll with no weapon that fits', () => {
		const state = open('ranged', [weapon('Dagger', 'reach', true)]);

		expect(state.weaponGroups).toEqual([]);
		expect(state.cannotRollReason).toBe('You have no weapon of this kind.');
	});

	describe('of a half range feature', () => {
		const withRange = (item: ReturnType<typeof weapon>, max: number) => ({
			...item,
			system: { ...item.system, properties: { selected: ['range'], range: { min: 2, max } } },
		});

		it('shows half the range of the chosen weapon, rounded down', () => {
			const items = [
				withRange(weapon('Longbow', 'range', true), 16),
				withRange(weapon('Sling', 'range', true), 9),
			];
			const state = open('ranged', items, { halfRange: true });

			expect(state.rangeLine).toBe('Range 8 (half range)');
			state.weaponUuid = 'Item.Sling';
			expect(state.rangeLine).toBe('Range 4 (half range)');
		});

		it('shows no range line for a feature that is not half range', () => {
			const state = open('ranged', [withRange(weapon('Longbow', 'range', true), 16)]);

			expect(state.rangeLine).toBe('');
		});
	});
});
