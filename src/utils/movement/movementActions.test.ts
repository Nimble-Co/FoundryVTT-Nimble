import { afterEach, describe, expect, it } from 'vitest';
import {
	FORCED_MOVEMENT_ACTION,
	FREE_MOVEMENT_ACTION,
	registerMovementActions,
} from './movementActions.js';

type ActionConfig = Record<string, unknown>;
type TokenConfig = { movement?: { actions?: Record<string, ActionConfig> } };

const originalToken = (CONFIG as unknown as { Token?: TokenConfig }).Token;

function stubActions(actions: Record<string, ActionConfig>): Record<string, ActionConfig> {
	(CONFIG as unknown as { Token: TokenConfig }).Token = { movement: { actions } };
	return actions;
}

function coreActions(): Record<string, ActionConfig> {
	return {
		walk: { label: 'TOKEN.MOVEMENT.ACTIONS.walk.label', teleport: false },
		blink: { label: 'TOKEN.MOVEMENT.ACTIONS.blink.label', teleport: true },
	};
}

describe('registerMovementActions', () => {
	afterEach(() => {
		(CONFIG as unknown as { Token?: TokenConfig }).Token = originalToken;
	});

	it('adds the free action as a non-teleport action the user cannot select', () => {
		const actions = stubActions({});
		registerMovementActions();

		const free = actions[FREE_MOVEMENT_ACTION];
		expect(free).toMatchObject({
			label: 'NIMBLE.movement.actions.free',
			teleport: false,
			measure: true,
		});
		expect(free.canSelect).toBeTypeOf('function');
		expect((free.canSelect as () => boolean)()).toBe(false);
	});

	it('adds the forced action as a non-teleport action the user cannot select', () => {
		const actions = stubActions({});
		registerMovementActions();

		const forced = actions[FORCED_MOVEMENT_ACTION];
		expect(forced).toMatchObject({
			label: 'NIMBLE.movement.actions.forced',
			teleport: false,
			measure: true,
		});
		expect(forced.canSelect).toBeTypeOf('function');
		expect((forced.canSelect as () => boolean)()).toBe(false);
	});

	it('keeps the actions already in the config unchanged', () => {
		const actions = stubActions(coreActions());
		registerMovementActions();

		expect(actions.walk).toEqual(coreActions().walk);
		expect(actions.blink).toEqual(coreActions().blink);
		expect(Object.keys(actions)).toHaveLength(4);
	});

	it('does nothing when the token movement config is missing', () => {
		(CONFIG as unknown as { Token?: TokenConfig }).Token = undefined;
		expect(() => registerMovementActions()).not.toThrow();
	});
});
