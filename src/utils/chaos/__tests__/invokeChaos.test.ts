import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	canInvokeChaos,
	chooseChaosRoll,
	invokeChaos,
	keepChaosRoll,
	onUseTableOf,
	whisperChaosRollsToGm,
} from '../invokeChaos.js';

const TABLE = [
	{ range: [1, 1], name: 'Elemental Eruption', description: '<p>Boom</p>' },
	{ range: [2, 19], name: 'Middle', description: '<p>Middle text</p>' },
	{ range: [20, 20], name: 'Top', description: '<p>Top text</p>' },
];

let tableOpen = false;
const getDocuments = vi.fn(async (_query: object) => [{ results: TABLE }]);
const created: Array<Record<string, any>> = [];

function diceAre(...totals: Array<[number, number?]>) {
	const queue = [...totals];
	vi.spyOn(foundry.dice, 'Roll').mockImplementation((() => {
		const [total, dropped] = queue.shift() ?? [10];
		return {
			total,
			evaluate: async () => {},
			dice: [
				{
					results: [
						{ result: total, active: true },
						...(dropped === undefined ? [] : [{ result: dropped, active: false }]),
					],
				},
			],
		};
	}) as never);
}

const force = { type: 'tableRoll', table: 'chaos', when: 'lessManaOrCrit', invokesChaos: true };
const lash = { type: 'tableRoll', table: 'chaos', when: 'onUse', invokesChaos: true };
const thrive = {
	type: 'tableRollOptions',
	table: 'chaos',
	applies: true,
	rollTwice: true,
	chooseChargePool: 'thrive',
};
const master = { type: 'tableRollOptions', table: 'chaos', applies: true, advantage: true };

const hero = (...rules: unknown[]) => ({
	uuid: 'Actor.hero',
	name: 'Hero',
	rules: [force, ...rules],
	items: { contents: [] },
});

describe('a Chaos Table roll', () => {
	beforeEach(() => {
		tableOpen = false;
		created.length = 0;
		vi.stubGlobal('ChatMessage', {
			create: vi.fn(async (data: Record<string, unknown>) => {
				created.push(data);
				return data;
			}),
			getSpeaker: () => ({}),
		});
		vi.stubGlobal('game', {
			settings: { get: () => tableOpen },
			users: { filter: () => [{ id: 'gm', isGM: true }] },
			packs: { get: () => ({ getDocuments }) },
			i18n: { localize: (key: string) => key, format: (key: string) => key },
		});
	});

	afterEach(() => {
		vi.restoreAllMocks();
		vi.unstubAllGlobals();
	});

	it('is only for a hero with the rule', () => {
		expect(canInvokeChaos(hero())).toBe(true);
		expect(canInvokeChaos({ rules: [] })).toBe(false);
	});

	it('a rule that rolls when its item is used gives no less mana tick and no crit roll', () => {
		expect(canInvokeChaos({ rules: [lash] })).toBe(false);
	});

	it('finds the table an item rolls on when it is used', () => {
		expect(onUseTableOf({ rules: new Map([['a', lash]]) })).toBe('chaos');
		expect(onUseTableOf({ rules: new Map([['a', force]]) })).toBeNull();
		expect(onUseTableOf({ rules: new Map([['a', { ...lash, invokesChaos: false }]]) })).toBeNull();
		expect(onUseTableOf(null)).toBeNull();
	});

	it('rolls on the table it is given', async () => {
		tableOpen = true;
		diceAre([1]);

		await invokeChaos({ ...hero(), rules: [lash] }, 'card', 'chaos');

		expect(getDocuments).toHaveBeenCalledWith({ name: 'Chaos Table' });
		expect(created[0].system).toMatchObject({ table: 'chaos', attackMessageId: 'card' });
	});

	it('with the setting off, the card has the number only', async () => {
		diceAre([20]);

		await invokeChaos(hero());

		expect(created[0].system.rolls).toEqual([{ value: 20, dropped: null, name: '', text: '' }]);
		expect(created).toHaveLength(1);
	});

	it('the whisper to the GM has the text of the rolls', async () => {
		await whisperChaosRollsToGm(
			'Hero',
			[{ value: 20, dropped: null, name: '', text: '' }],
			'chaos',
		);

		expect(created[0].whisper).toEqual(['gm']);
		expect(created[0].content).toContain('Top text');
	});

	it('with the setting on, the text is on the card', async () => {
		tableOpen = true;
		diceAre([1]);

		await invokeChaos(hero());

		expect(created[0].system.rolls[0]).toMatchObject({ value: 1, name: 'Elemental Eruption' });
		expect(created).toHaveLength(1);
	});

	it('rolls on the table of the rule, and the card keeps it', async () => {
		tableOpen = true;
		diceAre([1]);

		await invokeChaos(hero());

		expect(getDocuments).toHaveBeenCalledWith({ name: 'Chaos Table' });
		expect(created[0].system.table).toBe('chaos');
	});

	it('with Master of Chaos, the roll has advantage', async () => {
		diceAre([15, 3]);

		await invokeChaos(hero(master));

		expect(vi.mocked(foundry.dice.Roll).mock.calls[0][0]).toBe('2d20kh');
		expect(created[0].system.rolls[0]).toMatchObject({ value: 15, dropped: 3 });
	});

	it('options of another table do not change a roll on this one', async () => {
		diceAre([15]);

		await invokeChaos(hero({ ...master, table: 'other' }));

		expect(vi.mocked(foundry.dice.Roll).mock.calls[0][0]).toBe('1d20');
	});

	it('rolls nothing for a hero with no table roll rule', async () => {
		await invokeChaos({ ...hero(), rules: [] });

		expect(created).toHaveLength(0);
	});

	describe('with Thrive in Chaos', () => {
		const pickCard = (status = 'choosing', chooseUses = 1) => {
			const card = {
				system: {
					actorUuid: '',
					table: 'chaos',
					status,
					advantage: false,
					rolls: [] as object[],
					kept: null,
					chooseUses,
				},
				update: vi.fn(async (changes: Record<string, unknown>) => {
					if (changes['system.rolls']) card.system.rolls = changes['system.rolls'] as object[];
					if (changes['system.status']) card.system.status = changes['system.status'] as string;
				}),
			};
			return card;
		};

		it('the card waits for a button, with no die rolled', async () => {
			const spy = vi.spyOn(foundry.dice, 'Roll');

			await invokeChaos(hero(thrive));

			expect(spy).not.toHaveBeenCalled();
			expect(created[0].system.status).toBe('choosing');
			expect(created).toHaveLength(1);
		});

		it('Roll once rolls one', async () => {
			diceAre([7]);
			const card = pickCard();

			await chooseChaosRoll(card as never, hero(thrive) as never, 'once');

			expect(card.system.rolls).toHaveLength(1);
			expect(card.system.status).toBe('done');
		});

		it('Roll twice, both happen rolls two', async () => {
			diceAre([7], [20]);
			const card = pickCard();

			await chooseChaosRoll(card as never, hero(thrive) as never, 'both');

			expect(card.system.rolls).toHaveLength(2);
		});

		it('Roll twice, choose one spends a use and waits for the pick', async () => {
			const spendRuleCharge = vi.fn(async () => true);
			vi.resetModules();
			vi.doMock('../../chargePool/ruleChargeGate.js', () => ({ spendRuleCharge }));
			const fresh = await import('../invokeChaos.js');
			vi.doUnmock('../../chargePool/ruleChargeGate.js');
			const card = pickCard();
			diceAre([7], [20]);

			await fresh.chooseChaosRoll(card as never, hero(thrive) as never, 'choose');

			expect(spendRuleCharge).toHaveBeenCalledWith(expect.anything(), 'thrive');
			expect(card.system.rolls).toHaveLength(2);
			expect(card.system.status).toBe('picking');
		});

		it('Roll twice, choose one needs a use', async () => {
			diceAre([7], [20]);
			const noUses = pickCard('choosing', 0);
			await chooseChaosRoll(noUses as never, hero(thrive) as never, 'choose');
			expect(noUses.update).not.toHaveBeenCalled();
		});

		it('the kept roll stands', async () => {
			const card = pickCard('picking');
			card.system.rolls = [
				{ value: 7, dropped: null, name: '', text: '' },
				{ value: 20, dropped: null, name: '', text: '' },
			];

			await keepChaosRoll(card as never, 1);

			expect(card.update).toHaveBeenCalledWith({ 'system.kept': 1, 'system.status': 'done' });
		});
	});
});
