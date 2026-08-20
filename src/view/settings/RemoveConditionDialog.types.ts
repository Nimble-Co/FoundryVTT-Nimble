import type GenericDialog from '#documents/dialogs/GenericDialog.svelte.js';
import type { ConditionUsage } from '../../settings/findConditionUsage.js';

/** What the GM chose. `keep` removes the condition but leaves every reference to it in place. */
export type RemoveConditionChoice = 'clean' | 'keep';

export interface RemoveConditionResult {
	choice: RemoveConditionChoice;
}

export interface RemoveConditionDialogProps {
	dialog: GenericDialog;
	conditionName: string;
	conditionImg: string;
	usage: ConditionUsage;
}
