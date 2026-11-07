import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defendWindowPlan } from '../openDefendWindow.js';

const TOKEN = 'Scene.s.Token.pip';

type Globals = { fromUuidSync: ReturnType<typeof vi.fn>; game: Record<string, unknown> };

const SAVED_GLOBALS = ['game', 'fromUuidSync'].map(
	(key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)] as const,
);

function rule(fields: Record<string, unknown>) {
	return {
		id: String(fields.id),
		type: 'defendOption',
		label: String(fields.id),
		item: {
			uuid: `Item.${String(fields.id)}`,
			name: String(fields.id),
			getDomain: () => new Set(),
		},
		way: 'withDefend',
		attackDelivery: 'any',
		outcome: 'none',
		reminder: '',
		attackerCondition: '',
		wholeRound: false,
		withInterpose: false,
		useItem: false,
		optionCost: {
			chargePoolIdentifier: '',
			chargeCost: 1,
			manaCost: 0,
			woundCost: 0,
			heroicReaction: '',
		},
		appliesTo: () => true,
		resolveArmorBonus: () => Number(fields.bonus ?? 0),
		...fields,
	};
}

function hero(rules: unknown[]) {
	return {
		uuid: 'Actor.pip',
		id: 'pip',
		name: 'Pip',
		type: 'character',
		system: { attributes: { armor: { value: 3 } } },
		rules,
	};
}

const DAMAGE = 17;

/** Mirrors the card: armor comes off, a halve takes half rounded up in place of armor, a miss is 0. */
const card = {
	id: 'm1',
	flavor: 'Club',
	system: { activation: { targets: { attackType: 'reach' } } },
	isMinionGroupAttackCard: () => false,
	previewDamageFor: vi.fn(
		(_token: string, defend: number | { armor?: number; zero?: boolean; halve?: boolean }) => {
			if (typeof defend === 'number') return DAMAGE - defend;
			if (defend.zero) return 0;
			if (defend.halve) return Math.ceil(DAMAGE / 2);
			return DAMAGE - (defend.armor ?? 0);
		},
	),
};

function plan(rules: unknown[]) {
	return defendWindowPlan(card as never, {
		actor: hero(rules) as never,
		targetTokenUuid: TOKEN,
		interposes: [],
		defend: null,
	});
}

beforeEach(() => {
	const globals = globalThis as unknown as Globals;
	globals.fromUuidSync = vi.fn(() => null);
	globals.game = {
		combat: null,
		user: { isGM: false },
		i18n: { localize: (key: string) => key, format: (key: string) => key },
		settings: { get: () => false },
	};
});

afterEach(() => {
	for (const [key, descriptor] of SAVED_GLOBALS) {
		if (descriptor) Object.defineProperty(globalThis, key, descriptor);
		else Reflect.deleteProperty(globalThis, key);
	}
});

const MISDIRECTION = 'Item.misdirection:misdirection';
const INFUSION = 'Item.infusion:infusion';
const DECOY = 'Item.decoy:decoy';

function planWithDefendTicks() {
	return plan([
		rule({ id: 'misdirection', outcome: 'halve' }),
		rule({ id: 'infusion', bonus: 4 }),
		rule({ id: 'decoy', outcome: 'miss' }),
	]);
}

describe('defendWindowPlan', () => {
	it('lists the "When you Defend" ticks', () => {
		const { data } = planWithDefendTicks();

		expect(data.ticks.map((tick) => tick.id)).toEqual([MISDIRECTION, INFUSION, DECOY]);
	});

	it('takes the hero armor off the damage with no tick', () => {
		const { data } = planWithDefendTicks();

		expect(data.takesWith('defend', [])).toBe(14);
	});

	it('adds the armor bonus of a tick to the hero armor', () => {
		const { data } = planWithDefendTicks();

		expect(data.takesWith('defend', [INFUSION])).toBe(10);
	});

	it('halves the damage on a halving tick', () => {
		const { data } = planWithDefendTicks();

		expect(data.takesWith('defend', [MISDIRECTION])).toBe(9);
	});

	it('halves the damage in place of the armor when an armor bonus is also ticked', () => {
		const { data } = planWithDefendTicks();

		expect(data.takesWith('defend', [MISDIRECTION, INFUSION])).toBe(9);
	});

	it('takes no damage when a tick makes the attack miss', () => {
		const { data } = planWithDefendTicks();

		expect(data.takesWith('defend', [MISDIRECTION, DECOY])).toBe(0);
	});

	it('gives a free Defend its own row, with its own effect', () => {
		const { data, rows } = plan([rule({ id: 'slipstream', way: 'freeDefend', outcome: 'miss' })]);

		const free = data.options.find((option) => option.id === 'free:Item.slipstream:slipstream');
		expect(free).toMatchObject({ title: 'slipstream', defend: true, takes: 0 });
		expect(rows.get(free?.id ?? '')?.way).toBe('free');
	});

	it('shows a free Defend that needs an Interpose only with one', () => {
		const { data } = plan([rule({ id: 'paragon', way: 'freeDefend', withInterpose: true })]);
		expect(data.options.map((option) => option.id)).toEqual(['defend']);
	});

	describe('the cost of an Interpose', () => {
		function interposeCost(source: 'baseline' | 'rule') {
			const { data } = defendWindowPlan(card as never, {
				actor: hero([]) as never,
				targetTokenUuid: null,
				interposes: [
					{
						id: 'interpose-1',
						kind: 'redirectToSelf',
						source,
						actorUuid: 'Actor.pip',
						tokenUuid: TOKEN,
						targetTokenUuid: 'Scene.s.Token.ally',
					},
				] as never,
				defend: null,
			});
			return data.options.find((option) => option.id === 'interpose:interpose-1')?.cost;
		}

		it('is 1 action for the baseline Interpose', () => {
			expect(interposeCost('baseline')).toBe('NIMBLE.chat.defend.actionsOne');
		});

		it('is the same for an Interpose that a rule gives a longer range', () => {
			expect(interposeCost('rule')).toBe('NIMBLE.chat.defend.actionsOne');
		});
	});

	describe('a tick that uses a reroll', () => {
		const fearsome = () => rule({ id: 'fearsome', useReroll: true, alsoInterpose: true });
		const interpose = {
			id: 'interpose-1',
			source: 'baseline',
			tokenUuid: TOKEN,
			targetTokenUuid: 'Scene.s.Token.ally',
		};

		function interposePlan(rules: unknown[]) {
			return defendWindowPlan(card as never, {
				actor: hero(rules) as never,
				targetTokenUuid: null,
				interposes: [interpose] as never,
				defend: null,
			});
		}

		it('is not shown when its reroll is not on the card and no Interpose can bring it', () => {
			const { data } = plan([fearsome()]);
			expect(data.ticks).toEqual([]);
		});

		it('goes with an Interpose before its reroll is on the card', () => {
			const { data } = interposePlan([fearsome()]);
			const tickIds = (id: string) => data.options.find((option) => option.id === id)?.tickIds;

			expect(data.ticks.map((tick) => tick.id)).toEqual(['Item.fearsome:fearsome']);
			expect(tickIds('interpose:interpose-1')).toEqual(['Item.fearsome:fearsome']);
			expect(tickIds('both:interpose-1')).toEqual(['Item.fearsome:fearsome']);
		});

		it('goes with an Interpose alone also when it does not reroll', () => {
			const { data } = interposePlan([rule({ id: 'bunny', alsoInterpose: true })]);
			const tickIds = (id: string) => data.options.find((option) => option.id === id)?.tickIds;

			expect(tickIds('interpose:interpose-1')).toEqual(['Item.bunny:bunny']);
		});

		it('goes with only an Interpose and a Defend when the option does not say "also when you Interpose"', () => {
			const { data } = interposePlan([rule({ id: 'pocket', useReroll: true })]);
			const tickIds = (id: string) => data.options.find((option) => option.id === id)?.tickIds;

			expect(tickIds('interpose:interpose-1')).toEqual([]);
			expect(tickIds('both:interpose-1')).toEqual(['Item.pocket:pocket']);
		});
	});
});
