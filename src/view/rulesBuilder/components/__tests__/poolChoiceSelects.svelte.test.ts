import { render } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';

import { DicePoolRule } from '../../../../models/rules/dicePool.js';
import SchemaFieldRenderer from '../SchemaFieldRenderer.svelte';

describe('pool refill selects in the Rules Builder', () => {
	it('show words, not the stored trigger and mode values', () => {
		const field = DicePoolRule.defineSchema().refills;
		const { container } = render(SchemaFieldRenderer, {
			field: field as never,
			value: [{ trigger: 'onAttacked', mode: 'setIfEmpty', value: '1', predicate: {} }],
			parentData: {},
			name: 'refills',
			onChange: () => {},
		});
		const selects = [...container.querySelectorAll('select')];
		const optionTexts = (select: HTMLSelectElement) =>
			[...select.options].map((option) => option.textContent?.trim());

		expect(selects).toHaveLength(2);
		const [trigger, mode] = selects;
		expect(optionTexts(trigger)).toContain('Attacked');
		expect(optionTexts(trigger)).toContain('Safe Rest');
		expect(optionTexts(trigger)).not.toContain('onAttacked');
		expect(optionTexts(mode)).toEqual([
			'Add',
			'Set',
			'Refill to max',
			'Set When Empty',
			'Empty the Pool',
		]);
		expect(trigger.value).toBe('onAttacked');
		expect(mode.value).toBe('setIfEmpty');
	});
});
