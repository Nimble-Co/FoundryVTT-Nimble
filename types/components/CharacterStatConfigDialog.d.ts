export interface StatArrayOption {
	key: string;
	array: number[];
	name: string;
}

export interface StatIncreaseEntry {
	level: number;
	type: 'statIncrease' | 'boon';
	statIncreaseType: string | null;
	selectedAbilities?: string[];
	value?: unknown;
	label: string;
}

import type { StatConfigDocument } from '#view/dialogs/CharacterStatConfigDialogState.svelte.ts';

export interface CharacterStatConfigDialogProps {
	document: StatConfigDocument;
}
