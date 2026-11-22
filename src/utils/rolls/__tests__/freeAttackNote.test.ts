import { describe, expect, it } from 'vitest';
import { freeAttackNote } from '../freeAttackNote.ts';

describe('freeAttackNote', () => {
	it('names the feature and says the attack spends no action', () => {
		expect(freeAttackNote('Coordinated Strike!', false)).toBe(
			'A free attack (Coordinated Strike!): it spends no action.',
		);
	});

	it('adds the Rushed Attack note when the feature ignores them', () => {
		expect(freeAttackNote('Swiftstrike', true)).toBe(
			'A free attack (Swiftstrike): it spends no action and has no Rushed Attack disadvantage.',
		);
	});

	it('is empty with no feature name', () => {
		expect(freeAttackNote('', true)).toBe('');
	});
});
