import type { CheckRollDialogData } from '#documents/actor/actorInterfaces.ts';
import type { ConditionRollMode } from '#types/conditionRollMode.d.ts';

export type RollDialogType = 'abilityCheck' | 'savingThrow' | 'skillCheck' | 'initiative';

export interface InitiativeDialogActor extends Actor {
	_getInitiativeFormula: (options: Record<string, unknown>) => string;
	checkConditionLines: (type: RollDialogType) => ConditionRollMode[];
}

export interface CheckRollDialogSubmitData {
	rollMode: number;
	rollFormula: string;
	visibilityMode: string;
	/** The condition ticks that were on, each with the step it gave. */
	conditionRollModes: ConditionRollMode[];
}

export interface CheckRollDialogInstance {
	submitRoll: (results: CheckRollDialogSubmitData) => void;
}

export interface CheckRollDialogProps extends CheckRollDialogData {
	actor: InitiativeDialogActor;
	dialog: CheckRollDialogInstance;
	type?: RollDialogType;
}
