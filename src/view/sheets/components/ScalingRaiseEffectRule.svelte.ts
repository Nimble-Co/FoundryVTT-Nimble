import { createSubscriber } from 'svelte/reactivity';
import type { RaiseField } from '#types/components/ScalingRaiseEffectRule.d.ts';
import type { EffectNode } from '#types/effectTree.js';
import type { ScalingDelta } from '#types/spellScaling.js';
import { effectRuleNumbers } from '#utils/spell/effectRuleNumbers.js';

interface ScalingItem {
	id: string | null;
	reactive: { system: { activation?: { effects?: EffectNode[] } } };
	effects?: { get(id: string): { name?: string; system?: unknown } | undefined } | null;
}

const EFFECT_HOOKS = ['createActiveEffect', 'updateActiveEffect', 'deleteActiveEffect'];

/**
 * The Apply Effect nodes of the item, with the rules of their effects and the number fields of
 * those rules. Reads the item's effects again when one of them is made, changed or deleted.
 */
export function createRaiseTargets(getItem: () => ScalingItem) {
	const subscribeToEffects = createSubscriber((update) => {
		const ids = EFFECT_HOOKS.map((hook) => {
			const id = Hooks.on(
				hook as never,
				((effect: { parent?: { id?: string | null } }) => {
					if (effect.parent?.id === getItem().id) update();
				}) as never,
			);
			return [hook, id] as const;
		});
		return () => {
			for (const [hook, id] of ids) Hooks.off(hook as never, id);
		};
	});

	function reactiveEffects(item: ScalingItem) {
		subscribeToEffects();
		return item.effects;
	}

	const targets = $derived.by(() => {
		const item = getItem();
		return effectRuleNumbers({ system: item.reactive.system, effects: reactiveEffects(item) });
	});

	return {
		get targets() {
			return targets;
		},
	};
}

/** Sets a field of a raise; a new effect or rule leaves the picks below it empty. */
export function reshapeRaise(delta: ScalingDelta, field: RaiseField, value: unknown) {
	(delta as unknown as Record<RaiseField, unknown>)[field] = value;
	if (field === 'targetEffectId') delta.ruleId = null;
	if (field === 'targetEffectId' || field === 'ruleId') delta.ruleField = null;
}
