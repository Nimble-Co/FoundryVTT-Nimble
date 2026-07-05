/**
 * Shared types for managers to break circular dependencies
 */

export namespace ItemActivationManager {
	export interface ActivationOptions {
		executeMacro?: boolean;
		fastForward?: boolean;
		rollMode?: number;
		visibilityMode?: string;
		rollFormula?: string;
		primaryDieValue?: number;
		primaryDieModifier?: string;
		rollHidden?: boolean;
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
