import { createSubscriber } from 'svelte/reactivity';
import type { EffectNode } from '#types/effectTree.js';
import { flattenEffectsTree } from '#utils/treeManipulation/flattenEffectsTree.js';

export interface ItemEffectOption {
	id: string;
	name: string;
}

interface ItemWithEffects {
	id: string | null;
	effects?: Iterable<{ id: string | null; name: string; transfer?: boolean }>;
}

const EFFECT_HOOKS = ['createActiveEffect', 'updateActiveEffect', 'deleteActiveEffect'];

/** The effects of the item that a card can apply: the ones that stay on the item. */
export function createItemEffectOptions(getItem: () => ItemWithEffects) {
	const subscribe = createSubscriber((update) => {
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
	return {
		get options(): ItemEffectOption[] {
			subscribe();
			return [...(getItem().effects ?? [])]
				.filter((effect) => effect.transfer === false && effect.id)
				.map((effect) => ({ id: effect.id as string, name: effect.name }));
		},
	};
}

/** Temp healing nodes of the same tree, for the temp HP that the effect gives and takes back. */
export function tempHealingOptions(tree: EffectNode[]): { id: string; formula: string }[] {
	return flattenEffectsTree(tree).flatMap((node) =>
		node.type === 'healing' && node.healingType === 'tempHealing'
			? [{ id: node.id, formula: node.formula }]
			: [],
	);
}
