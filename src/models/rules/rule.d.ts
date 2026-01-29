/**
 * Type declarations for Nimble rule types to prevent circular dependencies
 */

declare interface NimbleBaseRule<Schema = any, Parent = any> {
	actor: NimbleCharacter;
	disabled: boolean;
	priority: number;
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
