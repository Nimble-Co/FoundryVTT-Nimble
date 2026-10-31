import type { Snippet } from 'svelte';

export interface RollWindowProps {
	/** the head of the window: the name of the thing that you roll */
	title: string;
	img?: string;
	icon?: string;
	rollLabel: string;
	rollIcon?: string;
	onroll: () => void;
	/** closes the window; nothing is spent */
	oncancel: () => void;
	children: Snippet;
}

export interface RollModifierFieldsProps {
	situationalModifiers: string;
	primaryDieValue: number | undefined | null;
	primaryDieModifier: number | undefined | null;
}
