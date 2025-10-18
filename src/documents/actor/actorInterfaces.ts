/**
 * Type interfaces for actors to break circular dependencies
 * These are pure type definitions with no imports from documents
 */

export type SystemActorTypes = Exclude<foundry.documents.BaseActor.TypeNames, 'base'>;

export interface ActorRollOptions {
	prompted?: boolean | undefined;
	respondentId?: string | undefined;
	rollMode?: number | undefined;
	rollModeModifier?: number | undefined;
	situationalMods?: string | undefined;
	skipRollDialog?: boolean | undefined;
	visibilityMode?: string | undefined;
}

export interface CheckRollDialogData extends ActorRollOptions {
	abilityKey?: abilityKey | undefined;
	saveKey?: saveKey | undefined;
	skillKey?: skillKey | undefined;
}
