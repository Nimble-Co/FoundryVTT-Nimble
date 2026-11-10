import type { LastsUntilCheck } from './momentReached.js';

/** The core expiry event name of a check. */
export function coreEventOf(check: LastsUntilCheck): string {
	if (check.type === 'worldTime') return 'updateWorldTime';
	if (check.type === 'event') return check.event;
	return check.type;
}
