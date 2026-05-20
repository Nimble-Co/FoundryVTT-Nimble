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

export interface CharacterStatConfigDialogProps {
	document: unknown;
}
