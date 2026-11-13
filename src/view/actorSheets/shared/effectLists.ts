import { byName } from './rowOrder.ts';
import type { ConditionLike, EffectLike, ItemLike } from './sheetSource.ts';

export interface EffectLists {
	/** timed or one-off effects, A to Z */
	active: EffectLike[];
	/** the conditions on the actor */
	conditions: ConditionLike[];
	/** effects that an item keeps on, A to Z */
	passive: EffectLike[];
}

/** A status of a condition puts the effect in the conditions, not in the effect lists. */
export function effectLists(
	effects: EffectLike[],
	conditions: ConditionLike[],
	conditionLabels: Record<string, string>,
): EffectLists {
	const conditionIds = new Set(Object.keys(conditionLabels));
	const plain = effects.filter(
		(effect) => !effect.statuses.some((status) => conditionIds.has(status)),
	);
	const active = plain.filter((effect) => effect.temporary);
	return {
		active: byName(active),
		conditions: conditions.filter((condition) => condition.active),
		passive: byName(plain.filter((effect) => !active.includes(effect))),
	};
}

/** The count on the Effects tab: what is on the actor now, not the passive effects. */
export function effectsOnCount(lists: EffectLists): number {
	return lists.active.length + lists.conditions.length;
}

/** The item that made the effect: its holder, or the item in its origin uuid. */
export function sourceItem(items: ItemLike[], effect: EffectLike): ItemLike | undefined {
	const id = effect.itemId ?? effect.origin?.match(/Item\.([^.]+)$/)?.[1];
	return id ? items.find((item) => item.id === id) : undefined;
}
