import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Predicate } from '../../../etc/Predicate.js';
import { AbilityBonusRule } from '../abilityBonus.js';
import { ArmorClassRule } from '../armorClass.js';
import { NimbleBaseRule } from '../base.js';
import { DamageBonusRule } from '../damageBonus.js';
import { GrantMovementRule } from '../grantMovement.js';
import { SavingThrowRollModeRule } from '../savingThrowRollMode.js';
import { SkillRollModeRule } from '../skillRollMode.js';
import { SpeedBonusRule } from '../speedBonus.js';
import { ToggleEffectRule } from '../toggleEffect.js';

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
			Object.defineProperty(rule, 'predicate', {
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

	describe('unknown formula reference warning', () => {
		class FormulaRule extends NimbleBaseRule {
			resolve(formula: string) {
				return this.resolveFormula(formula);
			}
		}

		let rollData: Record<string, unknown>;

		function createRule(name: string, isOwner = true, withActor = true) {
			const actor = withActor ? { getRollData: () => rollData } : null;
			const item = { uuid: `Actor.a.Item.${name}`, name, isOwner, actor };
			const rule = new FormulaRule({} as never, {
				parent: item as unknown as foundry.abstract.DataModel.Any,
				strict: false,
			}) as FormulaRule & { type: string; label: string };
			rule.type = 'auraReach';
			rule.label = 'Aura';
			Object.defineProperty(rule, 'parent', { get: () => item, configurable: true });
			return rule;
		}

		const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

		beforeEach(() => {
			rollData = { auraReach: 2, abilities: { strength: { mod: 3 } } };
			vi.mocked(ui.notifications.warn).mockClear();
			vi.spyOn(console, 'warn').mockImplementation(() => {});
		});

		afterEach(() => {
			vi.restoreAllMocks();
		});

		it('warns the owner once about a reference the actor does not have', async () => {
			const rule = createRule('Typo Once');
			rule.resolve('@auraRech + 1');
			rule.resolve('@auraRech + 1');
			await flush();

			expect(ui.notifications.warn).toHaveBeenCalledTimes(1);
			const message = String(vi.mocked(ui.notifications.warn).mock.calls[0]?.[0]);
			expect(message).toContain('Typo Once');
			expect(message).toContain('@auraRech');
		});

		it('does not warn when every reference resolves, also with braces', async () => {
			const rule = createRule('All Known');
			rule.resolve('@auraReach + @{abilities.strength.mod}');
			await flush();

			expect(ui.notifications.warn).not.toHaveBeenCalled();
		});

		it('does not warn when the reference exists once data preparation ends', async () => {
			const rule = createRule('Late Key');
			delete rollData.auraReach;
			rule.resolve('@auraReach');
			rollData.auraReach = 2;
			await flush();

			expect(ui.notifications.warn).not.toHaveBeenCalled();
		});

		it('tells only a user who owns the item', async () => {
			const rule = createRule('Not Owner', false);
			rule.resolve('@auraRech');
			await flush();

			expect(ui.notifications.warn).not.toHaveBeenCalled();
			expect(console.warn).toHaveBeenCalledTimes(1);
		});

		it('warns once for the copies of one item on unlinked tokens', async () => {
			const first = createRule('Token Copy');
			const second = createRule('Token Copy');
			Object.assign(second.parent as object, { uuid: 'Scene.s.Token.t.Actor.a.Item.copy' });
			first.resolve('@auraRech');
			second.resolve('@auraRech');
			await flush();

			expect(ui.notifications.warn).toHaveBeenCalledTimes(1);
		});

		it('does not warn for an item with no actor', async () => {
			createRule('No Actor', true, false).resolve('@auraRech');
			await flush();

			expect(console.warn).not.toHaveBeenCalled();
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
