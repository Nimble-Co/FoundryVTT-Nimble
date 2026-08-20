import type { EffectNode } from '#types/effectTree.js';
import { flattenEffectsTree } from '#utils/treeManipulation/flattenEffectsTree.js';
import { reconstructEffectsTree } from '#utils/treeManipulation/reconstructEffectsTree.js';
import type {
	ConditionEffectUsage,
	ConditionItemUsage,
	ConditionUsage,
} from './findConditionUsage.js';

interface UpdatableItem {
	name?: string;
	system?: { rules?: Record<string, unknown>[]; activation?: { effects?: EffectNode[] } };
	update?: (data: Record<string, unknown>) => Promise<unknown>;
}

/**
 * How each reference type is retired. A rule whose whole purpose is the condition goes; one that
 * merely lists it keeps its other entries; `markTarget` keeps its flag behaviour with the status
 * cleared, which is the field's own blank default.
 */
function rewriteRules(
	rules: Record<string, unknown>[],
	usage: ConditionItemUsage,
	conditionId: string,
): Record<string, unknown>[] {
	const dropped = new Set(usage.ruleIds);
	const immunities = new Set(usage.immunityRuleIds);
	const markTargets = new Set(usage.markTargetRuleIds);

	return rules.reduce<Record<string, unknown>[]>((kept, rule) => {
		const id = rule.id as string;
		if (dropped.has(id)) return kept;

		if (immunities.has(id)) {
			const conditions = (rule.conditions as string[]).filter((entry) => entry !== conditionId);
			// An immunity rule with nothing left to be immune to has no behaviour worth keeping.
			if (conditions.length === 0) return kept;

			kept.push({ ...rule, conditions });
			return kept;
		}

		if (markTargets.has(id)) {
			kept.push({ ...rule, statusCondition: '' });
			return kept;
		}

		kept.push(rule);
		return kept;
	}, []);
}

async function stripFromItem(usage: ConditionItemUsage, conditionId: string): Promise<void> {
	const item = usage.item as UpdatableItem;
	const update: Record<string, unknown> = {};

	if (usage.ruleIds.length || usage.immunityRuleIds.length || usage.markTargetRuleIds.length) {
		const rules = Array.isArray(item.system?.rules) ? item.system.rules : [];
		update['system.rules'] = rewriteRules(rules, usage, conditionId);
	}

	if (usage.nodeIds.length) {
		const nodeIds = new Set(usage.nodeIds);
		const flattened = flattenEffectsTree(item.system?.activation?.effects ?? []);
		// Condition nodes are leaves, so dropping them cannot orphan a child.
		update['system.activation.effects'] = reconstructEffectsTree(
			flattened.filter((node) => !nodeIds.has(node.id)),
		);
	}

	if (Object.keys(update).length === 0) return;

	await item.update?.(update);
}

/** Effects grouped by the document that can delete them, since an item-granted effect lives there. */
function groupEffectsByParent(
	usage: ConditionUsage,
): Map<ConditionEffectUsage['parent'], Set<string>> {
	const byParent = new Map<ConditionEffectUsage['parent'], Set<string>>();

	for (const actor of usage.actors) {
		for (const effect of actor.effects) {
			const existing = byParent.get(effect.parent);
			if (existing) existing.add(effect.effectId);
			else byParent.set(effect.parent, new Set([effect.effectId]));
		}
	}

	return byParent;
}

/**
 * Delete the effects carrying the condition and strip it from every item that named it. Each
 * document is updated independently and a failure is logged rather than thrown, so one locked or
 * permission-denied document cannot abandon the rest half-cleaned.
 */
export default async function removeConditionReferences(
	usage: ConditionUsage,
	conditionId: string,
): Promise<void> {
	for (const [parent, effectIds] of groupEffectsByParent(usage)) {
		try {
			await parent.deleteEmbeddedDocuments?.('ActiveEffect', [...effectIds]);
		} catch (error) {
			console.error(`Nimble | Failed to clear ${conditionId} from ${parent.uuid}:`, error);
		}
	}

	for (const item of usage.items) {
		try {
			await stripFromItem(item, conditionId);
		} catch (error) {
			console.error(`Nimble | Failed to remove ${conditionId} from ${item.uuid}:`, error);
		}
	}
}
