import { createSubscriber } from 'svelte/reactivity';

const EFFECT_HOOKS = ['createActiveEffect', 'updateActiveEffect', 'deleteActiveEffect'] as const;

interface PickerEffect {
	id: string | null;
	name?: string | null;
	transfer?: boolean;
	parent?: { uuid?: string | null } | null;
}

interface PickerItem {
	uuid?: string | null;
	effects?: { values(): Iterable<PickerEffect> } | null;
}

export type ItemEffectOption = { id: string; name: string };

/** The item that holds the rule: the document itself, or the item of a rule-holding effect. */
function resolveItem(document: unknown): PickerItem | null {
	if (!document || typeof document !== 'object') return null;
	const doc = document as { documentName?: string; parent?: unknown };
	if (doc.documentName === 'Item') return doc as PickerItem;
	if (doc.documentName === 'ActiveEffect' && doc.parent && typeof doc.parent === 'object') {
		const parent = doc.parent as { documentName?: string };
		if (parent.documentName === 'Item') return parent as PickerItem;
	}
	return null;
}

export function createItemEffectPickerState(getDocument: () => unknown, getValue: () => string) {
	const subscribeToEffects = createSubscriber((update) => {
		const hooksApi = Hooks as unknown as {
			on: (hook: string, listener: (effect: PickerEffect) => void) => number;
			off: (hook: string, id: number) => void;
		};
		const ids = EFFECT_HOOKS.map((hook) => {
			const id = hooksApi.on(hook, (effect) => {
				const itemUuid = resolveItem(getDocument())?.uuid;
				if (itemUuid && effect?.parent?.uuid === itemUuid) update();
			});
			return [hook, id] as const;
		});
		return () => {
			for (const [hook, id] of ids) hooksApi.off(hook, id);
		};
	});

	const hasItem = $derived(resolveItem(getDocument()) !== null);

	const options = $derived.by((): ItemEffectOption[] => {
		subscribeToEffects();
		const item = resolveItem(getDocument());
		if (!item?.effects) return [];
		return [...item.effects.values()]
			.filter((effect) => effect.transfer === false && effect.id)
			.map((effect) => ({ id: effect.id as string, name: effect.name ?? '' }))
			.sort((a, b) => a.name.localeCompare(b.name));
	});

	const isMissing = $derived.by(() => {
		const value = getValue();
		return value.length > 0 && !options.some((option) => option.id === value);
	});

	return {
		get hasItem() {
			return hasItem;
		},
		get options() {
			return options;
		},
		get isMissing() {
			return isMissing;
		},
	};
}
