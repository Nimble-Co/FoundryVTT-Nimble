import { describe, expect, it, vi } from 'vitest';
import { collectPoolSpendCardOffers } from './poolSpendCardOffers.js';

vi.stubGlobal('foundry', {
	utils: { randomID: () => 'generated-id' },
});

function consumerRule(overrides: Record<string, unknown> = {}) {
	return {
		type: 'diceConsumer',
		id: 'death-blow-fury-consumer',
		label: 'Death Blow: bonus damage',
		cardOffer: 'criticalHit',
		item: { name: 'Death Blow', uuid: 'Item.death-blow' },
		providesCardOffer: () => true,
		...overrides,
	};
}

function actorWith(rules: unknown[]) {
	return { uuid: 'Actor.berserker', rules } as Parameters<typeof collectPoolSpendCardOffers>[0];
}

describe('collectPoolSpendCardOffers', () => {
	it('builds an attacker-side offer from an opted-in consumer', () => {
		const offers = collectPoolSpendCardOffers(actorWith([consumerRule()]));

		expect(offers).toEqual([
			{
				id: 'generated-id',
				kind: 'spendPoolForDamage',
				source: 'rule',
				actorUuid: 'Actor.berserker',
				tokenUuid: null,
				targetTokenUuid: null,
				label: 'Death Blow: bonus damage',
				ruleId: 'death-blow-fury-consumer',
				itemUuid: 'Item.death-blow',
				used: false,
				outcomeTrigger: 'criticalHit',
			},
		]);
	});

	it('carries the trigger through so the outcome filter can gate it', () => {
		const offers = collectPoolSpendCardOffers(actorWith([consumerRule({ cardOffer: 'hit' })]));

		expect(offers[0].outcomeTrigger).toBe('hit');
	});

	it('leaves the eligibility call to the rule', () => {
		const offers = collectPoolSpendCardOffers(
			actorWith([consumerRule({ providesCardOffer: () => false })]),
		);

		expect(offers).toEqual([]);
	});

	it('hands the attack context to the rule untouched', () => {
		const providesCardOffer = vi.fn(() => true);
		const context = { delivery: 'melee' } as const;

		collectPoolSpendCardOffers(actorWith([consumerRule({ providesCardOffer })]), context);

		expect(providesCardOffer).toHaveBeenCalledWith(context);
	});

	it('passes no context through when the caller supplies none', () => {
		const providesCardOffer = vi.fn(() => true);

		collectPoolSpendCardOffers(actorWith([consumerRule({ providesCardOffer })]));

		expect(providesCardOffer).toHaveBeenCalledWith(undefined);
	});

	it('ignores rules of other types', () => {
		const offers = collectPoolSpendCardOffers(actorWith([consumerRule({ type: 'dicePool' })]));

		expect(offers).toEqual([]);
	});

	it('falls back to the item name when the rule carries no label', () => {
		const offers = collectPoolSpendCardOffers(actorWith([consumerRule({ label: '' })]));

		expect(offers[0].label).toBe('Death Blow');
	});

	it('returns nothing for an actor with no uuid or no rules', () => {
		expect(collectPoolSpendCardOffers(null)).toEqual([]);
		expect(collectPoolSpendCardOffers({ uuid: '', rules: [consumerRule()] } as never)).toEqual([]);
		expect(collectPoolSpendCardOffers({ uuid: 'Actor.x' })).toEqual([]);
	});
});
