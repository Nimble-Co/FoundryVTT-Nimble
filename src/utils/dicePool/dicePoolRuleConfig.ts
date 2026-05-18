import { SYSTEM_ID } from '#system';

const DicePoolRuleConfig = {
	scopes: ['item', 'actor'],
	dieSizes: ['d4', 'd6', 'd8', 'd10', 'd12', 'd20'],
	initialModes: ['max', 'zero'],
	refillTriggers: [
		'safeRest',
		'fieldRest',
		'onHit',
		'onCriticalHit',
		'encounterStart',
		'encounterEnd',
		'onWound',
		'onTurnStart',
		'onTurnEnd',
		'onKill',
		'onBloodied',
		'onAttacked',
	],
	refillModes: ['add', 'set', 'refresh'],
	restTypes: ['safe', 'field'],
	encounterTriggerTypes: ['encounterStart', 'encounterEnd'] as const,
	// How dice are spent: 'manual' = player opts in per roll, dice consumed.
	// 'autoBonus' = every face is added to qualifying rolls automatically and
	// the pool does NOT decrement. Used for snowballing damage pools like
	// Berserker Fury Dice.
	consumptionModes: ['manual', 'autoBonus'] as const,
	// Optional delivery filter for autoBonus pools. When set, the pool's faces
	// auto-add only to attacks of the matching delivery.
	attackDeliveryFilters: ['melee', 'ranged', 'any'] as const,
	flagScope: SYSTEM_ID,
	flagKey: 'dicePools',
	flagPath: `flags.${SYSTEM_ID}.dicePools`,
} as const;

export { DicePoolRuleConfig };
