import { afterEach, describe, expect, it, vi } from 'vitest';
import { Predicate } from '../../etc/Predicate.js';
import { AbilityBonusRule } from './abilityBonus.js';
import { ArmorClassRule } from './armorClass.js';
import { NimbleBaseRule } from './base.js';
import { DamageBonusRule } from './damageBonus.js';
import { GrantMovementRule } from './grantMovement.js';
import { SavingThrowRollModeRule } from './savingThrowRollMode.js';
import { SkillRollModeRule } from './skillRollMode.js';
import { SpeedBonusRule } from './speedBonus.js';
import { ToggleEffectRule } from './toggleEffect.js';

describe('NimbleBaseRule', () => {
	describe('appliesInPrePrepareData', () => {
		it('detects a prePrepareData implementation on an ad-hoc subclass', () => {
			class WithHook extends NimbleBaseRule {
				prePrepareData(): void {}
			}
			class WithoutHook extends NimbleBaseRule {}

			expect(WithHook.appliesInPrePrepareData).toBe(true);
			expect(WithoutHook.appliesInPrePrepareData).toBe(false);
		});

		it('reports true for rules that apply during prePrepareData', () => {
			expect(AbilityBonusRule.appliesInPrePrepareData).toBe(true);
			expect(SpeedBonusRule.appliesInPrePrepareData).toBe(true);
			expect(GrantMovementRule.appliesInPrePrepareData).toBe(true);
			expect(ToggleEffectRule.appliesInPrePrepareData).toBe(true);
		});

		it('reports false for rules that apply only after preparation', () => {
			expect(SavingThrowRollModeRule.appliesInPrePrepareData).toBe(false);
			expect(SkillRollModeRule.appliesInPrePrepareData).toBe(false);
			expect(ArmorClassRule.appliesInPrePrepareData).toBe(false);
			expect(DamageBonusRule.appliesInPrePrepareData).toBe(false);
		});
	});

	describe('appliesInPrePrepareDataFor', () => {
		it('defaults to the class-level answer for rules with no data-level override', () => {
			expect(AbilityBonusRule.appliesInPrePrepareDataFor({})).toBe(true);
			expect(DamageBonusRule.appliesInPrePrepareDataFor({})).toBe(false);
		});

		it('reports true only for numeric speedBonus values (formula applies after prep)', () => {
			expect(SpeedBonusRule.appliesInPrePrepareDataFor({ value: '2' })).toBe(true);
			expect(SpeedBonusRule.appliesInPrePrepareDataFor({ value: '-3' })).toBe(true);
			expect(SpeedBonusRule.appliesInPrePrepareDataFor({ value: '@abilities.dexterity.mod' })).toBe(
				false,
			);
			expect(SpeedBonusRule.appliesInPrePrepareDataFor({ value: '' })).toBe(false);
		});

		it('reports true only for numeric grantMovement speeds', () => {
			expect(GrantMovementRule.appliesInPrePrepareDataFor({ speed: '12' })).toBe(true);
			expect(
				GrantMovementRule.appliesInPrePrepareDataFor({ speed: '@attributes.movement.walk' }),
			).toBe(false);
		});
	});

	describe('late-predicate-key construction warning', () => {
		afterEach(() => {
			vi.restoreAllMocks();
		});

		function createRuleForWarning(
			RuleClass:
				| typeof AbilityBonusRule
				| typeof DamageBonusRule
				| typeof SpeedBonusRule
				| typeof GrantMovementRule,
			predicate: Record<string, unknown>,
			ruleId: string,
			source: Record<string, unknown> = {},
		) {
			const item = { uuid: `Item.${ruleId}`, name: 'Test Item', isEmbedded: true };
			const rule = new RuleClass(source as never, {
				parent: item as unknown as foundry.abstract.DataModel.Any,
				strict: false,
			}) as InstanceType<typeof RuleClass> & { id: string; type: string; label: string };

			rule.id = ruleId;
			rule.type = 'test';
			rule.label = 'Test Rule';
			// The mock DataModel constructor does not hydrate schema fields from the
			// source, so copy them on for the data-aware phase resolver to read.
			Object.assign(rule, source);

			Object.defineProperty(rule, 'parent', { get: () => item, configurable: true });
			Object.defineProperty(rule, '_predicate', {
				get: () => new Predicate(predicate as never),
				configurable: true,
			});
			return rule as unknown as { _warnOnLatePredicateKeys(): void };
		}

		it('warns once for an early-phase rule predicated on a late key', () => {
			const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
			const rule = createRuleForWarning(AbilityBonusRule, { strength: { min: 2 } }, 'warn-1');

			rule._warnOnLatePredicateKeys();
			rule._warnOnLatePredicateKeys();

			expect(warnSpy).toHaveBeenCalledTimes(1);
			expect(warnSpy.mock.calls[0][0]).toContain('strength');
		});

		it('dedupes across re-instantiations of the same rule content', () => {
			const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
			// Same item uuid + predicate, fresh instances — simulates re-preparation
			createRuleForWarning(
				AbilityBonusRule,
				{ strength: { min: 2 } },
				'warn-dedupe',
			)._warnOnLatePredicateKeys();
			createRuleForWarning(
				AbilityBonusRule,
				{ strength: { min: 2 } },
				'warn-dedupe',
			)._warnOnLatePredicateKeys();

			expect(warnSpy).toHaveBeenCalledTimes(1);
		});

		it('does not warn for an after-phase rule with the same predicate', () => {
			const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
			const rule = createRuleForWarning(DamageBonusRule, { strength: { min: 2 } }, 'warn-2');

			rule._warnOnLatePredicateKeys();

			expect(warnSpy).not.toHaveBeenCalled();
		});

		it('does not warn for an early-phase rule predicated on early keys', () => {
			const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
			const rule = createRuleForWarning(AbilityBonusRule, { self: 'fullHp' }, 'warn-3');

			rule._warnOnLatePredicateKeys();

			expect(warnSpy).not.toHaveBeenCalled();
		});

		it('warns for a numeric speedBonus predicated on a late key', () => {
			const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
			const rule = createRuleForWarning(
				SpeedBonusRule,
				{ strength: { min: 2 } },
				'warn-speed-numeric',
				{ value: '2' },
			);

			rule._warnOnLatePredicateKeys();

			expect(warnSpy).toHaveBeenCalledTimes(1);
		});

		it('does not warn for a formula speedBonus predicated on a late key (applies after prep)', () => {
			const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
			const rule = createRuleForWarning(
				SpeedBonusRule,
				{ strength: { min: 2 } },
				'warn-speed-formula',
				{ value: '@abilities.dexterity.mod' },
			);

			rule._warnOnLatePredicateKeys();

			expect(warnSpy).not.toHaveBeenCalled();
		});
	});

	describe('schema', () => {
		it('defines the expected base fields inherited by every rule', () => {
			const schema = NimbleBaseRule.defineSchema();

			expect(schema).toHaveProperty('disabled');
			expect(schema).toHaveProperty('id');
			expect(schema).toHaveProperty('identifier');
			expect(schema).toHaveProperty('label');
			expect(schema).toHaveProperty('predicate');
			expect(schema).toHaveProperty('priority');
			expect(schema).toHaveProperty('suppressActivationCard');
		});

		it('defaults suppressActivationCard to auto with the expected choices', () => {
			const schema = NimbleBaseRule.defineSchema();
			const field = schema.suppressActivationCard as unknown as {
				initial: unknown;
				choices: string[];
			};

			expect(field.initial).toBe('auto');
			expect(field.choices).toEqual(['auto', 'always', 'never']);
		});
	});

	describe('suppressesActivationCard resolution', () => {
		class AutoFalseRule extends NimbleBaseRule {}

		class AutoTrueRule extends NimbleBaseRule {
			protected override _autoSuppressesActivationCard(): boolean {
				return true;
			}
		}

		function createRule(
			RuleClass: typeof AutoFalseRule | typeof AutoTrueRule,
			suppressActivationCard: string,
		) {
			const rule = new (RuleClass as any)(
				{ type: 'test', label: '', identifier: '', predicate: {} },
				{ strict: false },
			);
			(rule as any).suppressActivationCard = suppressActivationCard;
			return rule as NimbleBaseRule;
		}

		it('resolves `always` to true even when the auto branch is false', () => {
			expect(createRule(AutoFalseRule, 'always').suppressesActivationCard()).toBe(true);
		});

		it('resolves `never` to false even when the auto branch is true', () => {
			expect(createRule(AutoTrueRule, 'never').suppressesActivationCard()).toBe(false);
		});

		it('resolves `auto` to the rule class behavior', () => {
			expect(createRule(AutoFalseRule, 'auto').suppressesActivationCard()).toBe(false);
			expect(createRule(AutoTrueRule, 'auto').suppressesActivationCard()).toBe(true);
		});

		it('gates only the `auto` branch on automation being enabled', () => {
			const context = { automationEnabled: false };

			expect(createRule(AutoTrueRule, 'auto').suppressesActivationCard(context)).toBe(false);
			expect(createRule(AutoFalseRule, 'always').suppressesActivationCard(context)).toBe(true);
		});
	});

	describe('class-level metadata', () => {
		it('defaults `group` to "unsorted" so the picker can flag unconfigured rules', () => {
			expect(NimbleBaseRule.group).toBe('unsorted');
		});

		it('defaults `description` to "" so the picker can flag missing copy', () => {
			expect(NimbleBaseRule.description).toBe('');
		});
	});
});
