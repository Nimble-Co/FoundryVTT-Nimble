/**
 * Type declarations for Nimble rule types to prevent circular dependencies
 */

// eslint-disable-next-line @typescript-eslint/no-unused-vars
declare interface NimbleBaseRule<Schema = any, Parent = any> {
	disabled: boolean;
	priority: number;
	prePrepareData?(): void;
	afterPrepareData?(): void;
	preCreate?(args: Record<string, any>): Promise<void>;
	afterCreate?(): void;
	preRoll?(): void;
	preDelete?(): void;
	preUpdate?(changes: Record<string, unknown>): void;
	afterUpdate?(changes: Record<string, unknown>): void;
	afterRoll?(): void;
	afterDelete?(): void;
	toObject?(): any;
	tooltipInfo?(props?: Map<string, string>): string;
	preUpdateActor?(
		changes: Record<string, unknown>,
	): Promise<{ create?: any[]; delete?: string[] } | undefined>;
}

declare namespace NimbleBaseRule {
	type Schema = any;
}
