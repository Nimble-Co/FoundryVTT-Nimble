/**
 * Type declarations for manager types to prevent circular dependencies
 */

declare interface RulesManagerInterface extends Map<string, NimbleBaseRule> {
	rulesTypeMap: Map<string, NimbleBaseRule>;
	addRule(data: Record<string, any>, options?: { update?: boolean }): Promise<any>;
	hasRuleOfType(type: string): boolean;
	getRuleOfType(type: string): NimbleBaseRule | undefined;
	deleteRule(id: string): Promise<any>;
	updateRule(id: string, data: string | Record<string, any>): Promise<boolean>;
}
