import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { canInvokeChaos, chooseChaosRoll, invokeChaos, keepChaosRoll } from '../invokeChaos.js';

const TABLE = [
	{ range: [1, 1], name: 'Elemental Eruption', description: '<p>Boom</p>' },
	{ range: [2, 19], name: 'Middle', description: '<p>Middle text</p>' },
	{ range: [20, 20], name: 'Top', description: '<p>Top text</p>' },
];

let tableOpen = false;
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

const force = { type: 'invokeChaos', invokesChaos: true };
const thrive = { type: 'chaosOptions', applies: true, rollTwice: true, chooseChargePool: 'thrive' };
const master = { type: 'chaosOptions', applies: true, advantage: true };

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
			packs: { get: () => ({ getDocuments: async () => [{ results: TABLE }] }) },
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

	it('with the setting off, the player sees the number and the GM the text in a whisper', async () => {
		diceAre([20]);

		await invokeChaos(hero());

		expect(created[0].system.rolls).toEqual([{ value: 20, dropped: null, name: '', text: '' }]);
		expect(created[1].whisper).toEqual(['gm']);
		expect(created[1].content).toContain('Top text');
	});

	it('with the setting on, the text is on the card and no whisper goes out', async () => {
		tableOpen = true;
		diceAre([1]);

		await invokeChaos(hero());

		expect(created[0].system.rolls[0]).toMatchObject({ value: 1, name: 'Elemental Eruption' });
		expect(created).toHaveLength(1);
	});

	it('with Master of Chaos, the roll has advantage', async () => {
		diceAre([15, 3]);

		await invokeChaos(hero(master));

		expect(vi.mocked(foundry.dice.Roll).mock.calls[0][0]).toBe('2d20kh');
		expect(created[0].system.rolls[0]).toMatchObject({ value: 15, dropped: 3 });
	});

	describe('with Thrive in Chaos', () => {
		const pickCard = (status = 'choosing', chooseUses = 1) => {
			const card = {
				system: {
					actorUuid: '',
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

		it('Roll twice, both happen rolls two, and the GM reads both', async () => {
			diceAre([7], [20]);
			const card = pickCard();

			await chooseChaosRoll(card as never, hero(thrive) as never, 'both');

			expect(card.system.rolls).toHaveLength(2);
			expect(created[0].content).toContain('Middle text');
			expect(created[0].content).toContain('Top text');
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

			await keepChaosRoll(card as never, hero(thrive) as never, 1);

			expect(card.update).toHaveBeenCalledWith({ 'system.kept': 1, 'system.status': 'done' });
			expect(created[0].content).toContain('Top text');
			expect(created[0].content).not.toContain('Middle text');
		});
	});
});
