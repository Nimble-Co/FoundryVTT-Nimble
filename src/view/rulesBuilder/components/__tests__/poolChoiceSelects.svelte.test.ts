import { render } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';

import { DicePoolRule } from '../../../../models/rules/dicePool.js';
import { ModifyPoolRule } from '../../../../models/rules/modifyPool.js';
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

	describe('a Modify Pool row offers only what its pool type can do', () => {
		function renderRow(poolType: string, entry: Record<string, unknown>) {
			const field = ModifyPoolRule.defineSchema().addRefills;
			const rule = { poolType, addRefills: [entry] };
			const { container } = render(SchemaFieldRenderer, {
				field: field as never,
				value: rule.addRefills,
				parentData: rule,
				name: 'addRefills',
				onChange: () => {},
			});
			const [trigger, mode] = [...container.querySelectorAll('select')];
			const values = (select: HTMLSelectElement) =>
				[...select.options].map((option) => option.value);
			const texts = (select: HTMLSelectElement) =>
				[...select.options].map((option) => option.textContent?.trim());
			return { trigger: values(trigger), mode: values(mode), modeTexts: texts(mode) };
		}

		it('gives a charge pool no dice pool trigger or mode', () => {
			const { trigger, mode } = renderRow('charge', {
				trigger: 'safeRest',
				mode: 'add',
				value: '1',
			});

			expect(mode).toEqual(['add', 'set', 'refresh']);
			expect(trigger).toContain('onInitiativeRolled');
			expect(trigger).not.toContain('onAttacked');
		});

		it('gives a dice pool no charge pool trigger', () => {
			const { trigger, mode } = renderRow('dice', { trigger: 'safeRest', mode: 'add', value: '1' });

			expect(mode).toEqual(['add', 'set', 'refresh', 'setIfEmpty', 'clear']);
			expect(trigger).toContain('onAttacked');
			expect(trigger).not.toContain('onInitiativeRolled');
		});

		it('keeps a stored value the pool type cannot do, and says it has no effect', () => {
			const { mode, modeTexts } = renderRow('charge', {
				trigger: 'safeRest',
				mode: 'clear',
				value: '1',
			});

			expect(mode).toEqual(['add', 'set', 'refresh', 'clear']);
			expect(modeTexts.at(-1)).toBe('Empty the Pool (no effect here)');
		});
	});
});
