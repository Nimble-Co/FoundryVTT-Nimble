import { SYSTEM_ID } from '#system';

const AUTO_APPLY_CONDITIONS_SETTING = 'automation.autoApplyConditions';

/**
 * Whether the world's rule-automation setting is on. Rule lifecycle dispatch
 * (ruleEventDispatch) is gated on this, so any behavior that only makes sense
 * when that dispatch runs — e.g. suppressing an activation card because a
 * rule's activation flow will post its own output — must share this gate.
 */
function isAutoApplyEnabled(): boolean {
	try {
		return Boolean(
			game.settings?.get(SYSTEM_ID as 'core', AUTO_APPLY_CONDITIONS_SETTING as 'rollMode'),
		);
	} catch {
		return false;
	}
}

export { AUTO_APPLY_CONDITIONS_SETTING, isAutoApplyEnabled };
