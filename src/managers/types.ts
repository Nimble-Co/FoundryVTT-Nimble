/**
 * Shared types for managers to break circular dependencies
 */

export namespace ItemActivationManager {
	export interface ActivationOptions {
		executeMacro?: boolean;
		fastForward?: boolean;
		rollMode?: number;
		visibilityMode?: keyof foundry.CONST.DICE_ROLL_MODES;
	}

	export interface DialogData {
		rollMode?: number;
	}
}

export namespace RulesManager {
	export interface AddOptions {
		update?: boolean;
	}
}
