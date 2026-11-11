import { activationOf } from './itemFields.ts';
import { byName } from './rowOrder.ts';
import type { ConditionLike, EffectLike, Format, ItemLike, Localize } from './sheetSource.ts';

export interface EffectLists {
	/** toggle effects and timed or one-off effects, A to Z */
	active: EffectLike[];
	/** the conditions on the actor */
	conditions: ConditionLike[];
	/** effects that an item keeps on, A to Z */
	passive: EffectLike[];
}

interface Words {
	localize: Localize;
	format: Format;
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
	const active = plain.filter((effect) => effect.toggle || effect.temporary);
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

/** The item that made the effect: its holder, its toggle, or the item in its origin uuid. */
export function sourceItem(items: ItemLike[], effect: EffectLike): ItemLike | undefined {
	const id = effect.itemId ?? effect.toggle?.itemId ?? effect.origin?.match(/Item\.([^.]+)$/)?.[1];
	return id ? items.find((item) => item.id === id) : undefined;
}

/** "10 minutes" from `activation.duration`; nothing for no duration. */
function activationDuration(item: ItemLike, words: Words): string {
	const duration = (activationOf(item).duration ?? {}) as {
		type?: string;
		quantity?: number;
		details?: string;
	};
	if (!duration.type || duration.type === 'none') return '';
	if (duration.type === 'special') return duration.details ?? '';
	const quantity = duration.quantity ?? 1;
	const unit = words.localize(
		`NIMBLE.${quantity === 1 ? 'durations' : 'durationsPlural'}.${duration.type}`,
	);
	return `${quantity} ${unit}`;
}

/**
 * The duration text of an effect row. A toggle effect with its item: the activation duration of
 * the item, or the effect's own duration when the item has none. Any other effect: its own duration.
 */
export function effectDuration(
	effect: EffectLike,
	item: ItemLike | undefined,
	words: Words,
): string {
	if (!item || !effect.toggle) return effect.duration;
	return activationDuration(item, words) || effect.duration;
}
