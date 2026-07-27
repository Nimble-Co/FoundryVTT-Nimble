import { describe, expect, it } from 'vitest';
import { ancestryBonusRequiresSaveChoice } from './ancestryBonusRequiresSaveChoice.js';

/**
 * Builds a stub standing in for an ancestry-bonus document. The predicate reads the
 * document-level `rules` RulesManager (a Map), not `system.rules`.
 */
function createBonusStub(rules: Record<string, unknown>[]) {
	return {
		rules: new Map(rules.map((rule, index) => [String(index), rule])),
	} as unknown as NimbleAncestryBonusItem;
}

const NEUTRAL_SAVE_CHOICE_RULE = {
	type: 'savingThrowRollMode',
	requiresChoice: true,
	target: 'neutral',
};

describe('ancestryBonusRequiresSaveChoice', () => {
	it('returns true when the bonus carries a neutral save that requires a choice', () => {
		expect(ancestryBonusRequiresSaveChoice(createBonusStub([NEUTRAL_SAVE_CHOICE_RULE]))).toBe(true);
	});

	it('finds the rule when it is not the first in the list', () => {
		const bonus = createBonusStub([
			{ type: 'abilityBonus', abilities: ['strength'], value: '2' },
			{ type: 'skillBonus', skills: ['might'], value: '1' },
			NEUTRAL_SAVE_CHOICE_RULE,
		]);

		expect(ancestryBonusRequiresSaveChoice(bonus)).toBe(true);
	});

	it('returns false when the save rule does not require a choice', () => {
		const bonus = createBonusStub([
			{ type: 'savingThrowRollMode', requiresChoice: false, target: 'neutral' },
		]);

		expect(ancestryBonusRequiresSaveChoice(bonus)).toBe(false);
	});

	it('returns false when the neutral save rule is disabled', () => {
		// `resolveSavingThrowRollModes` skips disabled rules at submit time, so gating the
		// wizard on one would make the player choose a save that is then discarded.
		const bonus = createBonusStub([{ ...NEUTRAL_SAVE_CHOICE_RULE, disabled: true }]);

		expect(ancestryBonusRequiresSaveChoice(bonus)).toBe(false);
	});

	it('returns false when the save rule targets a specific save rather than neutral', () => {
		const bonus = createBonusStub([
			{ type: 'savingThrowRollMode', requiresChoice: true, target: 'strength' },
		]);

		expect(ancestryBonusRequiresSaveChoice(bonus)).toBe(false);
	});

	it('returns false for a bonus whose rules are unrelated', () => {
		const bonus = createBonusStub([{ type: 'abilityBonus', abilities: ['all'], value: '1' }]);

		expect(ancestryBonusRequiresSaveChoice(bonus)).toBe(false);
	});

	it('returns false for a bonus with no rules', () => {
		expect(ancestryBonusRequiresSaveChoice(createBonusStub([]))).toBe(false);
	});

	it('returns false when no bonus is selected', () => {
		expect(ancestryBonusRequiresSaveChoice(null)).toBe(false);
	});

	it('returns false when the bonus document has no rules manager at all', () => {
		expect(ancestryBonusRequiresSaveChoice({} as unknown as NimbleAncestryBonusItem)).toBe(false);
	});
});
