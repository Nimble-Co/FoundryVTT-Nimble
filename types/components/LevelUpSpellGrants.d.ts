import type { SpellIndex, SpellIndexEntry } from '#utils/getSpells.js';
import type { SchoolSelectionGroup } from '../../src/view/dialogs/characterCreation/types.js';

export interface LevelUpSpellGrantsProps {
	spells: SpellIndexEntry[];
	schoolSelections: SchoolSelectionGroup[];
	spellIndex: SpellIndex | null;
	selectedSchools: Map<string, string[]>;
	confirmedSchools: Set<string>;
	onSchoolsChange: (schools: Map<string, string[]>) => void;
	onConfirmedChange: (confirmed: Set<string>) => void;
}
