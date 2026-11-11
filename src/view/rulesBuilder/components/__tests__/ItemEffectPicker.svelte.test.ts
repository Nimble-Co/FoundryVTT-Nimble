import { fireEvent, render } from '@testing-library/svelte';
import { tick } from 'svelte';
import { describe, expect, it, vi } from 'vitest';

import SchemaFieldRenderer from '../SchemaFieldRenderer.svelte';

const { fields } = foundry.data;

type FakeEffect = { id: string; name: string; transfer: boolean; parent?: unknown };

function fakeItem(effects: FakeEffect[]) {
	const item = {
		documentName: 'Item',
		uuid: 'Item.abc',
		effects: new Map<string, FakeEffect>(),
	};
	for (const effect of effects) item.effects.set(effect.id, { ...effect, parent: item });
	return item;
}

function effectField() {
	return new fields.StringField({
		required: true,
		nullable: false,
		blank: true,
		initial: '',
		widget: 'itemEffectPicker',
	} as never);
}

function renderPicker(item: unknown, value: string, onChange = vi.fn()) {
	const result = render(SchemaFieldRenderer, {
		field: effectField(),
		value,
		parentData: {},
		name: 'effectId',
		onChange,
		document: item as never,
	});
	const select = result.container.querySelector('select.nimble-item-effect-picker');
	return { ...result, select: select as HTMLSelectElement, onChange };
}

const optionsOf = (select: HTMLSelectElement) =>
	[...select.options].map((option) => [option.value, option.textContent?.trim()]);

describe('itemEffectPicker widget', () => {
	it('lists None and the effects of the item that are not applied to the actor, by name', () => {
		const item = fakeItem([
			{ id: 'b', name: 'Slowed', transfer: false },
			{ id: 'a', name: 'Burning', transfer: false },
			{ id: 'c', name: 'Passive Bonus', transfer: true },
		]);
		const { select } = renderPicker(item, '');

		expect(optionsOf(select)).toEqual([
			['', 'None'],
			['a', 'Burning'],
			['b', 'Slowed'],
		]);
		expect(select.value).toBe('');
	});

	it('shows a stored id that is not on the item as a missing effect, selected', () => {
		const item = fakeItem([{ id: 'a', name: 'Burning', transfer: false }]);
		const { select } = renderPicker(item, 'gone');

		expect(optionsOf(select)).toEqual([
			['', 'None'],
			['gone', 'Missing effect (gone)'],
			['a', 'Burning'],
		]);
		expect(select.value).toBe('gone');
	});

	it('writes the id of the chosen effect', async () => {
		const item = fakeItem([{ id: 'a', name: 'Burning', transfer: false }]);
		const { select, onChange } = renderPicker(item, '');

		await fireEvent.change(select, { target: { value: 'a' } });

		expect(onChange).toHaveBeenCalledWith('a');
	});

	it('updates when an effect is made on the item', async () => {
		const item = fakeItem([{ id: 'a', name: 'Burning', transfer: false }]);
		const { select } = renderPicker(item, '');

		const added = { id: 'z', name: 'Dazed', transfer: false, parent: item };
		item.effects.set('z', added);
		const hookCalls = (Hooks.on as unknown as ReturnType<typeof vi.fn>).mock.calls;
		const listener = hookCalls.filter(([hook]) => hook === 'createActiveEffect').at(-1)?.[1] as (
			effect: unknown,
		) => void;
		listener(added);
		await tick();

		expect(optionsOf(select).map(([id]) => id)).toEqual(['', 'a', 'z']);
	});

	it('shows a hint when the rule is not on an item', () => {
		const { select, container } = renderPicker(undefined, '');

		expect(optionsOf(select)).toEqual([['', 'None']]);
		expect(container.querySelector('.nimble-field-hint')?.textContent).toContain('not on an item');
	});
});
