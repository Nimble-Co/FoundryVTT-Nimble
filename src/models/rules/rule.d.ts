/**
 * Type declarations for Nimble rule types to prevent circular dependencies
 */

declare interface NimbleBaseRule {
		disabled: boolean;
		priority: number;
		prePrepareData?(): void;
		afterPrepareData?(): void;
		preCreate?(args: Record<string, any>): Promise<void>;
		toObject?(): any;
		tooltipInfo?(): string;
	}
