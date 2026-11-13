import type { EffectNode } from '#types/effectTree.js';
import localize from '#utils/localize.js';
import { flattenEffectsTree } from '#utils/treeManipulation/flattenEffectsTree.js';
import type { NimbleBaseRule } from '../../models/rules/base.js';

export interface EffectRuleNumberField {
	name: string;
	label: string;
	/** A formula field gets a formula added for each step, a number field a number. */
	kind: 'number' | 'formula';
}

export interface EffectRuleNumbers {
	id: string;
	label: string;
	fields: EffectRuleNumberField[];
}

export interface ApplyEffectRuleNumbers {
	nodeId: string;
	label: string;
	rules: EffectRuleNumbers[];
}

interface ItemWithEffects {
	system?: { activation?: { effects?: EffectNode[] } };
	effects?: { get(id: string): { name?: string; system?: unknown } | undefined } | null;
}

type RuleClass = Pick<typeof NimbleBaseRule, 'raisedFieldLabel'> & {
	defineSchema(): Record<string, unknown>;
};

/** Not a number of the rule's effect: it orders the rules. */
const NOT_RAISED = new Set(['priority']);

type FieldOptions = {
	label?: string;
	widget?: string | ((data: Record<string, unknown>) => string);
	showWhen?: (data: Record<string, unknown>) => boolean;
};

const FORMULA_WIDGETS = new Set(['formula', 'diceFormula']);

function isFormulaField(field: unknown, rule: Record<string, unknown>): boolean {
	if (!(field instanceof foundry.data.fields.StringField)) return false;
	const options = (field as unknown as { options?: FieldOptions }).options;
	const widget = typeof options?.widget === 'function' ? options.widget(rule) : options?.widget;
	if (!widget || !FORMULA_WIDGETS.has(widget)) return false;
	return typeof options?.showWhen === 'function' ? options.showWhen(rule) : true;
}

function numberFields(type: string, rule: Record<string, unknown>): EffectRuleNumberField[] {
	const RuleClass = (CONFIG.NIMBLE.ruleDataModels as Record<string, RuleClass | undefined>)[type];
	if (!RuleClass) return [];
	const { NumberField } = foundry.data.fields;
	return Object.entries(RuleClass.defineSchema()).flatMap(([name, field]) => {
		if (NOT_RAISED.has(name)) return [];
		const kind =
			field instanceof NumberField ? 'number' : isFormulaField(field, rule) ? 'formula' : null;
		if (!kind) return [];
		const raised = RuleClass.raisedFieldLabel(name, rule);
		if (raised) return [{ name, label: raised, kind }];
		const label = (field as { label?: string }).label;
		return [{ name, label: label ? localize(label) : name, kind }];
	});
}

/**
 * The Apply Effect nodes of an item's activation, each with the rules of its effect and the number
 * and formula fields of each rule, for an upcast step to raise.
 */
export function effectRuleNumbers(item: ItemWithEffects): ApplyEffectRuleNumbers[] {
	const ruleTypes = CONFIG.NIMBLE.ruleTypes as Record<string, string | undefined>;
	return flattenEffectsTree(item.system?.activation?.effects ?? []).flatMap((node) => {
		if (node.type !== 'applyEffect' || !node.effectId) return [];
		const effect = item.effects?.get(node.effectId);
		if (!effect) return [];
		const rules = ((effect.system as { rules?: Record<string, unknown>[] } | undefined)?.rules ??
			[]) as Array<Record<string, unknown> & { id?: string; type?: string; label?: string }>;
		return [
			{
				nodeId: node.id,
				label: effect.name ?? node.id,
				rules: rules
					.filter((rule) => rule.id && rule.type)
					.map((rule) => ({
						id: rule.id as string,
						label: rule.label || localize(ruleTypes[rule.type as string] ?? (rule.type as string)),
						fields: numberFields(rule.type as string, rule),
					})),
			},
		];
	});
}
