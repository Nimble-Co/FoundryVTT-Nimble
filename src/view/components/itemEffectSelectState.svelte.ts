import type { ItemEffectSelectItem } from '#types/components/ItemEffectSelect.d.ts';
import { deleteLeftItemEffect } from '#utils/treeManipulation/deleteLeftItemEffect.js';
import { activationTreeOf, itemEffectList } from '#utils/treeManipulation/itemEffectUsers.js';
import { NIMBLE_EFFECT_TYPE } from '../../models/activeEffect/nimbleEffectChoices.js';
import { watchItemEffects } from '../dataPreparationHelpers/watchItemEffects.js';

/** The select value of the "New effect" choice. */
export const NEW_EFFECT = '__new';

export interface ItemEffectOption {
	id: string;
	name: string;
}

interface SelectEffect {
	id: string | null;
	name?: string | null;
	transfer?: boolean;
	system?: unknown;
	sheet?: { render(force: boolean): unknown } | null;
}

/** The effects a card or a rule can give: the ones of the item with `transfer` off, by name. */
export function createItemEffectSelectState(
	getItem: () => ItemEffectSelectItem | null,
	getValue: () => string | null,
) {
	const subscribe = watchItemEffects(getItem);

	const effects = $derived.by((): SelectEffect[] => {
		subscribe();
		return itemEffectList<SelectEffect>(getItem());
	});

	const options = $derived(
		effects
			.filter((effect) => effect.transfer === false && effect.id)
			.map((effect) => ({ id: effect.id as string, name: effect.name ?? '' }))
			.sort((a, b) => a.name.localeCompare(b.name)),
	);

	const picked = $derived(effects.find((effect) => effect.id && effect.id === getValue()) ?? null);

	const isMissing = $derived.by(() => {
		const value = getValue();
		return !!value && !options.some((option) => option.id === value);
	});

	let busy = false;

	/** Stores the pick (a new effect for NEW_EFFECT), then deletes the effect it left if unused. */
	async function choose(value: string, onchange: (effectId: string | null) => unknown) {
		const item = getItem();
		if (!item || busy) return;
		busy = true;
		try {
			const left = getValue() || null;
			let chosen: string | null = value || null;
			if (value === NEW_EFFECT) {
				const [created] =
					((await item.createEmbeddedDocuments('ActiveEffect', [
						{ name: item.name, img: item.img, type: NIMBLE_EFFECT_TYPE, transfer: false },
					])) as { id: string }[] | undefined) ?? [];
				if (!created) return;
				chosen = created.id;
			}
			if (chosen === left) return;
			await onchange(chosen);
			await deleteLeftItemEffect(item as never, activationTreeOf(item), left);
		} finally {
			busy = false;
		}
	}

	function openPicked() {
		picked?.sheet?.render(true);
	}

	return {
		get options() {
			return options;
		},
		get picked() {
			return picked;
		},
		get isMissing() {
			return isMissing;
		},
		choose,
		openPicked,
	};
}
