import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { taggedCreature } from '../../../../tests/fixtures/conditionCreature.js';

const conditionalBonuses = vi.fn(() => []);

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
