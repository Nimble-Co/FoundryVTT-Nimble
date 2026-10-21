import { describe, expect, it } from 'vitest';

import { resolveFormGroups } from './ruleFormLayout.js';

const { fields } = foundry.data;

function schema() {
	return {
		id: new fields.StringField({}),
		predicate: new fields.ObjectField({}),
		mode: new fields.StringField({ label: 'Mode' }),
		amount: new fields.NumberField({
			showWhen: (data: Record<string, unknown>) => data.mode === 'fixed',
		} as never),
		silent: new fields.BooleanField({}),
		extra: new fields.StringField({}),
		hiddenOne: new fields.StringField({ widget: 'hidden' } as never),
	} as unknown as Record<string, foundry.data.fields.DataField.Any>;
}

const fixed = new Set(['id', 'predicate']);

describe('resolveFormGroups', () => {
	it('keeps the layout order and puts fields the layout leaves out last', () => {
		const groups = resolveFormGroups(
			[{ fields: ['silent'] }, { label: 'Q', fields: ['predicate', 'mode'] }],
			schema(),
			{ mode: 'fixed' },
			fixed,
		);
		expect(groups.map((group) => group.fields.map((field) => field.name))).toEqual([
			['silent'],
			['predicate', 'mode'],
			['amount', 'extra'],
		]);
	});

	it('drops hidden fields and groups left empty', () => {
		const groups = resolveFormGroups(
			[{ fields: ['amount'] }, { fields: ['hiddenOne'] }, { fields: ['mode', 'silent', 'extra'] }],
			schema(),
			{ mode: 'variable' },
			fixed,
		);
		expect(groups.map((group) => group.fields.map((field) => field.name))).toEqual([
			['mode', 'silent', 'extra'],
		]);
	});

	it('uses the only field as the question of a group with no label', () => {
		const [single, labelled, checkbox] = resolveFormGroups(
			[{ fields: ['mode'] }, { label: 'Q', fields: ['extra'] }, { fields: ['silent'] }],
			schema(),
			{ mode: 'variable' },
			new Set([...fixed, 'amount', 'hiddenOne']),
		);
		expect(single?.labelField?.name).toBe('mode');
		expect(single?.fields[0]?.showLabel).toBe(false);
		expect(labelled?.labelField).toBeUndefined();
		expect(labelled?.fields[0]?.showLabel).toBe(true);
		expect(checkbox?.labelField).toBeUndefined();
		expect(checkbox?.fields[0]?.isBoolean).toBe(true);
	});
});
