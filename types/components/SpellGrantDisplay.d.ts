import type { SpellIndex, SpellIndexEntry } from '#utils/getSpells.js';
import type {
	SchoolSelectionGroup,
	SpellGrantResult,
	SpellGrantSource,
	SpellSelectionGroup,
} from '../../src/view/dialogs/characterCreation/types.js';

export interface SpellGrantDisplayProps {
	active: boolean;
	spellGrants: SpellGrantResult | null;
	spellIndex: SpellIndex | null;
	selectedSchools: Map<string, string[]>;
	selectedSpells: Map<string, string[]>;
	/** Filter grants to only show from this source. If not provided, shows all. */
	sourceFilter?: SpellGrantSource;
	/** Custom header text. If not provided, uses default localization. */
	header?: string;
	/** Custom section ID for scroll targeting. If not provided, uses default. */
	sectionId?: string;
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
