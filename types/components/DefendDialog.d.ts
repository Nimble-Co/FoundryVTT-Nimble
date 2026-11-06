import type ChoiceDialog from '#documents/dialogs/ChoiceDialog.svelte.js';

/** One thing the hero can do against the attack, as the window lists it. */
export interface DefendOption {
	id: string;
	title: string;
	/** What it costs: actions, and the armor a Defend uses. */
	cost: string;
	/** A line under the cost, for example a second Defend this round. Empty for none. */
	note: string;
	/** The confirm button's label when this row is picked. */
	confirm: string;
	/** Damage the hero takes without a Defend, when this row has one. */
	before: number | null;
	/** Damage the hero takes after this row, with no ticks. */
	takes: number | null;
	defend: boolean;
	/** The "When you Defend" ticks can go with this row. */
	takesTicks: boolean;
	interposeEntryId: string | null;
}

/** A "When you Defend" option: a tick under the rows. */
export interface DefendTick {
	id: string;
	label: string;
	/** What it does or costs, under the label. Empty for none. */
	detail: string;
}

export interface DefendWindowData {
	heading: string;
	options: DefendOption[];
	ticks: DefendTick[];
	/** Damage the hero takes after a row with these ticks. */
	takesWith: (optionId: string, tickIds: readonly string[]) => number | null;
	/** The row picked when the window opens. The first row when not set. */
	picked?: string;
}

export interface DefendChoice {
	optionId: string;
	defend: boolean;
	interposeEntryId: string | null;
	ticks: string[];
}

export interface DefendDialogProps {
	dialog: ChoiceDialog<DefendChoice>;
	data: DefendWindowData;
}
