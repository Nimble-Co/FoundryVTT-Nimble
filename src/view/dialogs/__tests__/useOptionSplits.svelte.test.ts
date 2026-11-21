import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

// Setup loads this module through game.ts, so a hoisted vi.mock would miss it.
let createState: typeof import('../itemActivationConfigDialogState.svelte.ts').createItemActivationConfigDialogState;

const math = Math as unknown as { clamp?: (value: number, min: number, max: number) => number };
const ownClamp = math.clamp;
const gameGlobal = globalThis as unknown as {
	game: { settings?: unknown; user: { targets?: unknown } };
};
let realSettings: unknown;

beforeAll(async () => {
	math.clamp ??= (value, min, max) => Math.min(max, Math.max(min, value));
	vi.resetModules();
	vi.doMock('#utils/actor/conditionalBonuses.js', () => ({
		getActiveConditionalBonuses: () => [],
	}));
	({ createItemActivationConfigDialogState: createState } = await import(
		'../itemActivationConfigDialogState.svelte.ts'
	));
});

afterEach(() => {
	gameGlobal.game.settings = realSettings;
});

afterAll(() => {
	math.clamp = ownClamp;
});

const KEY = 'Item.zealot:zealot';

const zealot = {
	key: KEY,
	label: 'Zealot',
	used: false,
	spend: false,
	options: [
		{
			key: KEY,
			name: 'Zealot',
			cost: {
				kind: 'mana' as const,
				amount: 0,
				spend: { mode: 'variable' as const, min: '0', max: '3' },
				beyond: 'notAllowed' as const,
				source: 'Zealot',
				id: KEY,
			},
			chargePoolIdentifier: '',
			actionCostChange: null,
			rangePerMana: 0,
			cardNote: '',
			damageTypes: [],
			manaChange: null,
			freeCopy: false,
			replacesSpellCost: false,
			manaSet: null,
			effect: null,
			used: false,
			picks: [
				{
					key: '0',
					name: 'Condemning Strike',
					damage: '5',
					damageType: 'radiant',
					lowerArmorSteps: 0,
				},
				{ key: '1', name: 'Blessed Aim', damage: '', damageType: '', lowerArmorSteps: 1 },
			],
		},
	],
};

function open({ mana = 7, resourceSpending = true } = {}) {
	realSettings = gameGlobal.game.settings;
	gameGlobal.game.settings = {
		get: (_scope: string, key: string) =>
			key === 'automation.resourceSpending' ? resourceSpending : true,
	};
	gameGlobal.game.user.targets = new Set();
	return createState({
		actor: () =>
			({
				rules: [],
				system: {
					resources: { mana: { current: mana } },
					attributes: { hp: { value: 20, temp: 0 }, wounds: { value: 0, max: 6 } },
				},
				items: [],
				getFlag: () => undefined,
			}) as never,
		item: () => ({ type: 'object', system: { activation: { effects: [] } } }) as never,
		hideRollsDefault: false,
		useOptionGroups: [zealot],
	});
}

type State = ReturnType<typeof open>;

function steppers(state: State) {
	return state.optionSplits[0]?.picks.map(({ amount, limit, cap }) => ({ amount, limit, cap }));
}

describe('the activation dialog split option', () => {
	it('shows the heading, one stepper for each pick at 0, and the total line', () => {
		const state = open();

		expect(state.optionSplits).toHaveLength(1);
		expect(state.optionSplits[0]?.heading).toBe('Zealot (up to 3 mana)');
		expect(state.optionSplits[0]?.picks.map((each) => each.label)).toEqual([
			'Condemning Strike: +5 radiant',
			'Blessed Aim: armor 1 step lower',
		]);
		expect(steppers(state)).toEqual([
			{ amount: 0, limit: 3, cap: 3 },
			{ amount: 0, limit: 3, cap: 3 },
		]);
		expect(state.optionSplits[0]?.totalLine).toBe('0 of 3 mana. You have 7.');
		expect(state.spendLine).toBe('');
		expect(state.useOptions).toEqual([]);
	});

	it('splits the amount between the picks, and the total line, spend line and submitted picks follow', () => {
		const state = open();

		state.adjustPick(KEY, '0', 1);
		state.adjustPick(KEY, '1', 1);

		expect(state.optionSplits[0]?.totalLine).toBe('2 of 3 mana. You have 7.');
		expect(state.spendLine).toBe('When you roll, it spends 2 Mana.');
		expect(state.useOptions).toEqual([{ key: KEY, amount: 2, picks: { 0: 1, 1: 1 } }]);
	});

	it('stops each stepper at what the other picks leave of the cap', () => {
		const state = open();

		state.adjustPick(KEY, '0', 1);
		state.adjustPick(KEY, '1', 1);
		expect(steppers(state)).toEqual([
			{ amount: 1, limit: 2, cap: 3 },
			{ amount: 1, limit: 2, cap: 3 },
		]);

		state.adjustPick(KEY, '0', 1);
		state.adjustPick(KEY, '0', 1);
		expect(steppers(state)).toEqual([
			{ amount: 2, limit: 2, cap: 3 },
			{ amount: 1, limit: 1, cap: 3 },
		]);

		expect(state.setPick(KEY, '1', 9)).toBe(1);
		expect(state.setPick(KEY, '1', -2)).toBe(0);
		expect(state.optionSplits[0]?.totalLine).toBe('2 of 3 mana. You have 7.');
	});

	it('caps the split at the mana the creature has', () => {
		const state = open({ mana: 2 });

		expect(state.optionSplits[0]?.heading).toBe('Zealot (up to 3 mana)');
		expect(steppers(state)?.[0]).toEqual({ amount: 0, limit: 2, cap: 2 });
		expect(state.setPick(KEY, '0', 3)).toBe(2);
		expect(state.optionSplits[0]?.totalLine).toBe('2 of 3 mana. You have 2.');
	});

	it('with Resource Spending off, caps the split only at its max', () => {
		const state = open({ mana: 0, resourceSpending: false });

		expect(steppers(state)?.[0]).toEqual({ amount: 0, limit: 3, cap: 3 });
	});
});
