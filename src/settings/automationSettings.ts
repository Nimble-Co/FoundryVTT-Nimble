import { SYSTEM_ID } from '#system';

export const LEGACY_AUTO_APPLY_CONDITIONS_SETTING_KEY = 'automation.autoApplyConditions';

export const AUTOMATION_SETTING_KEYS = {
	applyRuleEffects: 'automation.applyRuleEffects',
	derivedConditions: 'automation.derivedConditions',
	resourceRecovery: 'automation.resourceRecovery',
	resourceSpending: 'automation.resourceSpending',
	actionTracking: 'automation.actionTracking',
	healthStateSync: 'automation.healthStateSync',
	combatConvenience: 'automation.combatConvenience',
	chatNotifications: 'automation.chatNotifications',
} as const;

export type AutomationSettingKey =
	(typeof AUTOMATION_SETTING_KEYS)[keyof typeof AUTOMATION_SETTING_KEYS];

/**
 * Reads a world automation toggle. Fails OPEN (true, the shipped default) when
 * settings are unavailable or the key is not yet registered, so automation
 * behaves as configured out of the box rather than silently shutting off.
 */
function readAutomationToggle(key: AutomationSettingKey): boolean {
	try {
		const value = game.settings?.get(SYSTEM_ID as 'core', key as 'rollMode');
		if (value === undefined) return true;
		return Boolean(value);
	} catch {
		return true;
	}
}

/** Whether rule lifecycle events drive conditions, target marks, and effect endings. */
export function isRuleAutomationEnabled(): boolean {
	return readAutomationToggle(AUTOMATION_SETTING_KEYS.applyRuleEffects);
}

/** Whether derived conditions (e.g. Hampered) are applied and removed automatically. */
export function isDerivedConditionsAutomationEnabled(): boolean {
	return readAutomationToggle(AUTOMATION_SETTING_KEYS.derivedConditions);
}

/** Whether charge and dice pools refill automatically from their recovery triggers. */
export function isResourceRecoveryAutomationEnabled(): boolean {
	return readAutomationToggle(AUTOMATION_SETTING_KEYS.resourceRecovery);
}

/** Whether mana and charges are validated and consumed automatically on use. */
export function isResourceSpendingAutomationEnabled(): boolean {
	return readAutomationToggle(AUTOMATION_SETTING_KEYS.resourceSpending);
}

/** Whether using items in combat spends combatant actions automatically. */
export function isActionTrackingAutomationEnabled(): boolean {
	return readAutomationToggle(AUTOMATION_SETTING_KEYS.actionTracking);
}

/** Whether the Bloodied status is synced from hit points automatically. */
export function isHealthStateSyncAutomationEnabled(): boolean {
	return readAutomationToggle(AUTOMATION_SETTING_KEYS.healthStateSync);
}

/** Whether combat-start conveniences (auto-rolling character initiative) run. */
export function isCombatConvenienceAutomationEnabled(): boolean {
	return readAutomationToggle(AUTOMATION_SETTING_KEYS.combatConvenience);
}

/** Whether informational automation chat messages are posted. */
export function isChatNotificationsAutomationEnabled(): boolean {
	return readAutomationToggle(AUTOMATION_SETTING_KEYS.chatNotifications);
}

/** Persists an automation toggle. Used by the automation settings dialog. */
export async function setAutomationToggle(
	key: AutomationSettingKey,
	value: boolean,
): Promise<void> {
	await game.settings.set(SYSTEM_ID as 'core', key as 'rollMode', value as never);
}

/**
 * Resolves the registration-time default for the Apply Rule Effects toggle from
 * the legacy auto-apply-conditions setting: a world that had explicitly stored
 * a legacy value keeps that behavior; everyone else gets the new default (on).
 */
export function resolveLegacyAutoApplyDefault(
	storedExists: boolean,
	legacyValue: boolean,
): boolean {
	return storedExists ? legacyValue : true;
}
