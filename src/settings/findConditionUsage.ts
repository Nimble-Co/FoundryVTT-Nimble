import type { EffectNode } from '#types/effectTree.js';
import { flattenEffectsTree } from '#utils/treeManipulation/flattenEffectsTree.js';

/** An effect carrying the condition, and the document it has to be deleted from. */
export interface ConditionEffectUsage {
	effectId: string;
	/** The actor or item the effect is embedded in, which is what can delete it. */
	parent: { uuid?: string; deleteEmbeddedDocuments?: (type: string, ids: string[]) => unknown };
	parentName: string;
}

export interface ConditionActorUsage {
	uuid: string;
	name: string;
	img: string;
	effects: ConditionEffectUsage[];
}

/** The rules and activation-effect nodes on one item that name the condition. */
export interface ConditionItemUsage {
	uuid: string;
	name: string;
	img: string;
	/** The owning actor, or null for a world item. */
	ownerName: string | null;
	item: object;
	/** Localization keys naming what references it, for the dialog's summary line. */
	referenceLabels: string[];
	ruleIds: string[];
	immunityRuleIds: string[];
	markTargetRuleIds: string[];
	nodeIds: string[];
}

export interface ConditionUsage {
	actors: ConditionActorUsage[];
	items: ConditionItemUsage[];
	/** Total references, so the caller can skip the whole flow when nothing uses it. */
	total: number;
}

interface EffectLike {
	id?: string;
	statuses?: Set<string>;
	parent?: ConditionEffectUsage['parent'] & { name?: string };
}

interface ItemLike {
	uuid?: string;
	name?: string;
	img?: string;
	system?: {
		rules?: Record<string, unknown>[];
		activation?: { effects?: EffectNode[] };
	};
}

interface ActorLike {
	uuid?: string;
	name?: string;
	img?: string;
	effects?: Iterable<EffectLike>;
	allApplicableEffects?: () => Iterable<EffectLike>;
	items?: Iterable<ItemLike>;
}

/** Every actor a condition could be sitting on, including unlinked token actors. */
function collectActors(): Set<ActorLike> {
	const actors = new Set<ActorLike>();

	for (const actor of (game.actors ?? []) as Iterable<ActorLike>) actors.add(actor);

	for (const scene of (game.scenes ?? []) as Iterable<{
		tokens?: Iterable<{ actor?: ActorLike | null }>;
	}>) {
		for (const token of scene.tokens ?? []) {
			if (token.actor) actors.add(token.actor);
		}
	}

	return actors;
}

/**
 * `Actor#statuses` is built from active effects only, so a disabled effect or one granted by an
 * unequipped item would report the condition as unused. The effect collections are the truth.
 */
function collectEffects(actor: ActorLike): Iterable<EffectLike> {
	if (typeof actor.allApplicableEffects === 'function') return actor.allApplicableEffects();
	return actor.effects ?? [];
}

/** The rule type's own display label, so the dialog names rules the way the Rules Builder does. */
function ruleTypeLabel(type: string): string {
	const ruleTypes = CONFIG.NIMBLE.ruleTypes as Record<string, string> | undefined;
	return ruleTypes?.[type] ?? type;
}

function findItemReferences(item: ItemLike, conditionId: string): ConditionItemUsage | null {
	const rules = Array.isArray(item.system?.rules) ? item.system.rules : [];
	const usage: ConditionItemUsage = {
		uuid: item.uuid ?? '',
		name: item.name ?? '',
		img: item.img ?? '',
		ownerName: null,
		item,
		referenceLabels: [],
		ruleIds: [],
		immunityRuleIds: [],
		markTargetRuleIds: [],
		nodeIds: [],
	};

	for (const rule of rules) {
		const id = typeof rule.id === 'string' ? rule.id : null;
		if (!id) continue;

		if (rule.type === 'applyCondition' && rule.condition === conditionId) {
			usage.ruleIds.push(id);
			usage.referenceLabels.push(ruleTypeLabel('applyCondition'));
		} else if (
			rule.type === 'conditionImmunity' &&
			Array.isArray(rule.conditions) &&
			rule.conditions.includes(conditionId)
		) {
			usage.immunityRuleIds.push(id);
			usage.referenceLabels.push(ruleTypeLabel('conditionImmunity'));
		} else if (rule.type === 'markTarget' && rule.statusCondition === conditionId) {
			usage.markTargetRuleIds.push(id);
			usage.referenceLabels.push(ruleTypeLabel('markTarget'));
		}
	}

	const effects = item.system?.activation?.effects;
	if (Array.isArray(effects) && effects.length > 0) {
		for (const node of flattenEffectsTree(effects)) {
			if (node.type !== 'condition' || node.condition !== conditionId) continue;

			usage.nodeIds.push(node.id);
			usage.referenceLabels.push('NIMBLE.activationEffects.condition');
		}
	}

	const referenced =
		usage.ruleIds.length +
		usage.immunityRuleIds.length +
		usage.markTargetRuleIds.length +
		usage.nodeIds.length;

	if (referenced === 0) return null;

	usage.referenceLabels = [...new Set(usage.referenceLabels)];
	return usage;
}

/**
 * Everything that would be orphaned by dropping a condition: the effects currently carrying it, and
 * the items whose rules or activation effects name it. Compendium items are not searched, since
 * packs can be locked or module-owned and are not the GM's to rewrite from this dialog.
 */
export default function findConditionUsage(conditionId: string): ConditionUsage {
	const actors: ConditionActorUsage[] = [];
	const items: ConditionItemUsage[] = [];
	const seenItemUuids = new Set<string>();

	for (const actor of collectActors()) {
		const effects: ConditionEffectUsage[] = [];

		for (const effect of collectEffects(actor)) {
			if (!effect.statuses?.has(conditionId) || !effect.id || !effect.parent) continue;

			effects.push({
				effectId: effect.id,
				parent: effect.parent,
				parentName: effect.parent.name ?? actor.name ?? '',
			});
		}

		if (effects.length > 0) {
			actors.push({
				uuid: actor.uuid ?? '',
				name: actor.name ?? '',
				img: actor.img ?? '',
				effects,
			});
		}

		for (const item of actor.items ?? []) {
			const usage = findItemReferences(item, conditionId);
			if (!usage) continue;

			usage.ownerName = actor.name ?? null;
			seenItemUuids.add(usage.uuid);
			items.push(usage);
		}
	}

	for (const item of (game.items ?? []) as Iterable<ItemLike>) {
		const usage = findItemReferences(item, conditionId);
		if (!usage || seenItemUuids.has(usage.uuid)) continue;

		items.push(usage);
	}

	const total = actors.length + items.length;
	return { actors, items, total };
}
