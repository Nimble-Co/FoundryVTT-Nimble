import type { SpellIndex, SpellIndexEntry } from '#utils/getSpells.js';
import type {
	SchoolSelectionGroup,
	SpellGrantResult,
	SpellSelectionGroup,
} from '../../src/view/dialogs/characterCreation/types.js';

export interface SpellGrantDisplayProps {
	active: boolean;
	spellGrants: SpellGrantResult | null;
	spellIndex: SpellIndex | null;
	selectedSchools: Map<string, string[]>;
	selectedSpells: Map<string, string[]>;
}

export interface SchoolSelectionProps {
	group: SchoolSelectionGroup;
	spellIndex: SpellIndex;
	selected: string[];
	onSelect: (schools: string[]) => void;
}

export interface SpellSelectionProps {
	group: SpellSelectionGroup;
	selected: string[];
	onSelect: (spellUuids: string[]) => void;
}

export interface SpellCardProps {
	spell: SpellIndexEntry;
}
