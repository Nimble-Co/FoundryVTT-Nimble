import localize from '#utils/localize.js';
import { isRuleAutomationEnabled } from '../settings/automationSettings.js';

const SWALLOWED_DAMAGE = 20;

/** A Swallowed creature takes its damage at the start of its turn, on the active GM's client. */
export function registerSwallowedTurnStartHooks(): void {
	Hooks.on(
		'nimbleCombatTurnStart' as never,
		(async (combatant: {
			actor?: {
				name?: string | null;
				statuses?: Set<string>;
				applyDamage?(amount: number): Promise<void>;
			} | null;
		}) => {
			const actor = combatant.actor;
			if (!isRuleAutomationEnabled() || !actor?.statuses?.has('swallowed')) return;
			await actor.applyDamage?.(SWALLOWED_DAMAGE);
			await ChatMessage.create({
				content: localize('NIMBLE.chat.swallowedDamage', {
					name: actor.name ?? '',
					amount: String(SWALLOWED_DAMAGE),
				}),
			});
		}) as never,
	);
}
