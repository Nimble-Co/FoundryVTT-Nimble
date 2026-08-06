import { describe, expect, it } from 'vitest';
import localize from '#utils/localize.js';
import { getActionDeltaLocalizationKey } from './actionDeltaWording.ts';

describe('getActionDeltaLocalizationKey', () => {
	const cases: [delta: number, appliesNextTurn: boolean, key: string][] = [
		[1, false, 'NIMBLE.chat.actionDeltaSummary.gainActionNow'],
		[2, false, 'NIMBLE.chat.actionDeltaSummary.gainActionsNow'],
		[-1, false, 'NIMBLE.chat.actionDeltaSummary.loseActionNow'],
		[-3, false, 'NIMBLE.chat.actionDeltaSummary.loseActionsNow'],
		[1, true, 'NIMBLE.chat.actionDeltaSummary.gainActionNextTurn'],
		[2, true, 'NIMBLE.chat.actionDeltaSummary.gainActionsNextTurn'],
		[-1, true, 'NIMBLE.chat.actionDeltaSummary.loseActionNextTurn'],
		[-3, true, 'NIMBLE.chat.actionDeltaSummary.loseActionsNextTurn'],
	];

	it.each(cases)('maps %i (next turn: %s) to %s', (delta, appliesNextTurn, key) => {
		expect(getActionDeltaLocalizationKey(delta, appliesNextTurn)).toBe(key);
	});

	// A key that does not resolve renders its own name on the card, so every
	// branch is checked against the shipped strings rather than only itself.
	it.each(cases)(
		'resolves the key for %i (next turn: %s) to real text',
		(delta, appliesNextTurn) => {
			const key = getActionDeltaLocalizationKey(delta, appliesNextTurn);
			const text = localize(key, { name: 'Sir Brannon', count: String(Math.abs(delta)) });

			expect(text).not.toContain('NIMBLE.');
			expect(text).toContain('Sir Brannon');
			expect(text).toContain(String(Math.abs(delta)));
		},
	);

	it('says action, not actions, for a single-action adjustment', () => {
		const key = getActionDeltaLocalizationKey(1, false);
		expect(localize(key, { name: 'Sir Brannon', count: '1' })).toBe(
			'Sir Brannon gains 1 action now',
		);
	});

	it('says actions for a multi-action adjustment', () => {
		const key = getActionDeltaLocalizationKey(2, false);
		expect(localize(key, { name: 'Sir Brannon', count: '2' })).toBe(
			'Sir Brannon gains 2 actions now',
		);
	});

	it('maps a zero delta to the gain wording rather than throwing', () => {
		expect(getActionDeltaLocalizationKey(0, false)).toBe(
			'NIMBLE.chat.actionDeltaSummary.gainActionsNow',
		);
	});
});
