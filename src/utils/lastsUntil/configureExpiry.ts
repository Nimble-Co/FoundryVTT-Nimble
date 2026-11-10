import type { LastsUntilEvent } from '../../models/activeEffect/nimbleEffectChoices.js';

/** The holder events that core's own Expiry Event field can name. */
const HOLDER_EVENTS: LastsUntilEvent[] = [
	'attack',
	'move',
	'castSpell',
	'takeDamage',
	'healed',
	'zeroHp',
	'die',
	'loseConcentration',
	'wounded',
	'rest',
	'chargeGained',
];

/**
 * The Nimble pass ends every effect, so core's registry changes none. The
 * holder events join core's Expiry Event choices.
 */
export function configureEffectExpiry(): void {
	const config = CONFIG.ActiveEffect as {
		expiryAction: 'update' | 'delete' | null;
		expiryEvents?: Record<string, string>;
	};
	config.expiryAction = null;
	config.expiryEvents ??= {};
	for (const event of HOLDER_EVENTS) {
		config.expiryEvents[event] = `NIMBLE.lastsUntil.expiryEvents.${event}`;
	}
}
