import type { ApplyEffectNode, EffectNode } from '#types/effectTree.js';
import localize from '#utils/localize.js';
import { NIMBLE_EFFECT_TYPE } from '../../models/activeEffect/nimbleEffectChoices.js';

export interface ItemEffectSource {
	_id: string;
	name: string;
	img: string;
	type: typeof NIMBLE_EFFECT_TYPE;
	transfer: false;
	statuses: string[];
}

interface ConditionLikeNode {
	id: string;
	type: string;
	condition?: string | null;
	effectId?: string | null;
	parentContext: string | null;
	parentNode: string | null;
	on?: Record<string, EffectNode[] | Record<string, EffectNode[]> | undefined>;
	sharedRolls?: EffectNode[];
}

/** The name and image of a condition, as the token status menu has them. */
export function statusOf(condition: string): { name: string; img: string } {
	const entry = (
		(CONFIG.statusEffects ?? []) as unknown as { id: string; name?: string; img?: string }[]
	).find((status) => status.id === condition);
	const names = (CONFIG.NIMBLE?.conditions ?? {}) as Record<string, string>;
	return {
		name: names[condition] ?? (entry?.name ? localize(entry.name) : condition),
		img: entry?.img ?? 'icons/svg/aura.svg',
	};
}

/**
 * Each condition node, and each Apply Effect node that names only a condition, becomes an Apply
 * Effect node with an effect on the item (statuses only, one effect for each condition). The tree
 * is changed in place; the effects to create on the item come back.
 */
export function conditionsToItemEffects(
	tree: EffectNode[],
	makeId: () => string = () => foundry.utils.randomID(),
	existing: Iterable<ItemEffectSource> = [],
): ItemEffectSource[] {
	const byCondition = new Map<string, ItemEffectSource>();
	for (const effect of existing) {
		if (effect.statuses.length === 1) byCondition.set(effect.statuses[0], effect);
	}
	const created: ItemEffectSource[] = [];

	const effectFor = (condition: string): ItemEffectSource => {
		const known = byCondition.get(condition);
		if (known) return known;
		const effect: ItemEffectSource = {
			_id: makeId(),
			...statusOf(condition),
			type: NIMBLE_EFFECT_TYPE,
			transfer: false,
			statuses: [condition],
		};
		byCondition.set(condition, effect);
		created.push(effect);
		return effect;
	};

	const visit = (nodes: unknown): void => {
		if (!Array.isArray(nodes)) return;
		for (const [index, value] of nodes.entries()) {
			const node = value as ConditionLikeNode;
			const shorthand = node.type === 'applyEffect' && !node.effectId && node.condition;
			if ((node.type === 'condition' || shorthand) && node.condition) {
				const replacement: ApplyEffectNode = {
					id: node.id,
					type: 'applyEffect',
					effectId: effectFor(node.condition)._id,
					recipient: 'targets',
					tempHealingNodeId: null,
					parentContext: node.parentContext ?? null,
					parentNode: node.parentNode ?? null,
				};
				nodes[index] = replacement;
				continue;
			}
			visit(node.sharedRolls);
			for (const branch of Object.values(node.on ?? {})) {
				if (Array.isArray(branch)) visit(branch);
				else for (const nested of Object.values(branch ?? {})) visit(nested);
			}
		}
	};
	visit(tree);
	return created;
}
