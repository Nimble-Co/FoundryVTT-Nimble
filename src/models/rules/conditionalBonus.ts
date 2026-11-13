import type { DamageNode, EffectNode } from '#types/effectTree.js';
import { identifierOf } from '#utils/documents/itemIdentifier.js';
import { flattenEffectsTree } from '#utils/treeManipulation/flattenEffectsTree.js';
import { PredicateField } from '../fields/PredicateField.js';
import { withWidget } from './_widgetOption.js';
import { NimbleBaseRule } from './base.js';

type ConditionalBonusDelivery = 'melee' | 'ranged' | 'any';
type ConditionalBonusSource = 'weapon' | 'spell' | 'any';

/**
 * Matches dice notation: 1d6, 2d8, 3d20+5. A deliberate local copy of the identical
 * pattern in damageBonus.ts — two call sites is below the Rule-of-Three threshold, so
 * it is not yet extracted to a shared helper.
 */
const DICE_PATTERN = /(?<![a-zA-Z])d\d+/i;

interface ResolvedConditionalDamage {
	/** Resolved numeric value (null when dice-based or no damage offered). */
	value: number | null;
	/** Raw dice formula (null when numeric or no damage offered). */
	formula: string | null;
	/** The damage type of the item whose damage this is. */
	damageType?: string;
	/** The identifier of the item whose damage this is. */
	fromItemIdentifier?: string;
}

interface ItemWithDamage {
	identifier?: string;
	system?: { identifier?: string; activation?: { effects?: EffectNode[] } };
}

const DAMAGE_OF_ITEM_SET = (data: Record<string, unknown>) =>
	String(data.damageOfItem ?? '').trim() !== '';
const NO_DAMAGE_OF_ITEM = (data: Record<string, unknown>) => !DAMAGE_OF_ITEM_SET(data);

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
				showWhen: NO_DAMAGE_OF_ITEM,
			}),
		),
		damageType: new fields.StringField(
			withWidget({
				required: true,
				nullable: false,
				blank: true,
				initial: '',
				label: 'NIMBLE.rules.conditionalBonus.damageType.label',
				hint: 'NIMBLE.rules.conditionalBonus.damageType.hint',
				choices: () => CONFIG.NIMBLE.damageTypes,
				showWhen: NO_DAMAGE_OF_ITEM,
			}),
		),
		damageOfItem: new fields.StringField({
			required: true,
			nullable: false,
			blank: true,
			initial: '',
			label: 'NIMBLE.rules.conditionalBonus.damageOfItem.label',
			hint: 'NIMBLE.rules.conditionalBonus.damageOfItem.hint',
		}),
		startsChosen: new fields.BooleanField({
			required: true,
			nullable: false,
			initial: true,
			label: 'NIMBLE.rules.conditionalBonus.startsChosen.label',
			hint: 'NIMBLE.rules.conditionalBonus.startsChosen.hint',
		}),
		doubleFor: new fields.ArrayField(
			new fields.SchemaField({
				source: new fields.StringField({
					required: true,
					nullable: false,
					initial: '',
					label: 'NIMBLE.rules.conditionalBonus.doubleFor.source.label',
					hint: 'NIMBLE.rules.conditionalBonus.doubleFor.source.hint',
				}),
				onlyNoArmor: new fields.BooleanField({
					required: true,
					nullable: false,
					initial: false,
					label: 'NIMBLE.rules.conditionalBonus.doubleFor.onlyNoArmor.label',
					hint: 'NIMBLE.rules.conditionalBonus.doubleFor.onlyNoArmor.hint',
				}),
			}),
			{
				required: true,
				nullable: false,
				initial: [],
				label: 'NIMBLE.rules.conditionalBonus.doubleFor.label',
				hint: 'NIMBLE.rules.conditionalBonus.doubleFor.hint',
			},
		),
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
		targetCondition: new PredicateField({
			label: 'NIMBLE.rules.conditionalBonus.targetCondition.label',
			hint: 'NIMBLE.rules.conditionalBonus.targetCondition.hint',
		}),
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
	declare doubleFor: { source: string; onlyNoArmor: boolean }[];
	declare damageBonus: string;
	declare damageOfItem: string;
	declare startsChosen: boolean;
	// `damageType` is inferred from the schema's `choices` (damage-type keys plus the
	// blank sentinel); re-declaring it as the wider `string` clashes with that type.
	declare delivery: ConditionalBonusDelivery;
	declare source: ConditionalBonusSource;

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
				['damageOfItem', 'string'],
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
		if (this.#itemIdentifier()) return this.#itemDamage() !== null;
		const trimmed = this.damageBonus.trim();
		return trimmed !== '' && trimmed !== '0';
	}

	#itemIdentifier(): string {
		return this.damageOfItem?.trim() ?? '';
	}

	/** The first damage step of the named item on the actor, read now. */
	#itemDamage(): DamageNode | null {
		const identifier = this.#itemIdentifier();
		const items = (this.actor as { items?: Iterable<ItemWithDamage> } | null)?.items ?? [];
		const item = [...items].find((each) => identifierOf(each) === identifier);
		const node = flattenEffectsTree(item?.system?.activation?.effects ?? []).find(
			(each): each is DamageNode => each.type === 'damage' && !!each.formula?.trim(),
		);
		return node ?? null;
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
		const targetCondition = this.targetCondition;
		if (!targetCondition || targetCondition.size === 0) return true;
		if (!targetDomain) return false;
		return targetCondition.test(targetDomain);
	}

	/** Resolves the offered damage to a number (numeric formula) or raw dice formula. */
	resolveDamage(): ResolvedConditionalDamage {
		if (!this.offersDamage()) return { value: null, formula: null };
		const itemDamage = this.#itemIdentifier() ? this.#itemDamage() : null;
		const formula = itemDamage?.formula ?? this.damageBonus;
		const fromItem = itemDamage
			? { damageType: itemDamage.damageType, fromItemIdentifier: this.#itemIdentifier() }
			: {};
		if (DICE_PATTERN.test(formula)) {
			this.checkReferences(formula);
			if (!itemDamage) return { value: null, formula, ...fromItem };
			// The roll window shows the item's damage with the attacker's numbers, as it rolls.
			const rollData = this.actor?.getRollData?.() ?? {};
			const shown = Roll.replaceFormulaData(formula, rollData, { missing: '0' });
			return { value: null, formula: shown, ...fromItem };
		}
		const resolved = this.resolveFormula(formula);
		return { value: resolved ?? 0, formula: null, ...fromItem };
	}
}

export {
	ConditionalBonusRule,
	type ConditionalBonusDelivery,
	type ConditionalBonusSource,
	type ResolvedConditionalDamage,
};
