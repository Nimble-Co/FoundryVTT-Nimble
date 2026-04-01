import type { CheckRollDialogData } from '#documents/actor/actorInterfaces.ts';

export type RollDialogType = 'abilityCheck' | 'savingThrow' | 'skillCheck' | 'initiative';

export interface InitiativeDialogActor extends Actor {
	_getInitiativeFormula: (options: Record<string, unknown>) => string;
}

export interface CheckRollDialogSubmitData {
	rollMode: number;
	rollFormula: string;
	visibilityMode: string;
}

export interface CheckRollDialogInstance {
	submitRoll: (results: CheckRollDialogSubmitData) => void;
}

export interface CheckRollDialogProps extends CheckRollDialogData {
	actor: InitiativeDialogActor;
	dialog: CheckRollDialogInstance;
	type?: RollDialogType;
}
