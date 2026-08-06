const ChargeUiConfig = {
	unknownItemLocalizationKey: 'NIMBLE.charges.unknownItem',
	defaultPoolIcon: 'fa-solid fa-bolt',
	defaultRecoveryIcon: 'fa-solid fa-battery-half',
	recoveryTriggerLocalizationKeys: {
		safeRest: 'NIMBLE.restTypes.safeRest',
		fieldRest: 'NIMBLE.restTypes.fieldRest',
		onHit: 'NIMBLE.activationEffects.onHit',
		onCriticalHit: 'NIMBLE.activationEffects.onCriticalHit',
		encounterStart: 'NIMBLE.charges.recoveryTrigger.encounterStart',
		encounterEnd: 'NIMBLE.charges.recoveryTrigger.encounterEnd',
		onInitiativeRolled: 'NIMBLE.charges.recoveryTrigger.onInitiativeRolled',
		onWound: 'NIMBLE.charges.recoveryTrigger.onWound',
		onTurnStart: 'NIMBLE.charges.recoveryTrigger.onTurnStart',
		onTurnEnd: 'NIMBLE.charges.recoveryTrigger.onTurnEnd',
		onKill: 'NIMBLE.charges.recoveryTrigger.onKill',
		onBloodied: 'NIMBLE.charges.recoveryTrigger.onBloodied',
	},
	recoveryModeLocalizationKeys: {
		add: 'NIMBLE.charges.recoveryMode.add',
		set: 'NIMBLE.charges.recoveryMode.set',
		refresh: 'NIMBLE.charges.recoveryMode.refresh',
	},
} as const;

export { ChargeUiConfig };
