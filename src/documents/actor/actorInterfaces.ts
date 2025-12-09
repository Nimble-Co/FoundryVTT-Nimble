/**
 * Type interfaces for actors to break circular dependencies
 */

import type { AbilityKeyType } from '#types/abilityKey.js';
import type { SaveKeyType } from '#types/saveKey.js';
import type { SkillKeyType } from '#types/skillKey.js';

export type SystemActorTypes = Exclude<foundry.documents.BaseActor.SubType, 'base'>;

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
	abilityKey?: AbilityKeyType | undefined;
	saveKey?: SaveKeyType | undefined;
	skillKey?: SkillKeyType | undefined;
}
