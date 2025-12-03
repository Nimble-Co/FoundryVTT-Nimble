/**
 * Type declarations for manager types to prevent circular dependencies
 */

declare interface RulesManagerInterface extends Map<string, InstanceType<typeof NimbleBaseRule>> {
	rulesTypeMap: Map<string, InstanceType<typeof NimbleBaseRule>>;
	addRule(data: Record<string, unknown>, options?: { update?: boolean }): Promise<unknown>;
	hasRuleOfType(type: string): boolean;
	getRuleOfType(type: string): InstanceType<typeof NimbleBaseRule> | undefined;
	deleteRule(id: string): Promise<unknown>;
	updateRule(id: string, data: string | Record<string, unknown>): Promise<boolean>;
}
