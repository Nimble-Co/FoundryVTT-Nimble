import type { RaiseField } from '#types/components/ScalingRaiseEffectRule.d.ts';
import type { EffectNode } from '#types/effectTree.js';
import type { ScalingDelta } from '#types/spellScaling.js';
import { effectRuleNumbers } from '#utils/spell/effectRuleNumbers.js';
import { watchItemEffects } from '../../dataPreparationHelpers/watchItemEffects.js';

export interface ScalingItem {
	id: string | null;
	uuid?: string | null;
	reactive: { system: { activation?: { effects?: EffectNode[] } } };
	effects?: { get(id: string): { name?: string; system?: unknown } | undefined } | null;
}

/**
 * The Apply Effect nodes of the item, with the rules of their effects and the fields of those rules
 * that a raise adds to. Reads the item's effects again when one of them is made, changed or deleted.
 */
export function createRaiseTargets(getItem: () => ScalingItem) {
	const subscribe = watchItemEffects(getItem);

	const targets = $derived.by(() => {
		const item = getItem();
		subscribe();
		return effectRuleNumbers({ system: item.reactive.system, effects: item.effects });
	});

	return {
		get targets() {
			return targets;
		},
	};
}

/** Sets a field of a raise; a new effect, rule or field leaves the picks below it empty. */
export function reshapeRaise(delta: ScalingDelta, field: RaiseField, value: unknown) {
	(delta as unknown as Record<RaiseField, unknown>)[field] = value;
	if (field === 'targetEffectId') delta.ruleId = null;
	if (field === 'targetEffectId' || field === 'ruleId') delta.ruleField = null;
	if (field === 'targetEffectId' || field === 'ruleId' || field === 'ruleField') {
		delta.formula = null;
	}
}
