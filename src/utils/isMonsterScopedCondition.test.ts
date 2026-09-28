import { afterEach, describe, expect, it } from 'vitest';
import isMonsterScopedCondition from './isMonsterScopedCondition.js';

const originalScopes = CONFIG.NIMBLE.conditionScopes;

afterEach(() => {
	CONFIG.NIMBLE.conditionScopes = originalScopes;
});

describe('isMonsterScopedCondition', () => {
	it('reports the conditions marked monster-scoped in CONFIG', () => {
		CONFIG.NIMBLE.conditionScopes = { latchedOn: 'monster', swallowed: 'monster' };

		expect(isMonsterScopedCondition('latchedOn')).toBe(true);
		expect(isMonsterScopedCondition('swallowed')).toBe(true);
	});

	it('treats an unlisted condition as general, so custom GM conditions stay pickable', () => {
		CONFIG.NIMBLE.conditionScopes = { latchedOn: 'monster' };

		expect(isMonsterScopedCondition('frightened')).toBe(false);
		expect(isMonsterScopedCondition('soul_burned')).toBe(false);
	});

	it('treats every condition as general when the dictionary is missing', () => {
		CONFIG.NIMBLE.conditionScopes = undefined as never;

		expect(isMonsterScopedCondition('latchedOn')).toBe(false);
	});
});
