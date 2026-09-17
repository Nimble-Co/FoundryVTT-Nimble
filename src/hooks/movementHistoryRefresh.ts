import { isMovementTrackingAutomationEnabled } from '../settings/automationSettings.js';

let didRegister = false;

/**
 * Re-prepares an actor whenever Foundry records or clears its token's movement
 * history, so the Spaces Moved This Turn tag is fresh on every client.
 */
export default function registerMovementHistoryRefresh(): void {
	if (didRegister) return;
	didRegister = true;

	Hooks.on('recordToken', (tokenDocument) => {
		if (!isMovementTrackingAutomationEnabled()) return;
		const actor = tokenDocument.actor;
		if (!actor) return;
		actor.reset();
		actor.render(false);
	});
}
