import { describe, expect, it } from 'vitest';

import { conditionalBonusTick } from '../conditionalBonusTick.ts';

describe('conditionalBonusTick', () => {
	it('puts the note of the label after the damage', () => {
		expect(conditionalBonusTick('Lunging Strike (+1 Reach)', '1d6 × 2')).toBe(
			'Lunging Strike: +1d6 × 2 damage (+1 Reach)',
		);
		expect(conditionalBonusTick('Using Assist Me, My Friend! (1/round)', '1d6 + 3')).toBe(
			'Using Assist Me, My Friend!: +1d6 + 3 damage (1/round)',
		);
	});

	it('reads label and damage for a label with no note', () => {
		expect(conditionalBonusTick("Hunter's Mark", '5')).toBe("Hunter's Mark: +5 damage");
	});
});
