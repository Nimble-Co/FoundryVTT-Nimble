import type ChoiceDialog from '#documents/dialogs/ChoiceDialog.svelte.js';

/** One thing the hero can do against the attack, as the window lists it. */
export interface DefendOption {
	id: string;
	title: string;
	/** What it costs: actions, and the armor a Defend uses. */
	cost: string;
	/** The confirm button's label when this row is picked. */
	confirm: string;
	/** Damage the hero takes without a Defend, when this row has one. */
	before: number | null;
	/** Damage the hero takes after this row. */
	takes: number | null;
	defend: boolean;
	interposeEntryId: string | null;
}

export interface DefendWindowData {
	heading: string;
	options: DefendOption[];
}

export interface DefendChoice {
	defend: boolean;
	interposeEntryId: string | null;
}

export interface DefendDialogProps {
	actor: Actor.Implementation;
	dialog: ChoiceDialog<DefendChoice>;
	data: DefendWindowData;
}
