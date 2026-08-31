import type GenericDialog from '#documents/dialogs/GenericDialog.svelte.js';
import type { NimbleFeatureItem } from '#documents/item/feature.js';
import type { MissingLevelSelection } from '#utils/findMissingLevelSelections.ts';

/**
 * A gap reported by the audit with its remaining pool candidates resolved to documents, so the
 * dialog can render them as feature cards.
 */
export interface ResolvedLevelSelectionGap extends Omit<MissingLevelSelection, 'candidateUuids'> {
	candidates: NimbleFeatureItem[];
}

export interface CharacterLevelCorrectionDialogProps {
	gaps: ResolvedLevelSelectionGap[];
	dialog: GenericDialog;
}

/** One pool's correction: the picks to grant, and the level whose history records them. */
export interface LevelCorrectionSelection {
	level: number;
	uuids: string[];
}

export interface LevelCorrectionSubmitData {
	selections: LevelCorrectionSelection[];
}
