import type { EffectNode } from '#types/effectTree.js';
import localize from '#utils/localize.js';
import { flattenEffectsTree } from '#utils/treeManipulation/flattenEffectsTree.js';

export interface EffectRuleNumberField {
	name: string;
	label: string;
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

type RuleClass = {
	defineSchema(): Record<string, unknown>;
	/** The words for what a raise of the field adds, when the field label does not say it. */
	raisedFieldLabel?(field: string, rule: Record<string, unknown>): string | null;
};

/** Not a number of the rule's effect: it orders the rules. */
const NOT_RAISED = new Set(['priority']);

function numberFields(type: string, rule: Record<string, unknown>): EffectRuleNumberField[] {
	const RuleClass = (CONFIG.NIMBLE.ruleDataModels as Record<string, RuleClass | undefined>)[type];
	if (!RuleClass) return [];
	const { NumberField } = foundry.data.fields;
	return Object.entries(RuleClass.defineSchema())
		.filter(([name, field]) => field instanceof NumberField && !NOT_RAISED.has(name))
		.map(([name, field]) => {
			const raised = RuleClass.raisedFieldLabel?.(name, rule);
			if (raised) return { name, label: raised };
			const label = (field as { label?: string }).label;
			return { name, label: label ? localize(label) : name };
		});
}

/**
 * The Apply Effect nodes of an item's activation, each with the rules of its effect and the number
 * fields of each rule, for an upcast step to raise.
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
