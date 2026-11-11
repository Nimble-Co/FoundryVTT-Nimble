import { createSubscriber } from 'svelte/reactivity';

const EFFECT_HOOKS = ['createActiveEffect', 'updateActiveEffect', 'deleteActiveEffect'] as const;

interface WatchedItem {
	uuid?: string | null;
}

/**
 * A read of the item's effects inside `$derived` or a template runs again when an effect of that
 * item is made, changed or deleted. Call the returned function where the effects are read.
 */
export function watchItemEffects(getItem: () => WatchedItem | null | undefined): () => void {
	return createSubscriber((update) => {
		const ids = EFFECT_HOOKS.map((hook) => {
			const id = Hooks.on(hook, ((effect: { parent?: unknown }) => {
				const item = getItem();
				const parent = effect?.parent as WatchedItem | null | undefined;
				if (!item || !parent) return;
				if (parent === item || (!!item.uuid && parent.uuid === item.uuid)) update();
			}) as never);
			return [hook, id] as const;
		});
		return () => {
			for (const [hook, id] of ids) Hooks.off(hook, id);
		};
	});
}
