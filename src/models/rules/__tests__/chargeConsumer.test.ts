import { describe, expect, it } from 'vitest';
import { ChargeConsumerRule } from '../chargeConsumer.js';

describe('ChargeConsumerRule', () => {
	describe('schema', () => {
		it('defines the expected fields', () => {
			const schema = ChargeConsumerRule.defineSchema();
			expect(schema).toHaveProperty('type');
			expect(schema).toHaveProperty('poolIdentifier');
			expect(schema).toHaveProperty('poolScope');
			expect(schema).toHaveProperty('cost');
			expect(schema).toHaveProperty('costMode');
			expect(schema).toHaveProperty('maxCost');
		});

		it('spends a fixed cost until told otherwise', () => {
			const schema = ChargeConsumerRule.defineSchema() as any;

			expect(schema.costMode.initial).toBe('fixed');
			expect(schema.maxCost.initial).toBe('');
		});

		it('offers both cost modes with localized labels', () => {
			const schema = ChargeConsumerRule.defineSchema() as any;
			const choices = schema.costMode.choices();

			expect(choices).toEqual({
				fixed: 'NIMBLE.rules.chargeConsumer.costMode.choices.fixed',
				variable: 'NIMBLE.rules.chargeConsumer.costMode.choices.variable',
			});
		});

		it('spends a charge on each use until the rule allows a use with none', () => {
			const schema = ChargeConsumerRule.defineSchema() as any;
			const { allowFree } = schema;

			expect(allowFree.initial).toBe(false);
			expect(allowFree.options.label).toBe('NIMBLE.rules.chargeConsumer.allowFree.label');
			expect(allowFree.options.showWhen({ costMode: 'fixed' })).toBe(true);
			expect(allowFree.options.showWhen({ costMode: 'variable' })).toBe(false);
		});

		it('shows the ceiling only where it applies', () => {
			const schema = ChargeConsumerRule.defineSchema() as any;
			const { showWhen } = schema.maxCost.options;

			expect(showWhen({ costMode: 'variable' })).toBe(true);
			expect(showWhen({ costMode: 'fixed' })).toBe(false);
		});
	});

	describe('a spend from the attack card', () => {
		function consumer(data: Record<string, unknown>, actorType = 'character') {
			const item = {
				isEmbedded: true,
				name: 'Heavy Strike',
				uuid: 'Item.heavy',
				actor: { uuid: 'Actor.hero', type: actorType, getDomain: () => new Set<string>() },
			};
			const rule = new ChargeConsumerRule(
				{ type: 'chargeConsumer' } as never,
				{
					parent: item,
					strict: false,
				} as never,
			);
			Object.assign(rule as object, {
				poolIdentifier: 'combat-dice',
				cost: '1',
				cardOffer: null,
				effectFormula: '',
				pushDistance: '',
				pushDistanceBySize: {},
				disabled: false,
				...data,
			});
			Object.defineProperty(rule, 'parent', { get: () => item, configurable: true });
			Object.defineProperty(rule, 'predicate', { get: () => ({ size: 0 }), configurable: true });
			return rule;
		}

		it('is offered after the outcome it names, with damage to add', () => {
			expect(
				consumer({
					cardOffer: 'hit',
					effectFormula: '1d@pools.combat-dice.faces',
				}).providesCardOffer(),
			).toBe(true);
		});

		it('is not offered with no outcome, no damage, or for a creature that is not a hero', () => {
			expect(consumer({ effectFormula: '1d6' }).providesCardOffer()).toBe(false);
			expect(consumer({ cardOffer: 'hit', effectFormula: ' ' }).providesCardOffer()).toBe(false);
			expect(consumer({ cardOffer: 'hit', effectFormula: '1d6' }, 'npc').providesCardOffer()).toBe(
				false,
			);
		});

		it('is offered on all attacks until the rule names what they are made with', () => {
			const rule = consumer({ cardOffer: 'hit', effectFormula: '1d6' });

			expect(rule.providesCardOffer({ delivery: 'ranged', source: 'spell' })).toBe(true);
			expect(rule.providesCardOffer({ delivery: 'melee', source: null })).toBe(true);
		});

		it('is offered on weapon attacks only when the rule says weapon', () => {
			const rule = consumer({ cardOffer: 'hit', effectFormula: '1d6', cardOfferSource: 'weapon' });

			expect(rule.providesCardOffer({ delivery: 'melee', source: 'weapon' })).toBe(true);
			expect(rule.providesCardOffer({ delivery: 'ranged', source: 'spell' })).toBe(false);
			expect(rule.providesCardOffer({ delivery: 'melee', source: null })).toBe(false);
			expect(rule.providesCardOffer()).toBe(false);
		});

		it('pushes the targets by the distance of their size, else the distance', () => {
			const rule = consumer({
				cardOffer: 'hit',
				effectFormula: '1d6',
				pushDistance: '@strength',
				pushDistanceBySize: { small: '@strength*2', large: '', huge: '0' },
			});

			expect(rule.cardPush).toEqual({
				distance: '@strength',
				distanceBySize: { small: '@strength*2', huge: '0' },
			});
		});

		it('pushes nothing when no distance is set', () => {
			expect(consumer({ cardOffer: 'hit', effectFormula: '1d6' }).cardPush).toBeNull();
		});

		it('shows the spend fields only for a spend from the card', () => {
			const schema = ChargeConsumerRule.defineSchema() as any;

			expect(schema.cardOffer.initial).toBeNull();
			expect(schema.cardOfferSource.initial).toBe('any');
			for (const field of [
				'cardOfferSource',
				'effectFormula',
				'pushDistance',
				'pushDistanceBySize',
			]) {
				expect(schema[field].options.showWhen({ cardOffer: 'hit' })).toBe(true);
				expect(schema[field].options.showWhen({ cardOffer: null })).toBe(false);
			}
		});
	});

	describe('class metadata', () => {
		it('exposes the picker group and i18n description key', () => {
			expect(ChargeConsumerRule.group).toBe('resource');
			expect(ChargeConsumerRule.description).toBe('NIMBLE.rules.chargeConsumer.description');
		});
	});
});
