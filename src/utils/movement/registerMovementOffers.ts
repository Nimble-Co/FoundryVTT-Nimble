import { systemHookName } from '#system';
import type { MovementRecord } from '#types/movement.js';
import { resolveArmedMovementOffer } from './resolveArmedMovementOffer.js';

let didRegister = false;

/**
 * Listens for finished Movements so a Movement Offer is recorded on its card.
 * Idempotent; call from `ready`.
 */
export function registerMovementOfferListener(): void {
	if (didRegister) return;
	didRegister = true;
	Hooks.on(
		systemHookName('movementFinished') as never,
		((record: MovementRecord) => {
			void resolveArmedMovementOffer(record);
		}) as never,
	);
}
