import { render } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import RollModeField from '../RollModeField.svelte';
import { rollSpendLine } from '../rollSpendLine.ts';

describe('rollSpendLine', () => {
	it('says what the roll spends', () => {
		expect(rollSpendLine(1)).toBe('When you roll, it spends 1 action.');
		expect(rollSpendLine(2, '3 Mana')).toBe('When you roll, it spends 2 actions and 3 Mana.');
		expect(rollSpendLine(0, '3 Mana')).toBe('When you roll, it spends 3 Mana.');
	});

	it('is empty when the roll spends nothing', () => {
		expect(rollSpendLine(0)).toBe('');
	});
});

describe('RollModeField', () => {
	it('says which attack of the turn it is, and that you can change it', () => {
		const { container } = render(RollModeField, { value: -2, rushedAttack: 3 });

		expect(container.querySelector('.rush')?.textContent?.trim()).toBe(
			'Rushed Attack: this is attack 3 of your turn, so the roll starts with Disadvantage × 2. You can change it.',
		);
		expect(container.querySelector('.line b')?.textContent).toBe('Disadvantage × 2');
	});

	it('has no Rushed Attack line on the first attack', () => {
		const { container } = render(RollModeField, { value: 0 });

		expect(container.querySelector('.rush')).toBeNull();
	});
});
