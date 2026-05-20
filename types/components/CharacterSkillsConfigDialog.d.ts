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

export interface CharacterSkillsConfigDialogProps {
	document: unknown;
}
