export interface SkillHistoryChange {
	skillKey: string;
	change: number;
	total: number;
	name: string;
}

export interface SkillHistoryEntry {
	level: number;
	changes: SkillHistoryChange[];
}

import type { SkillsDocument } from '#view/dialogs/CharacterSkillsConfigDialogState.svelte.ts';

export interface CharacterSkillsConfigDialogProps {
	document: SkillsDocument;
}
