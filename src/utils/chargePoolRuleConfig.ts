const ChargePoolRuleConfig = {
	scopes: ['item', 'actor'],
	initialModes: ['max', 'zero'],
	recoveryTriggers: [
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
	],
	recoveryModes: ['add', 'set', 'refresh'],
	restTypes: ['safe', 'field'],
	encounterTriggerTypes: ['encounterStart', 'encounterEnd'] as const,
	flagScope: 'nimble',
	flagKey: 'chargePools',
	flagPath: 'flags.nimble.chargePools',
} as const;

export { ChargePoolRuleConfig };
