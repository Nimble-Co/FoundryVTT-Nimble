/**
 * Type declarations for Nimble rule types to prevent circular dependencies
 */

declare interface NimbleBaseRule<Schema = any, Parent = any> {
	actor: NimbleCharacter;
	disabled: boolean;
	priority: number;

	// Common rule properties used by various rule types
	type: string;
	value?: string;

	// AbilityBonusRule properties
	abilities?: string[];

	// SkillBonusRule properties
	skills?: string[];

	// SavingThrowRollModeRule properties
	requiresChoice?: boolean;
	target?: string;
	selectedSave?: string;

	// GrantProficiencyRule properties
	proficiencyType?: string;
	values?: string[];
	predicate?: {
		intelligence?: { min?: number };
		[key: string]: unknown;
	};

	// Lifecycle hooks
	prePrepareData?(): void;
	afterPrepareData?(): void;
	preCreate?(args: Record<string, any>): Promise<void>;
	afterCreate?(): void;
	preRoll?(): void;
	preDelete?(): void;
	preUpdate?(changes: Record<string, unknown>): Promise<void>;
	afterUpdate?(changes: Record<string, unknown>): void;
	afterRoll?(): void;
	afterDelete?(): Promise<void>;
	toObject?(): any;
	tooltipInfo?(props?: Map<string, string>): string;
	preUpdateActor?(
		changes: Record<string, unknown>,
	): Promise<{ create?: any[]; delete?: string[] } | undefined>;
}

declare namespace NimbleBaseRule {
	type Schema = any;
}
