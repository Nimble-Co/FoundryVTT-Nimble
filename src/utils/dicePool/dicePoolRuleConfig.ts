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
	flagScope: 'nimble',
	flagKey: 'dicePools',
	flagPath: 'flags.nimble.dicePools',
} as const;

export { DicePoolRuleConfig };
