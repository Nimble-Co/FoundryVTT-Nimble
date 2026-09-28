import { beforeEach, describe, expect, it, vi } from 'vitest';

let rolledTotal = 20;
const evaluate = vi.fn();
const toMessage = vi.fn();
const rollConstructor = vi.fn();

class MockRoll {
	total: number;

	constructor(formula: string, data?: unknown) {
		rollConstructor(formula, data);
		this.total = rolledTotal;
	}

	evaluate = evaluate;
	toMessage = toMessage;
}

vi.stubGlobal('Roll', MockRoll);

const { RecurringDamageRule } = await import('./recurringDamage.js');

interface MockActor {
	applyDamage: ReturnType<typeof vi.fn>;
	getRollData: ReturnType<typeof vi.fn>;
}

function createMockActor(): MockActor {
	return { applyDamage: vi.fn(), getRollData: vi.fn(() => ({ level: 3 })) };
}

function createRule(
	config: { formula?: string; trigger?: 'turnStart' | 'turnEnd'; disabled?: boolean },
	actor: MockActor,
) {
	const item = { actor, isEmbedded: true, name: 'Swallowed.', uuid: 'item-uuid' };
	const sourceData = {
		formula: config.formula ?? '20',
		trigger: config.trigger ?? 'turnStart',
		disabled: config.disabled ?? false,
		label: 'Swallowed: 20 damage at the start of your turn',
		id: 'recurring-damage-id',
		identifier: '',
		priority: 1,
		predicate: {},
		type: 'recurringDamage',
	};

	const rule = new RecurringDamageRule(
		sourceData as foundry.data.fields.SchemaField.CreateData<
			InstanceType<typeof RecurringDamageRule>['schema']['fields']
		>,
		{ parent: item as unknown as foundry.abstract.DataModel.Any, strict: false },
	);

	(rule as unknown as { formula: string }).formula = sourceData.formula;
	(rule as unknown as { trigger: string }).trigger = sourceData.trigger;
	(rule as unknown as { disabled: boolean }).disabled = sourceData.disabled;

	Object.defineProperty(rule, 'item', { get: () => item, configurable: true });
	Object.defineProperty(rule, 'predicate', { get: () => ({ size: 0 }), configurable: true });

	return { rule, item, actor };
}

function turnContext(actor: unknown) {
	type Ctx = Parameters<InstanceType<typeof RecurringDamageRule>['onTurnStart']>[0];
	return { combat: null, combatant: null, actor } as unknown as Ctx;
}

describe('RecurringDamageRule', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		rolledTotal = 20;
	});

	describe('schema', () => {
		it('defines the expected fields', () => {
			const schema = RecurringDamageRule.defineSchema();

			expect(schema).toHaveProperty('formula');
			expect(schema).toHaveProperty('trigger');
			expect(schema).toHaveProperty('type');
		});

		it('restricts trigger to the start or end of a turn', () => {
			const schema = RecurringDamageRule.defineSchema();
			const trigger = schema.trigger as unknown as { choices: string[]; initial: string };

			expect(trigger.choices).toEqual(['turnStart', 'turnEnd']);
			expect(trigger.initial).toBe('turnStart');
		});

		it('exposes the picker group and i18n description key', () => {
			expect(RecurringDamageRule.group).toBe('triggers');
			expect(RecurringDamageRule.description).toBe('NIMBLE.rules.recurringDamage.description');
		});
	});

	describe('onTurnStart', () => {
		it('rolls the formula and damages the actor whose turn started', async () => {
			const { rule, actor } = createRule({ formula: '20' }, createMockActor());

			await rule.onTurnStart(turnContext(actor));

			expect(rollConstructor).toHaveBeenCalledWith('20', { level: 3 });
			expect(actor.applyDamage).toHaveBeenCalledWith(20);
		});

		it('posts the roll to chat before applying it', async () => {
			const { rule, actor } = createRule({}, createMockActor());

			await rule.onTurnStart(turnContext(actor));

			expect(toMessage).toHaveBeenCalledTimes(1);
		});

		it('does nothing when another creature’s turn starts', async () => {
			const { rule, actor } = createRule({}, createMockActor());

			await rule.onTurnStart(turnContext(createMockActor()));

			expect(actor.applyDamage).not.toHaveBeenCalled();
		});

		it('does not fire for a rule configured for the end of the turn', async () => {
			const { rule, actor } = createRule({ trigger: 'turnEnd' }, createMockActor());

			await rule.onTurnStart(turnContext(actor));

			expect(actor.applyDamage).not.toHaveBeenCalled();
		});

		it('does nothing when the formula is blank', async () => {
			const { rule, actor } = createRule({ formula: '  ' }, createMockActor());

			await rule.onTurnStart(turnContext(actor));

			expect(actor.applyDamage).not.toHaveBeenCalled();
		});

		it('does nothing when the roll comes out at zero', async () => {
			rolledTotal = 0;
			const { rule, actor } = createRule({}, createMockActor());

			await rule.onTurnStart(turnContext(actor));

			expect(actor.applyDamage).not.toHaveBeenCalled();
			expect(toMessage).not.toHaveBeenCalled();
		});
	});

	describe('onTurnEnd', () => {
		it('damages the actor when configured for the end of the turn', async () => {
			const { rule, actor } = createRule({ trigger: 'turnEnd', formula: '2d6' }, createMockActor());

			await rule.onTurnEnd(turnContext(actor));

			expect(rollConstructor).toHaveBeenCalledWith('2d6', { level: 3 });
			expect(actor.applyDamage).toHaveBeenCalledWith(20);
		});

		it('does not fire for a rule configured for the start of the turn', async () => {
			const { rule, actor } = createRule({ trigger: 'turnStart' }, createMockActor());

			await rule.onTurnEnd(turnContext(actor));

			expect(actor.applyDamage).not.toHaveBeenCalled();
		});
	});
});
