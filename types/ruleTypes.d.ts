type RuleClasses = typeof CONFIG.NIMBLE.ruleDataModels;

/** A registered rule type, such as `'reroll'`. */
export type RuleType = keyof RuleClasses;

/** The rule class instance of a rule type. */
export type RuleOf<T extends RuleType> = InstanceType<RuleClasses[T]>;
