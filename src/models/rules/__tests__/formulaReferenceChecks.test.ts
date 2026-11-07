import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Predicate } from '../../../etc/Predicate.js';
import { ConditionalBonusRule } from '../conditionalBonus.js';
import { CritDiceRule } from '../critDice.js';
import { CritDiceSaveRule } from '../critDiceSave.js';
import { DamageBonusRule } from '../damageBonus.js';
import { DiceConsumerRule } from '../diceConsumer.js';
import { ModifyConsumerRule } from '../modifyConsumer.js';
import { UnarmedDamageRule } from '../unarmedDamage.js';

type RuleClass = new (data: never, options: never) => object;

function makeRule(RuleType: RuleClass, itemName: string, fields: Record<string, unknown>) {
	const actor = {
		name: 'Hero',
		system: {},
		getDomain: () => new Set<string>(),
		getRollData: () => ({ strength: 2, level: 3 }),
	};
	const item = { isEmbedded: true, isOwner: true, name: itemName, actor };
	const rule = new RuleType({} as never, { parent: item, strict: false } as never);
	Object.assign(rule, { label: '', disabled: false, predicate: new Predicate({}), ...fields });
	Object.defineProperty(rule, 'parent', { get: () => item, configurable: true });
	return rule as { afterPrepareData(): void; resolveDamage?: () => unknown };
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
const warnings = () => vi.mocked(ui.notifications.warn).mock.calls.map((call) => String(call[0]));

describe('rule formulas resolved outside the rule', () => {
	beforeEach(() => {
		vi.mocked(ui.notifications.warn).mockClear();
		vi.spyOn(console, 'warn').mockImplementation(() => {});
		vi.spyOn(foundry.utils, 'setProperty').mockImplementation(() => true);
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it.each([
		['Damage Bonus dice', DamageBonusRule, { type: 'damageBonus', value: '1d6 + @strenth' }],
		['Unarmed Damage', UnarmedDamageRule, { type: 'unarmedDamage', value: '1d4 + @strenth' }],
		['Crit Dice', CritDiceRule, { type: 'critDice', formula: '1d6 + @strenth' }],
		['Crit Dice Save', CritDiceSaveRule, { type: 'critDiceSave', saveDC: '10 + @strenth' }],
		['Dice Consumer cost', DiceConsumerRule, { type: 'diceConsumer', cost: '@strenth' }],
		['Modify Consumer', ModifyConsumerRule, { type: 'modifyConsumer', appendFormula: '@strenth' }],
	])('%s warns once data preparation ends', async (name, RuleType, fields) => {
		makeRule(RuleType as RuleClass, name, fields).afterPrepareData();
		await flush();

		expect(warnings()).toHaveLength(1);
		expect(warnings()[0]).toContain(`${name}:`);
		expect(warnings()[0]).toContain('@strenth');
	});

	it('Conditional Bonus dice warn when the damage is worked out', async () => {
		const rule = makeRule(ConditionalBonusRule as RuleClass, 'Conditional', {
			type: 'conditionalBonus',
			damageBonus: '1d6 + @strenth',
		});
		Object.assign(rule, { offersDamage: () => true });
		rule.resolveDamage?.();
		await flush();

		expect(warnings()).toHaveLength(1);
	});

	it('gives no warning for @n and @sum, which a spend fills in', async () => {
		makeRule(DiceConsumerRule as RuleClass, 'Spend', {
			type: 'diceConsumer',
			cost: '1',
			effectFormula: '@sum + @n * @level',
		}).afterPrepareData();
		makeRule(ModifyConsumerRule as RuleClass, 'Append', {
			type: 'modifyConsumer',
			appendFormula: '@sum',
		}).afterPrepareData();
		await flush();

		expect(warnings()).toEqual([]);
	});
});
