import { render } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';

import { PredicateField } from '../../../models/fields/PredicateField.js';
import SchemaFieldRenderer from './SchemaFieldRenderer.svelte';

vi.stubGlobal('fromUuidSync', () => null);

// HTMLProseMirrorElement.create is mocked in tests/mocks/foundry.ts; return a
// real DOM node so onMount's `replaceWith` doesn't throw.
const proseMirrorMock = foundry.applications.elements.HTMLProseMirrorElement
	.create as unknown as ReturnType<typeof vi.fn>;
proseMirrorMock.mockImplementation(() => document.createElement('div'));

const noop = () => {};

const { fields } = foundry.data;

describe('SchemaFieldRenderer dispatch table', () => {
	it('widget=formula → mounts <FormulaInput>', () => {
		const field = new fields.StringField({
			required: true,
			nullable: false,
			initial: '',
			widget: 'formula',
		} as never);
		const { container } = render(SchemaFieldRenderer, {
			field,
			value: '@level',
			parentData: {},
			name: 'value',
			onChange: noop,
		});
		expect(container.querySelector('.nimble-formula-input')).toBeTruthy();
		expect(container.querySelector('.nimble-formula-input--dice')).toBeFalsy();
	});

	it('widget=diceFormula → mounts <FormulaInput dice>', () => {
		const field = new fields.StringField({
			required: true,
			nullable: false,
			initial: '',
			widget: 'diceFormula',
		} as never);
		const { container } = render(SchemaFieldRenderer, {
			field,
			value: '1d6',
			parentData: {},
			name: 'value',
			onChange: noop,
		});
		expect(container.querySelector('.nimble-formula-input--dice')).toBeTruthy();
	});

	it('widget=documentUuid → mounts <DocumentPicker>', () => {
		const field = new fields.StringField({
			required: true,
			nullable: false,
			initial: '',
			widget: 'documentUuid',
		} as never);
		const { container } = render(SchemaFieldRenderer, {
			field,
			value: '',
			parentData: {},
			name: 'uuid',
			onChange: noop,
		});
		expect(container.querySelector('.nimble-document-picker')).toBeTruthy();
	});

	it('widget=templateString → mounts a hinted text input', () => {
		const field = new fields.StringField({
			required: true,
			nullable: false,
			initial: '',
			widget: 'templateString',
		} as never);
		const { container } = render(SchemaFieldRenderer, {
			field,
			value: 'rolled {value}',
			parentData: {},
			name: 'message',
			onChange: noop,
		});
		expect(container.querySelector('.nimble-template-string-input')).toBeTruthy();
	});

	it('widget as a resolver → picks the charge pool picker from parentData', () => {
		const field = new fields.StringField({
			required: true,
			nullable: false,
			initial: '',
			widget: (data: Record<string, unknown>) =>
				data.poolType === 'charge' ? 'chargePoolPicker' : 'dicePoolPicker',
		} as never);
		const { container } = render(SchemaFieldRenderer, {
			field,
			value: 'combat-dice',
			parentData: { poolType: 'charge' },
			name: 'poolIdentifier',
			onChange: noop,
		});
		expect(container.querySelector('.nimble-pool-picker--charge')).toBeTruthy();
		expect(container.querySelector('.nimble-pool-picker--dice')).toBeFalsy();
	});

	it('widget as a resolver → picks the dice pool picker from parentData', () => {
		const field = new fields.StringField({
			required: true,
			nullable: false,
			initial: '',
			widget: (data: Record<string, unknown>) =>
				data.poolType === 'charge' ? 'chargePoolPicker' : 'dicePoolPicker',
		} as never);
		const { container } = render(SchemaFieldRenderer, {
			field,
			value: 'fury',
			parentData: { poolType: 'dice' },
			name: 'poolIdentifier',
			onChange: noop,
		});
		expect(container.querySelector('.nimble-pool-picker--dice')).toBeTruthy();
		expect(container.querySelector('.nimble-pool-picker--charge')).toBeFalsy();
	});

	it.each([
		['dicePoolPicker', 'nimble-pool-picker--dice'],
		['chargePoolPicker', 'nimble-pool-picker--charge'],
	])('widget=%s with no parent actor → editable free-text input', (widget, marker) => {
		const field = new fields.StringField({
			required: true,
			nullable: false,
			initial: '',
			widget,
		} as never);
		// No `document` prop, so the picker can't resolve an actor — the
		// compendium/world-item authoring path.
		const { container } = render(SchemaFieldRenderer, {
			field,
			value: 'combat-dice',
			parentData: {},
			name: 'poolIdentifier',
			onChange: noop,
		});

		const input = container.querySelector<HTMLInputElement>(`input[type="text"].${marker}`);
		expect(input).toBeTruthy();
		expect(input?.disabled).toBe(false);
		expect(input?.value).toBe('combat-dice');
	});

	it('widget resolver returning hidden → renders nothing', () => {
		const field = new fields.StringField({
			required: true,
			nullable: false,
			initial: '',
			widget: (data: Record<string, unknown>) => (data.mode === 'auto' ? 'hidden' : 'formula'),
		} as never);
		const { container } = render(SchemaFieldRenderer, {
			field,
			value: '1',
			parentData: { mode: 'auto' },
			name: 'count',
			onChange: noop,
		});
		expect(container.querySelector('.nimble-formula-input')).toBeFalsy();
		expect(container.textContent?.trim()).toBe('');
	});

	it('PredicateField → mounts <PredicateBuilder>', () => {
		const field = new PredicateField();
		const { container } = render(SchemaFieldRenderer, {
			field,
			value: {},
			parentData: {},
			name: 'predicate',
			onChange: noop,
		});
		expect(container.querySelector('.nimble-predicate-builder')).toBeTruthy();
	});

	it('HTMLField → mounts <RichTextEditor>', () => {
		const field = new fields.HTMLField({ required: true, nullable: false, initial: '' });
		const { container } = render(SchemaFieldRenderer, {
			field,
			value: '<p>hi</p>',
			parentData: {},
			name: 'description',
			onChange: noop,
		});
		expect(container.querySelector('.nimble-rich-text-editor')).toBeTruthy();
	});

	it('BooleanField → mounts a checkbox', () => {
		const field = new fields.BooleanField({ required: true, nullable: false, initial: false });
		const { container } = render(SchemaFieldRenderer, {
			field,
			value: true,
			parentData: {},
			name: 'flag',
			onChange: noop,
		});
		expect(container.querySelector('input[type="checkbox"]')).toBeTruthy();
	});

	it('NumberField → mounts a number input', () => {
		const field = new fields.NumberField({ required: true, nullable: false, initial: 1 });
		const { container } = render(SchemaFieldRenderer, {
			field,
			value: 5,
			parentData: {},
			name: 'count',
			onChange: noop,
		});
		expect(container.querySelector('input[type="number"]')).toBeTruthy();
	});

	it('StringField with choices → mounts a <select>', () => {
		const field = new fields.StringField({
			required: true,
			nullable: false,
			initial: 'a',
			choices: ['a', 'b', 'c'],
		});
		const { container } = render(SchemaFieldRenderer, {
			field,
			value: 'b',
			parentData: {},
			name: 'pick',
			onChange: noop,
		});
		expect(container.querySelector('select')).toBeTruthy();
	});

	it('StringField without choices → mounts a text input', () => {
		const field = new fields.StringField({ required: true, nullable: false, initial: '' });
		const { container } = render(SchemaFieldRenderer, {
			field,
			value: 'free text',
			parentData: {},
			name: 'label',
			onChange: noop,
		});
		expect(container.querySelector('input[type="text"]')).toBeTruthy();
	});

	it('widget=hidden → renders nothing', () => {
		const field = new fields.StringField({
			required: true,
			nullable: false,
			initial: '',
			widget: 'hidden',
		} as never);
		const { container } = render(SchemaFieldRenderer, {
			field,
			value: 'secret',
			parentData: {},
			name: 'id',
			onChange: noop,
		});
		expect(container.querySelector('input')).toBeFalsy();
		expect(container.querySelector('.nimble-renderer-error')).toBeFalsy();
	});

	it('showWhen returning false → renders nothing', () => {
		const field = new fields.StringField({
			required: true,
			nullable: false,
			initial: '',
			showWhen: (data: Record<string, unknown>) => data.mode === 'on',
		} as never);
		const { container } = render(SchemaFieldRenderer, {
			field,
			value: 'hi',
			parentData: { mode: 'off' },
			name: 'value',
			onChange: noop,
		});
		expect(container.querySelector('input')).toBeFalsy();
	});

	it('unknown widget hint → falls back to type default and warns', () => {
		const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

		const field = new fields.StringField({
			required: true,
			nullable: false,
			initial: '',
			widget: 'fromula', // typo — should not match any arm
		} as never);
		const { container } = render(SchemaFieldRenderer, {
			field,
			value: 'hi',
			parentData: {},
			name: 'value',
			onChange: noop,
		});

		// Falls through to StringField default → text input
		expect(container.querySelector('input[type="text"]')).toBeTruthy();
		expect(container.querySelector('.nimble-formula-input')).toBeFalsy();

		const messages = warnSpy.mock.calls.map((c) => c[0] as string);
		expect(messages.some((m) => m.includes('fromula') && m.includes('value'))).toBe(true);

		warnSpy.mockRestore();
	});

	it('unsupported field type → renders the inline error block and warns', () => {
		const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

		// ObjectField has no widget arm and isn't a SchemaField/PredicateField.
		const field = new fields.ObjectField({ required: true, nullable: false });
		const { container } = render(SchemaFieldRenderer, {
			field,
			value: {},
			parentData: {},
			name: 'mystery',
			onChange: noop,
		});

		expect(container.querySelector('.nimble-renderer-error')).toBeTruthy();
		expect(warnSpy).toHaveBeenCalled();

		warnSpy.mockRestore();
	});
});
