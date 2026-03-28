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
	/** Whether this spell is currently selected (for selectable mode) */
	isSelected?: boolean;
	/** Whether this spell is disabled (can't be selected) */
	isDisabled?: boolean;
	/** Callback when spell is selected/deselected */
	onSelect?: () => void;
}
