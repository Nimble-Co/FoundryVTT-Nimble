import { describe, expect, it } from 'vitest';
import localize from './localize.js';
import { getPendingActionsLocalizationKey } from './pendingActionWording.js';

describe('getPendingActionsLocalizationKey', () => {
	it('uses the singular wording for a gain of one', () => {
		expect(getPendingActionsLocalizationKey(1)).toBe('NIMBLE.ui.heroicActions.pendingActionGain');
	});

	it('uses the plural wording for a gain of more than one', () => {
		expect(getPendingActionsLocalizationKey(2)).toBe('NIMBLE.ui.heroicActions.pendingActionsGain');
	});

	it('uses the singular wording for a loss of one', () => {
		expect(getPendingActionsLocalizationKey(-1)).toBe('NIMBLE.ui.heroicActions.pendingActionLoss');
	});

	it('uses the plural wording for a loss of more than one', () => {
		expect(getPendingActionsLocalizationKey(-3)).toBe('NIMBLE.ui.heroicActions.pendingActionsLoss');
	});

	it('formats a single-action gain without a stray plural', () => {
		const key = getPendingActionsLocalizationKey(1);
		expect(localize(key, { count: '1' })).toBe(
			'Gains 1 additional action at the start of the next turn',
		);
	});

	it('formats a single-action loss without a stray plural', () => {
		const key = getPendingActionsLocalizationKey(-1);
		expect(localize(key, { count: '1' })).toBe('Starts the next turn with 1 fewer action');
	});
});
