import shouldListCondition from '#utils/shouldListCondition.js';
import { statusOf } from '#utils/treeManipulation/conditionsToItemEffects.js';
import { SET_BY_THE_SYSTEM } from '#view/actorSheets/shared/effectsTab.ts';

/**
 * The conditions an effect can put on a creature, A to Z.
 * Not the states the system sets, and not a monster condition this effect does not already give.
 */
export function effectConditionOptions(
	activeConditionIds: ReadonlySet<string> = new Set(),
): TagGroupOption[] {
	return Object.keys((CONFIG.NIMBLE?.conditions ?? {}) as Record<string, string>)
		.filter((id) => !SET_BY_THE_SYSTEM.has(id) && shouldListCondition(id, activeConditionIds))
		.map((id) => {
			const { name, img } = statusOf(id);
			return { value: id, label: name, icon: img };
		})
		.sort((a, b) => a.label.localeCompare(b.label));
}

/** The statuses with `id` added, or taken away when it is there. */
export function toggledStatus(statuses: Iterable<string>, id: string): string[] {
	const next = new Set(statuses);
	if (next.has(id)) next.delete(id);
	else next.add(id);
	return [...next];
}
