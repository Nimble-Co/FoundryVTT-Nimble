import { beforeEach, describe, expect, it, vi } from 'vitest';
import { defendWindowPlan } from '../openDefendWindow.js';

const TOKEN = 'Scene.s.Token.pip';

type Globals = { fromUuidSync: ReturnType<typeof vi.fn>; game: Record<string, unknown> };

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

/** 17 damage: armor comes off, half rounds up, a miss is 0. */
const card = {
	id: 'm1',
	flavor: 'Club',
	system: { activation: { targets: { attackType: 'reach' } } },
	isMinionGroupAttackCard: () => false,
	previewDamageFor: vi.fn(
		(_token: string, defend: number | { armor?: number; zero?: boolean; halve?: boolean }) => {
			if (typeof defend === 'number') return 17 - defend;
			if (defend.zero) return 0;
			if (defend.halve) return 9;
			return 17 - (defend.armor ?? 0);
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

describe('defendWindowPlan', () => {
	it('lists the "When you Defend" ticks, and the damage follows them', () => {
		const { data } = plan([
			rule({ id: 'misdirection', outcome: 'halve' }),
			rule({ id: 'infusion', bonus: 4 }),
			rule({ id: 'decoy', outcome: 'miss' }),
		]);

		expect(data.ticks.map((tick) => tick.id)).toEqual([
			'Item.misdirection:misdirection',
			'Item.infusion:infusion',
			'Item.decoy:decoy',
		]);
		expect(data.takesWith('defend', [])).toBe(14);
		expect(data.takesWith('defend', ['Item.infusion:infusion'])).toBe(10);
		expect(data.takesWith('defend', ['Item.misdirection:misdirection'])).toBe(9);
		expect(data.takesWith('defend', ['Item.misdirection:misdirection', 'Item.decoy:decoy'])).toBe(
			0,
		);
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
});
