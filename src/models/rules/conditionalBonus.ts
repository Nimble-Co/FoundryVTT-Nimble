import type { Predicate } from '../../etc/Predicate.js';
import { PredicateField } from '../fields/PredicateField.js';
import { withWidget } from './_widgetOption.js';
import { NimbleBaseRule } from './base.js';

type ConditionalBonusDelivery = 'melee' | 'ranged' | 'any';
type ConditionalBonusSource = 'weapon' | 'spell' | 'any';

/** Matches dice notation: 1d6, 2d8, 3d20+5. Shared with damageBonus's detection. */
const DICE_PATTERN = /(?<![a-zA-Z])d\d+/i;

interface ResolvedConditionalDamage {
	/** Resolved numeric value (null when dice-based or no damage offered). */
	value: number | null;
	/** Raw dice formula (null when numeric or no damage offered). */
	formula: string | null;
}

function schema() {
	const { fields } = foundry.data;

	return {
		advantage: new fields.NumberField({
			required: true,
			nullable: false,
			integer: true,
			min: 0,
			initial: 1,
			label: 'NIMBLE.rules.conditionalBonus.advantage.label',
			hint: 'NIMBLE.rules.conditionalBonus.advantage.hint',
		}),
		damageBonus: new fields.StringField(
			withWidget({
				required: true,
				nullable: false,
				blank: true,
				initial: '@level',
				label: 'NIMBLE.rules.conditionalBonus.damageBonus.label',
				hint: 'NIMBLE.rules.conditionalBonus.damageBonus.hint',
				widget: 'formula',
			}),
		),
		damageType: new fields.StringField({
			required: true,
			nullable: false,
			blank: true,
			initial: '',
			label: 'NIMBLE.rules.conditionalBonus.damageType.label',
			hint: 'NIMBLE.rules.conditionalBonus.damageType.hint',
			choices: () => CONFIG.NIMBLE.damageTypes,
		}),
		delivery: new fields.StringField({
			required: true,
			nullable: false,
			initial: 'any',
			label: 'NIMBLE.rules.conditionalBonus.delivery.label',
			hint: 'NIMBLE.rules.conditionalBonus.delivery.hint',
			choices: ['melee', 'ranged', 'any'],
		}),
		source: new fields.StringField({
			required: true,
			nullable: false,
			initial: 'any',
			label: 'NIMBLE.rules.conditionalBonus.source.label',
			hint: 'NIMBLE.rules.conditionalBonus.source.hint',
			choices: ['weapon', 'spell', 'any'],
		}),
		// Cast: PredicateField extends ObjectField whose constructor typing doesn't
		// accept label/hint. The renderer reads them off the instance correctly.
		targetCondition: new PredicateField({
			label: 'NIMBLE.rules.conditionalBonus.targetCondition.label',
			hint: 'NIMBLE.rules.conditionalBonus.targetCondition.hint',
		} as unknown as never),
		type: new fields.StringField({ required: true, nullable: false, initial: 'conditionalBonus' }),
	};
}

declare namespace ConditionalBonusRule {
	type Schema = NimbleBaseRule.Schema & ReturnType<typeof schema>;
}

/**
 * Offers the wielder a per-attack *choice* of bonus when a target condition is met —
 * advantage, bonus damage, or (when both are configured) one or the other. Unlike
 * `damageBonus`, nothing is applied automatically: the activation dialog surfaces the
 * choice and folds the picked effect into the roll. This models effects like the
 * Hunter's quarry ("advantage OR +LVL damage, choose before each attack").
 *
 * Scoped by `delivery` (melee/ranged) and `source` (weapon/spell) like `damageBonus`,
 * and gated by `targetCondition` evaluated against the target's domain at activation.
 */
class ConditionalBonusRule extends NimbleBaseRule<ConditionalBonusRule.Schema> {
	static override group = 'bonuses';
	static override description = 'NIMBLE.rules.conditionalBonus.description';

	declare advantage: number;
	declare damageBonus: string;
	declare delivery: ConditionalBonusDelivery;
	declare source: ConditionalBonusSource;

	private get _targetCondition(): Predicate | undefined {
		return (this as object as { targetCondition?: Predicate }).targetCondition;
	}

	static override defineSchema(): ConditionalBonusRule.Schema {
		return {
			...NimbleBaseRule.defineSchema(),
			...schema(),
		};
	}

	override tooltipInfo(): string {
		return super.tooltipInfo(
			new Map([
				['advantage', 'number'],
				['damageBonus', 'string'],
				['damageType', 'string'],
				['delivery', 'string'],
				['source', 'string'],
				['targetCondition', 'object'],
			]),
		);
	}

	offersAdvantage(): boolean {
		return this.advantage > 0;
	}

	offersDamage(): boolean {
		const trimmed = this.damageBonus.trim();
		return trimmed !== '' && trimmed !== '0';
	}

	/** True when this bonus is relevant to an attack of the given delivery/source. */
	matchesAttack(
		delivery: ConditionalBonusDelivery | null,
		source: ConditionalBonusSource,
	): boolean {
		if (!delivery) return false;
		if (this.delivery !== 'any' && this.delivery !== delivery) return false;
		if (this.source !== 'any' && this.source !== source) return false;
		return true;
	}

	/** Evaluates the targetCondition predicate against a target domain. Empty = always. */
	matchesTarget(targetDomain: Set<string> | undefined): boolean {
		const tc = this._targetCondition;
		if (!tc || tc.size === 0) return true;
		if (!targetDomain) return false;
		return tc.test(targetDomain);
	}

	/** Resolves the offered damage to a number (numeric formula) or raw dice formula. */
	resolveDamage(): ResolvedConditionalDamage {
		if (!this.offersDamage()) return { value: null, formula: null };
		if (DICE_PATTERN.test(this.damageBonus)) {
			return { value: null, formula: this.damageBonus };
		}
		const resolved = this.resolveFormula(this.damageBonus);
		return { value: resolved ?? 0, formula: null };
	}
}

export {
	ConditionalBonusRule,
	type ConditionalBonusDelivery,
	type ConditionalBonusSource,
	type ResolvedConditionalDamage,
};
