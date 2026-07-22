import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SYSTEM_ID } from '#system';
import { DiceConsumerRule } from './diceConsumer.js';

vi.stubGlobal('Hooks', { call: vi.fn().mockReturnValue(true), callAll: vi.fn() });

function createDiceConsumerRule(config: {
	mode?: string;
	effectFormula?: string | null;
	disabled?: boolean;
}) {
	const item = {
		id: 'item-tayg',
		isEmbedded: true,
		name: 'That all you got?!',
		uuid: 'test-item-uuid',
		actor: { uuid: 'Actor.test-actor' },
	};

	const rule = new DiceConsumerRule(
		{
			poolIdentifier: 'fury',
			poolScope: 'item',
			mode: config.mode ?? 'manual',
			cost: '1',
			bonusOnAttackDelivery: null,
			effectFormula: config.effectFormula === undefined ? '@n' : config.effectFormula,
			effectType: 'damageReduction',
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
	(rule as any).id = 'test-consumer-id';

	Object.defineProperty(rule, 'item', {
		get: () => item,
		configurable: true,
	});

	Object.defineProperty(rule, '_predicate', {
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
		});

		it('defaults effectFormula to null', () => {
			const schema = DiceConsumerRule.defineSchema();
			const effectFormula = schema.effectFormula as unknown as { initial: unknown };
			expect(effectFormula.initial).toBeNull();
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
});
