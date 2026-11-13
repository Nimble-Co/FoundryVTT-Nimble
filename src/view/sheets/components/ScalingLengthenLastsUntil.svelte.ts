import type { LengthenField } from '#types/components/ScalingLengthenLastsUntil.d.ts';
import type { ScalingDelta } from '#types/spellScaling.js';
import { effectMomentNumbers } from '#utils/spell/effectMomentNumbers.js';
import { watchItemEffects } from '../../dataPreparationHelpers/watchItemEffects.js';
import type { ScalingItem } from './ScalingRaiseEffectRule.svelte.ts';

/**
 * The Apply Effect nodes of the item, with the moments of their Lasts Until that have a number.
 * Reads the item's effects again when one of them is made, changed or deleted.
 */
export function createLengthenTargets(getItem: () => ScalingItem) {
	const subscribe = watchItemEffects(getItem);

	const targets = $derived.by(() => {
		const item = getItem();
		subscribe();
		return effectMomentNumbers({ system: item.reactive.system, effects: item.effects });
	});

	return {
		get targets() {
			return targets;
		},
	};
}

/** Sets a field of a lengthen; a new effect leaves its moment empty. */
export function reshapeLengthen(delta: ScalingDelta, field: LengthenField, value: unknown) {
	(delta as unknown as Record<LengthenField, unknown>)[field] = value;
	if (field === 'targetEffectId') delta.momentIndex = null;
}
