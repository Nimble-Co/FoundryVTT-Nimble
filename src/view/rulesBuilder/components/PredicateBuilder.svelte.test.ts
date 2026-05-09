import { fireEvent, render } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';

import type { RawPredicate } from '../../../etc/Predicate.js';
import PredicateBuilder from './PredicateBuilder.svelte';

function lastEmitted(spy: ReturnType<typeof vi.fn>): RawPredicate | undefined {
	const calls = spy.mock.calls;
	if (calls.length === 0) return undefined;
	return calls[calls.length - 1][0] as RawPredicate;
}

describe('PredicateBuilder', () => {
	it('renders one row per existing predicate entry', () => {
		const onChange = vi.fn();
		const { container } = render(PredicateBuilder, {
			value: { level: { min: 5 }, alignment: 'good' } as RawPredicate,
			onChange,
		});
		const rows = container.querySelectorAll('.nimble-predicate-builder__row');
		expect(rows).toHaveLength(2);
	});

	it('atomic statement round-trips on key/value commit', async () => {
		const onChange = vi.fn();
		const { container } = render(PredicateBuilder, {
			value: { class: 'wizard' } as RawPredicate,
			onChange,
		});

		const keyInput = container.querySelector('.nimble-predicate-builder__key') as HTMLInputElement;
		expect(keyInput.value).toBe('class');

		const valueInputs = container.querySelectorAll(
			'.nimble-predicate-builder__value input[type="text"]',
		);
		const valueInput = valueInputs[0] as HTMLInputElement;
		expect(valueInput.value).toBe('wizard');

		await fireEvent.input(valueInput, { target: { value: 'fighter' } });
		await fireEvent.change(valueInput, { target: { value: 'fighter' } });

		const emitted = lastEmitted(onChange);
		expect(emitted).toEqual({ class: 'fighter' });
	});

	it('binary statement round-trips with min/max/equal', async () => {
		const onChange = vi.fn();
		const { container } = render(PredicateBuilder, {
			value: { level: { min: 3, max: 7 } } as RawPredicate,
			onChange,
		});

		const binaryRadio = container.querySelector(
			'input[type="radio"][value="binary"]',
		) as HTMLInputElement;
		await fireEvent.change(binaryRadio);

		const emitted = lastEmitted(onChange);
		expect(emitted).toEqual({ level: { min: 3, max: 7 } });
	});

	it('array statement round-trips and supports add/remove', async () => {
		const onChange = vi.fn();
		const { container } = render(PredicateBuilder, {
			value: { tag: ['a', 'b'] } as RawPredicate,
			onChange,
		});

		const arrayInputs = container.querySelectorAll(
			'.nimble-predicate-builder__array-row input[type="text"]',
		);
		expect(arrayInputs).toHaveLength(2);

		const firstArrayInput = arrayInputs[0] as HTMLInputElement;
		await fireEvent.input(firstArrayInput, { target: { value: 'c' } });
		await fireEvent.change(firstArrayInput, { target: { value: 'c' } });

		const emitted = lastEmitted(onChange);
		expect(emitted).toEqual({ tag: ['c', 'b'] });
	});

	it('deleting a row emits a predicate without that key', async () => {
		const onChange = vi.fn();
		const { container } = render(PredicateBuilder, {
			value: { class: 'fighter', level: { min: 5 } } as RawPredicate,
			onChange,
		});

		const deleteButtons = container.querySelectorAll('.nimble-predicate-builder__delete');
		expect(deleteButtons).toHaveLength(2);

		await fireEvent.click(deleteButtons[0] as Element);

		const emitted = lastEmitted(onChange);
		expect(emitted).toBeDefined();
		expect(Object.keys(emitted ?? {})).toHaveLength(1);
		expect(emitted?.level).toEqual({ min: 5 });
	});

	it('preview reports a match when the domain satisfies the predicate', () => {
		const { container } = render(PredicateBuilder, {
			value: { class: 'fighter' } as RawPredicate,
			onChange: vi.fn(),
			previewDomain: new Set(['class:fighter', 'level:5']),
		});
		const preview = container.querySelector('.nimble-predicate-builder__preview--match');
		expect(preview).toBeTruthy();
	});

	it('preview reports no match when the domain misses the predicate', () => {
		const { container } = render(PredicateBuilder, {
			value: { class: 'fighter' } as RawPredicate,
			onChange: vi.fn(),
			previewDomain: new Set(['class:wizard']),
		});
		const preview = container.querySelector('.nimble-predicate-builder__preview--no-match');
		expect(preview).toBeTruthy();
	});

	it('preview is suppressed when no domain is provided', () => {
		const { container } = render(PredicateBuilder, {
			value: { class: 'fighter' } as RawPredicate,
			onChange: vi.fn(),
		});
		expect(container.querySelector('.nimble-predicate-builder__preview')).toBeFalsy();
	});
});
