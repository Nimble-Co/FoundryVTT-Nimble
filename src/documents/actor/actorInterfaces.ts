/**
 * Type interfaces for actors to break circular dependencies
 */

import type { AbilityKeyType } from '#types/abilityKey.js';
import type { SaveKeyType } from '#types/saveKey.js';
import type { SkillKeyType } from '#types/skillKey.js';

export type SystemActorTypes = Exclude<foundry.documents.BaseActor.SubType, 'base'>;

export interface ActorRollOptions {
	/**
	 * Explains why the check is needed, shown above the roll controls.
	 * Used when something other than clicking a skill triggers the check, such as
	 * trying to use a spell scroll the player cannot read. Without it, the dialog
	 * would appear with no explanation of what prompted the roll or what's at stake.
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
