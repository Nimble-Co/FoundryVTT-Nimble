import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SYSTEM_ID } from '#system';
import { DiceConsumerRule } from './diceConsumer.js';

vi.stubGlobal('Hooks', { call: vi.fn().mockReturnValue(true), callAll: vi.fn() });

function createDiceConsumerRule(config: {
	mode?: string;
	effectFormula?: string | null;
	disabled?: boolean;
	selectionOutcome?: string;
	effectType?: string;
	cardOffer?: string | null;
	actorType?: string;
	bonusOnAttackDelivery?: string | null;
}) {
	const item = {
		id: 'item-tayg',
		isEmbedded: true,
		name: 'That all you got?!',
		uuid: 'test-item-uuid',
		actor: { uuid: 'Actor.test-actor', type: config.actorType ?? 'character' },
	};

	const rule = new DiceConsumerRule(
		{
			poolIdentifier: 'fury',
			poolScope: 'item',
			mode: config.mode ?? 'manual',
			cost: '1',
			bonusOnAttackDelivery: config.bonusOnAttackDelivery ?? null,
			effectFormula: config.effectFormula === undefined ? '@n' : config.effectFormula,
			effectType: config.effectType ?? 'damageReduction',
			cardOffer: config.cardOffer ?? null,
			selectionOutcome: config.selectionOutcome ?? 'consume',
			disabled: config.disabled ?? false,
			label: 'Test Consumer',
			id: 'test-consumer-id',
			identifier: '',
			priority: 1,
			predicate: {},
			type: 'diceConsumer',
		} as foundry.data.fields.SchemaField.CreateData<DiceConsumerRule['schema']['fields']>,
		{ parent: item as unknown as foundry.abstract.DataModel.Any, strict: false },
	);

	(rule as any).mode = config.mode ?? 'manual';
	(rule as any).effectFormula = config.effectFormula === undefined ? '@n' : config.effectFormula;
	(rule as any).disabled = config.disabled ?? false;
	(rule as any).poolIdentifier = 'fury';
	(rule as any).poolScope = 'item';
	(rule as any).selectionOutcome = config.selectionOutcome ?? 'consume';
	(rule as any).effectType = config.effectType ?? 'damageReduction';
	(rule as any).cardOffer = config.cardOffer ?? null;
	(rule as any).bonusOnAttackDelivery = config.bonusOnAttackDelivery ?? null;
	(rule as any).id = 'test-consumer-id';

	Object.defineProperty(rule, 'item', {
		get: () => item,
		configurable: true,
	});

	Object.defineProperty(rule, 'predicate', {
		get: () => ({ size: 0 }),
		configurable: true,
	});

	return { rule, item };
}

describe('DiceConsumerRule', () => {
	describe('schema', () => {
		it('defines the expected fields', () => {
			const schema = DiceConsumerRule.defineSchema();
			expect(schema).toHaveProperty('type');
			expect(schema).toHaveProperty('poolIdentifier');
			expect(schema).toHaveProperty('poolScope');
			expect(schema).toHaveProperty('mode');
			expect(schema).toHaveProperty('cost');
			expect(schema).toHaveProperty('bonusOnAttackDelivery');
			expect(schema).toHaveProperty('effectFormula');
			expect(schema).toHaveProperty('effectType');
			expect(schema).toHaveProperty('damageType');
		});

		it('defaults damageType to the inherit-the-attack sentinel', () => {
			const schema = DiceConsumerRule.defineSchema();
			const damageType = schema.damageType as unknown as { initial: unknown; blank: boolean };

			expect(damageType.initial).toBe('');
			expect(damageType.blank).toBe(true);
		});

		it('defaults effectFormula to null', () => {
			const schema = DiceConsumerRule.defineSchema();
			const effectFormula = schema.effectFormula as unknown as { initial: unknown };
			expect(effectFormula.initial).toBeNull();
		});

		it('defaults selectionOutcome to consume with the expected choices', () => {
			const schema = DiceConsumerRule.defineSchema();
			const field = schema.selectionOutcome as unknown as {
				initial: string;
				choices: readonly string[];
			};
			expect(field.initial).toBe('consume');
			expect([...field.choices]).toEqual(['consume', 'maximize']);
		});

		it('defaults effectType to generic with the expected choices', () => {
			const schema = DiceConsumerRule.defineSchema();
			const effectType = schema.effectType as unknown as { initial: unknown; choices: string[] };
			expect(effectType.initial).toBe('generic');
			expect(effectType.choices).toEqual(['generic', 'damageReduction']);
		});
	});

	describe('class metadata', () => {
		it('exposes the picker group and i18n description key', () => {
			expect(DiceConsumerRule.group).toBe('resource');
			expect(DiceConsumerRule.description).toBe('NIMBLE.rules.diceConsumer.description');
		});

		it('declares onItemActivated as always dispatched', () => {
			// This declaration is the only thing keeping the activation-time
			// spend flow alive when rule automation is toggled off; the
			// dispatcher gate tests only exercise synthetic rule classes, so
			// pin the real declaration here.
			expect(DiceConsumerRule.alwaysDispatchedEvents).toContain('onItemActivated');
		});
	});

	describe('suppressesActivationCard', () => {
		it('suppresses the card for manual consumers with an effect formula', () => {
			const { rule } = createDiceConsumerRule({});
			expect(rule.suppressesActivationCard()).toBe(true);
		});

		it('does not suppress for autoBonus consumers', () => {
			const { rule } = createDiceConsumerRule({ mode: 'autoBonus' });
			expect(rule.suppressesActivationCard()).toBe(false);
		});

		it('suppresses the card for a transforming outcome even without a formula', () => {
			const { rule } = createDiceConsumerRule({
				effectFormula: null,
				selectionOutcome: 'maximize',
			});
			expect(rule.suppressesActivationCard({ automationEnabled: true })).toBe(true);
		});

		it('does not suppress without an effect formula', () => {
			const { rule } = createDiceConsumerRule({ effectFormula: null });
			expect(rule.suppressesActivationCard()).toBe(false);
		});

		it('does not suppress when the rule is disabled', () => {
			const { rule } = createDiceConsumerRule({ disabled: true });
			expect(rule.suppressesActivationCard()).toBe(false);
		});

		it('honors an explicit `never` over the automatic spend-flow suppression', () => {
			const { rule } = createDiceConsumerRule({});
			(rule as any).suppressActivationCard = 'never';
			expect(rule.suppressesActivationCard()).toBe(false);
		});

		it('honors an explicit `always` even without a spend flow', () => {
			const { rule } = createDiceConsumerRule({ mode: 'autoBonus' });
			(rule as any).suppressActivationCard = 'always';
			expect(rule.suppressesActivationCard()).toBe(true);
		});
	});

	describe('onItemActivated', () => {
		beforeEach(() => {
			vi.clearAllMocks();
		});

		function activationContext(sourceItem: unknown) {
			type Ctx = Parameters<DiceConsumerRule['onItemActivated']>[0];
			return { sourceItem, sourceActor: null, card: null } as unknown as Ctx;
		}

		it('requests the spend UI when its manual consumer item is activated', async () => {
			const { rule, item } = createDiceConsumerRule({});

			await rule.onItemActivated(activationContext(item));

			expect(Hooks.callAll).toHaveBeenCalledWith(`${SYSTEM_ID}.dicePool.requestSpend`, {
				actorUuid: 'Actor.test-actor',
				itemId: 'item-tayg',
				ruleId: 'test-consumer-id',
				poolIdentifier: 'fury',
				poolScope: 'item',
			});
		});

		it('ignores activations of other items', async () => {
			const { rule } = createDiceConsumerRule({});

			await rule.onItemActivated(activationContext({ id: 'other-item' }));

			expect(Hooks.callAll).not.toHaveBeenCalled();
		});

		it('does not request the spend UI for autoBonus consumers', async () => {
			const { rule, item } = createDiceConsumerRule({ mode: 'autoBonus' });

			await rule.onItemActivated(activationContext(item));

			expect(Hooks.callAll).not.toHaveBeenCalled();
		});

		it('requests the spend UI for a transforming outcome without a formula', async () => {
			const { rule, item } = createDiceConsumerRule({
				effectFormula: null,
				selectionOutcome: 'maximize',
			});
			await rule.onItemActivated({ sourceItem: item } as never);
			expect(Hooks.callAll).toHaveBeenCalledWith(
				`${SYSTEM_ID}.dicePool.requestSpend`,
				expect.objectContaining({ poolIdentifier: 'fury', ruleId: 'test-consumer-id' }),
			);
		});

		it('does not request the spend UI without an effect formula', async () => {
			const { rule, item } = createDiceConsumerRule({ effectFormula: null });

			await rule.onItemActivated(activationContext(item));

			expect(Hooks.callAll).not.toHaveBeenCalled();
		});

		it('does not request the spend UI when the rule is disabled', async () => {
			const { rule, item } = createDiceConsumerRule({ disabled: true });

			await rule.onItemActivated(activationContext(item));

			expect(Hooks.callAll).not.toHaveBeenCalled();
		});
	});

	describe('suppressesActivationCard with a card offer', () => {
		it('gives up its sheet spend flow, which cannot see the attack outcome', () => {
			const { rule } = createDiceConsumerRule({
				effectType: 'generic',
				cardOffer: 'criticalHit',
			});

			expect(rule.suppressesActivationCard()).toBe(false);
		});
	});

	describe('providesCardOffer', () => {
		it('opts in when an outcome trigger is set on a generic manual spend', () => {
			const { rule } = createDiceConsumerRule({
				effectType: 'generic',
				cardOffer: 'criticalHit',
			});

			expect(rule.providesCardOffer()).toBe(true);
		});

		it('stays out of the card when no trigger is set', () => {
			const { rule } = createDiceConsumerRule({ effectType: 'generic' });

			expect(rule.providesCardOffer()).toBe(false);
		});

		it('refuses an auto-bonus consumer, which never prompts the player', () => {
			const { rule } = createDiceConsumerRule({
				mode: 'autoBonus',
				effectType: 'generic',
				cardOffer: 'criticalHit',
			});

			expect(rule.providesCardOffer()).toBe(false);
		});

		it('refuses a banked reduction, which is not damage on this attack', () => {
			const { rule } = createDiceConsumerRule({
				effectType: 'damageReduction',
				cardOffer: 'criticalHit',
			});

			expect(rule.providesCardOffer()).toBe(false);
		});

		it('refuses a maximize outcome, which produces no damage to fold', () => {
			const { rule } = createDiceConsumerRule({
				effectType: 'generic',
				selectionOutcome: 'maximize',
				cardOffer: 'criticalHit',
			});

			expect(rule.providesCardOffer()).toBe(false);
		});

		it('refuses an NPC, whose actor type has no pools to spend from', () => {
			const { rule } = createDiceConsumerRule({
				effectType: 'generic',
				cardOffer: 'criticalHit',
				actorType: 'npc',
			});

			expect(rule.providesCardOffer()).toBe(false);
		});

		it('refuses a consumer with no effect formula to evaluate', () => {
			const { rule } = createDiceConsumerRule({
				effectType: 'generic',
				effectFormula: null,
				cardOffer: 'criticalHit',
			});

			expect(rule.providesCardOffer()).toBe(false);
		});

		it('offers a delivery-filtered spend on an attack that matches', () => {
			const { rule } = createDiceConsumerRule({
				effectType: 'generic',
				cardOffer: 'criticalHit',
				bonusOnAttackDelivery: 'melee',
			});

			expect(rule.providesCardOffer({ delivery: 'melee' })).toBe(true);
		});

		it('withholds a delivery-filtered spend from an attack delivered the other way', () => {
			const { rule } = createDiceConsumerRule({
				effectType: 'generic',
				cardOffer: 'criticalHit',
				bonusOnAttackDelivery: 'melee',
			});

			expect(rule.providesCardOffer({ delivery: 'ranged' })).toBe(false);
		});

		it('withholds a delivery-filtered spend from an activation with no attack type', () => {
			const { rule } = createDiceConsumerRule({
				effectType: 'generic',
				cardOffer: 'criticalHit',
				bonusOnAttackDelivery: 'ranged',
			});

			expect(rule.providesCardOffer({ delivery: null })).toBe(false);
		});

		it("offers an 'any' filter on every delivery, including none at all", () => {
			const { rule } = createDiceConsumerRule({
				effectType: 'generic',
				cardOffer: 'criticalHit',
				bonusOnAttackDelivery: 'any',
			});

			expect(rule.providesCardOffer({ delivery: 'melee' })).toBe(true);
			expect(rule.providesCardOffer({ delivery: 'ranged' })).toBe(true);
			expect(rule.providesCardOffer({ delivery: null })).toBe(true);
		});

		it('fails closed when a filtered consumer is asked without an attack context', () => {
			const { rule } = createDiceConsumerRule({
				effectType: 'generic',
				cardOffer: 'criticalHit',
				bonusOnAttackDelivery: 'melee',
			});

			expect(rule.providesCardOffer()).toBe(false);
		});

		it('leaves an unfiltered consumer unaffected by the attack context', () => {
			const { rule } = createDiceConsumerRule({
				effectType: 'generic',
				cardOffer: 'criticalHit',
			});

			expect(rule.providesCardOffer({ delivery: 'ranged' })).toBe(true);
			expect(rule.providesCardOffer({ delivery: null })).toBe(true);
		});

		it('still short-circuits on the earlier gates before consulting delivery', () => {
			const { rule } = createDiceConsumerRule({
				mode: 'autoBonus',
				effectType: 'generic',
				cardOffer: 'criticalHit',
				bonusOnAttackDelivery: 'melee',
			});

			expect(rule.providesCardOffer({ delivery: 'melee' })).toBe(false);
		});
	});
});
