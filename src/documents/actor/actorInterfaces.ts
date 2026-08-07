/**
 * Type interfaces for actors to break circular dependencies
 */

import type { AbilityKeyType } from '#types/abilityKey.js';
import type { SaveKeyType } from '#types/saveKey.js';
import type { SkillKeyType } from '#types/skillKey.js';

export type SystemActorTypes = Exclude<foundry.documents.BaseActor.SubType, 'base'>;

export interface ActorRollOptions {
	/**
	 * Explains why a check is being asked for, rendered above the roll controls.
	 * Used when a check is raised by something other than the player clicking the
	 * skill — a spell scroll they cannot read, for instance — where the dialog
	 * would otherwise appear with no stated cause or stake.
	 */
	checkHint?: string | undefined;
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
