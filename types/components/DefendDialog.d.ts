import type ChoiceDialog from '#documents/dialogs/ChoiceDialog.svelte.js';

/** One way to Defend, as the window lists it. */
export interface DefendWay {
	id: string;
	name: string;
	note: string;
}

export interface DefendWindowData {
	heroName: string;
	heading: string;
	/** The attack hits this hero, so they can Defend without an Interpose. */
	isTarget: boolean;
	ways: DefendWay[];
	interposes: Array<{ entryId: string; label: string; note: string }>;
	/** Why Defend is spent or costs more, or empty. */
	blockedNote: string;
	/** Damage the hero takes, keyed `<defend 0|1>:<interpose entry id>`. */
	takes: Record<string, number | null>;
}

export interface DefendChoice {
	defend: boolean;
	wayId: string;
	interposeEntryId: string | null;
}

export interface DefendDialogProps {
	actor: Actor.Implementation;
	dialog: ChoiceDialog<DefendChoice>;
	data: DefendWindowData;
}
