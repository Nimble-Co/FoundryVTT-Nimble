import { describe, expect, it } from 'vitest';

import resolveOptionSwapOffer from './resolveOptionSwapOffer.ts';

interface SwapRuleConfig {
	trigger?: string;
	groups?: string[];
	label?: string;
}

interface MoveRuleConfig {
	trigger?: string;
	points?: number;
	label?: string;
}

function swapRule({ trigger = 'safeRest', groups = ['all'], label = '' }: SwapRuleConfig = {}) {
	return {
		type: 'optionSwap',
		label,
		offersSwapOn: (event: string) => event === trigger,
		coversAllGroups: groups.includes('all'),
		namedGroups: groups.includes('all') ? [] : groups,
	};
}

function moveRule({ trigger = 'safeRest', points = 1, label = '' }: MoveRuleConfig = {}) {
	return {
		type: 'skillPointMove',
		label,
		points,
		offersMoveOn: (event: string) => event === trigger,
	};
}

const actorWith = (...rules: unknown[]) => ({ rules });

describe('resolveOptionSwapOffer', () => {
	it('offers nothing when the character has no rules', () => {
		expect(resolveOptionSwapOffer(actorWith(), 'safeRest')).toBeNull();
	});

	it('offers nothing for an actor that is missing entirely', () => {
		expect(resolveOptionSwapOffer(null, 'safeRest')).toBeNull();
		expect(resolveOptionSwapOffer(undefined, 'safeRest')).toBeNull();
	});

	it('offers nothing on a rest the rules do not name', () => {
		expect(resolveOptionSwapOffer(actorWith(swapRule({ trigger: 'safeRest' })), 'fieldRest')).toBe(
			null,
		);
	});

	it("reports every pool when a rule covers 'all'", () => {
		const offer = resolveOptionSwapOffer(actorWith(swapRule()), 'safeRest');

		expect(offer?.allowedGroups).toBeNull();
	});

	it('reports only the pools a narrow rule names', () => {
		const offer = resolveOptionSwapOffer(
			actorWith(swapRule({ groups: ['savage-arsenal'] })),
			'safeRest',
		);

		expect(offer?.allowedGroups).toEqual(new Set(['savage-arsenal']));
	});

	it('unions the pools of several narrow rules', () => {
		const offer = resolveOptionSwapOffer(
			actorWith(swapRule({ groups: ['savage-arsenal'] }), swapRule({ groups: ['combat-tactics'] })),
			'safeRest',
		);

		expect(offer?.allowedGroups).toEqual(new Set(['savage-arsenal', 'combat-tactics']));
	});

	it('lets the widest rule win when a broad and a narrow rule are both present', () => {
		const offer = resolveOptionSwapOffer(
			actorWith(swapRule({ groups: ['savage-arsenal'] }), swapRule()),
			'safeRest',
		);

		expect(offer?.allowedGroups).toBeNull();
	});

	it('sums the skill points of several move rules', () => {
		const offer = resolveOptionSwapOffer(
			actorWith(moveRule({ points: 1 }), moveRule({ points: 2 })),
			'safeRest',
		);

		expect(offer?.skillPoints).toBe(3);
	});

	it('offers a skill point move on its own, with no pools', () => {
		const offer = resolveOptionSwapOffer(actorWith(moveRule()), 'safeRest');

		expect(offer?.skillPoints).toBe(1);
		expect(offer?.allowedGroups).toEqual(new Set());
	});

	it('offers pools on their own, with no skill points', () => {
		const offer = resolveOptionSwapOffer(actorWith(swapRule()), 'safeRest');

		expect(offer?.skillPoints).toBe(0);
	});

	it('quotes the offering feature, so the surface can show what the rules say', () => {
		const rule = {
			...swapRule({ label: 'Perform a notable act of destruction' }),
			item: {
				name: 'Wrath & Ruin',
				system: { description: '<p>Whenever you perform a notable act of destruction.</p>' },
			},
		};

		const offer = resolveOptionSwapOffer(actorWith(rule), 'safeRest');

		expect(offer?.sources).toMatchObject([
			{ name: 'Wrath & Ruin', text: 'Whenever you perform a notable act of destruction.' },
		]);
	});

	it('records what each feature covers, so the surface can group the pools under it', () => {
		const item = {
			uuid: 'Actor.a.Item.b',
			name: 'Rigorous Training',
			img: 'icons/training.webp',
			system: { description: '<p>Train.</p>' },
		};
		const offer = resolveOptionSwapOffer(
			actorWith(
				{ ...swapRule({ groups: ['commanders-orders'] }), item },
				{ ...moveRule({ points: 2 }), item },
			),
			'safeRest',
		);

		expect(offer?.sources).toEqual([
			{
				name: 'Rigorous Training',
				text: 'Train.',
				uuid: 'Actor.a.Item.b',
				img: 'icons/training.webp',
				coversAllGroups: false,
				groups: ['commanders-orders'],
				skillPoints: 2,
			},
		]);
	});

	it('marks a source that covers every pool', () => {
		const offer = resolveOptionSwapOffer(
			actorWith({ ...swapRule(), item: { uuid: 'Actor.a.Item.c', name: 'Wrath', img: 'x.webp' } }),
			'safeRest',
		);

		expect(offer?.sources[0]).toMatchObject({ coversAllGroups: true, groups: [], skillPoints: 0 });
	});

	it('falls back to the rule label when the feature has no description', () => {
		const offer = resolveOptionSwapOffer(
			actorWith(swapRule({ label: 'Perform a notable act of destruction' })),
			'safeRest',
		);

		expect(offer?.sources).toMatchObject([
			{ name: '', text: 'Perform a notable act of destruction' },
		]);
	});

	it('quotes a feature once, however many of its rules make an offer', () => {
		const item = { name: 'Jack of All Trades', system: { description: '<p>Move a point.</p>' } };
		const offer = resolveOptionSwapOffer(
			actorWith({ ...swapRule(), item }, { ...moveRule(), item }),
			'safeRest',
		);

		expect(offer?.sources).toHaveLength(1);
	});

	it('ignores rules of other types', () => {
		expect(resolveOptionSwapOffer(actorWith({ type: 'skillBonus' }), 'safeRest')).toBeNull();
	});

	it('offers on a field rest when a rule names one', () => {
		const offer = resolveOptionSwapOffer(
			actorWith(swapRule({ trigger: 'fieldRest' })),
			'fieldRest',
		);

		expect(offer?.allowedGroups).toBeNull();
	});
});
