import { afterEach, describe, expect, it } from 'vitest';
import { FORCED_MOVEMENT_ACTION, FREE_MOVEMENT_ACTION } from './movementActions.js';
import { getMovementKind } from './movementKind.js';

type TokenConfig = { movement?: { actions?: Record<string, { teleport?: boolean }> } };

function stubActions(actions: Record<string, { teleport?: boolean }>): void {
	(CONFIG as unknown as { Token: TokenConfig }).Token = { movement: { actions } };
}

const originalToken = (CONFIG as unknown as { Token?: TokenConfig }).Token;

describe('getMovementKind', () => {
	afterEach(() => {
		(CONFIG as unknown as { Token?: TokenConfig }).Token = originalToken;
	});

	it('reads core walk-like actions as regular', () => {
		stubActions({ walk: {}, fly: {}, climb: {} });
		expect(getMovementKind('walk')).toBe('regular');
		expect(getMovementKind('fly')).toBe('regular');
	});

	it('reads the system free action as free', () => {
		stubActions({});
		expect(getMovementKind(FREE_MOVEMENT_ACTION)).toBe('free');
	});

	it('reads the system forced action as forced', () => {
		stubActions({});
		expect(getMovementKind(FORCED_MOVEMENT_ACTION)).toBe('forced');
	});

	it('reads any teleporting action and displace as teleport', () => {
		stubActions({ blink: { teleport: true }, custom: { teleport: true } });
		expect(getMovementKind('blink')).toBe('teleport');
		expect(getMovementKind('custom')).toBe('teleport');
		expect(getMovementKind('displace')).toBe('teleport');
	});

	it('treats an unknown action as regular', () => {
		stubActions({});
		expect(getMovementKind('whatever')).toBe('regular');
	});
});
