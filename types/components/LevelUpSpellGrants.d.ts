import type { SpellCostActorLike } from '#types/spellCost.d.ts';
import type { SpellIndex, SpellIndexEntry } from '#utils/getSpells.js';
import type {
	SchoolSelectionGroup,
	SpellSelectionGroup,
} from '../../src/view/dialogs/characterCreation/types.js';

export interface LevelUpSpellGrantsProps {
	spells: SpellIndexEntry[];
	/** Passed to each card so a spell's cost is the one this character pays. */
	actor: SpellCostActorLike;
	schoolSelections: SchoolSelectionGroup[];
	spellSelections: SpellSelectionGroup[];
	spellIndex: SpellIndex | null;
	selectedSchools: Map<string, string[]>;
	selectedSpells: Map<string, string[]>;
	confirmedSchools: Set<string>;
	onSchoolsChange: (schools: Map<string, string[]>) => void;
	onSpellsChange: (spells: Map<string, string[]>) => void;
	onConfirmedChange: (confirmed: Set<string>) => void;
}
