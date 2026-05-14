const ChargePoolRuleConfig = {
	scopes: ['item', 'actor'],
	dieSizes: ['d4', 'd6', 'd8', 'd10', 'd12', 'd20'],
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
		'onInitiativeRolled',
	],
	recoveryModes: ['add', 'set', 'refresh'],
	restTypes: ['safe', 'field'],
	encounterTriggerTypes: ['encounterStart', 'encounterEnd'] as const,
	flagScope: 'nimble',
	flagKey: 'chargePools',
	flagPath: 'flags.nimble.chargePools',
} as const;

export { ChargePoolRuleConfig };
