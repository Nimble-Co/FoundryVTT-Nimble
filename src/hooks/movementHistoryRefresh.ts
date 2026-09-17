import { isMovementTrackingEnabled } from '../settings/automationSettings.js';

interface RecordedTokenDocument {
	actor?: { reset?: () => void; render?: (force?: boolean) => unknown } | null;
}

let didRegister = false;

/**
 * Re-prepares an actor whenever Foundry records or clears its token's movement
 * history, so the Spaces Moved This Turn tag is fresh on every client.
 */
export default function registerMovementHistoryRefresh(): void {
	if (didRegister) return;
	didRegister = true;

	(Hooks.on as (event: string, fn: (doc: RecordedTokenDocument) => void) => number)(
		'recordToken',
		(tokenDocument) => {
			if (!isMovementTrackingEnabled()) return;
			const actor = tokenDocument.actor;
			if (!actor) return;
			actor.reset?.();
			actor.render?.(false);
		},
	);
}
