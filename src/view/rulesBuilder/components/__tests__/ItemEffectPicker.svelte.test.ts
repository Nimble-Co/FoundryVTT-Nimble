import { fireEvent, render } from '@testing-library/svelte';
import { flushSync, tick } from 'svelte';
import { describe, expect, it, vi } from 'vitest';
import { createItemEffectPickerState } from '../ItemEffectPicker.svelte.js';
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

describe('createItemEffectPickerState', () => {
	it('lists the effects of the item that are not applied to the actor, by name', () => {
		const item = fakeItem([
			{ id: 'b', name: 'Slowed', transfer: false },
			{ id: 'a', name: 'Burning', transfer: false },
			{ id: 'c', name: 'Passive Bonus', transfer: true },
		]);
		const state = createItemEffectPickerState(
			() => item,
			() => '',
		);

		expect(state.hasItem).toBe(true);
		expect(state.options).toEqual([
			{ id: 'a', name: 'Burning' },
			{ id: 'b', name: 'Slowed' },
		]);
		expect(state.isMissing).toBe(false);
	});

	it('reads the item of a rule-holding effect', () => {
		const item = fakeItem([{ id: 'a', name: 'Burning', transfer: false }]);
		const holder = { documentName: 'ActiveEffect', parent: item };
		const state = createItemEffectPickerState(
			() => holder,
			() => '',
		);

		expect(state.options).toEqual([{ id: 'a', name: 'Burning' }]);
	});

	it('says a stored id that is not on the item is missing', () => {
		const item = fakeItem([{ id: 'a', name: 'Burning', transfer: false }]);

		expect(
			createItemEffectPickerState(
				() => item,
				() => 'gone',
			).isMissing,
		).toBe(true);
		expect(
			createItemEffectPickerState(
				() => item,
				() => 'a',
			).isMissing,
		).toBe(false);
	});

	it('has no item and no options when the rule is not on an item', () => {
		const state = createItemEffectPickerState(
			() => undefined,
			() => '',
		);

		expect(state.hasItem).toBe(false);
		expect(state.options).toEqual([]);
	});

	it('reads the options again when an effect is made on the item, not on another', async () => {
		const item = fakeItem([{ id: 'a', name: 'Burning', transfer: false }]);
		const state = createItemEffectPickerState(
			() => item,
			() => '',
		);
		let ids: string[] = [];
		const stop = $effect.root(() => {
			$effect(() => {
				ids = state.options.map((option) => option.id);
			});
		});
		flushSync();
		const call = vi
			.mocked(Hooks.on)
			.mock.calls.findLast(([hook]) => (hook as string) === 'createActiveEffect');
		const onCreate = call?.[1] as unknown as (effect: unknown) => void;

		const added = { id: 'z', name: 'Dazed', transfer: false, parent: item };
		item.effects.set('z', added);
		onCreate({ id: 'x', parent: { uuid: 'Item.other' } });
		flushSync();
		expect(ids).toEqual(['a']);

		onCreate(added);
		flushSync();
		expect(ids).toEqual(['a', 'z']);

		stop();
		await tick();
		expect(Hooks.off).toHaveBeenCalledWith('createActiveEffect', expect.anything());
	});
});

describe('itemEffectPicker widget', () => {
	function renderPicker(onChange = vi.fn()) {
		const result = render(SchemaFieldRenderer, {
			field: new fields.StringField({
				required: true,
				nullable: false,
				blank: true,
				initial: '',
				label: 'Effect',
				widget: 'itemEffectPicker',
			} as never),
			value: '',
			parentData: {},
			name: 'effectId',
			onChange,
			document: fakeItem([{ id: 'a', name: 'Burning', transfer: false }]) as never,
		});
		const select = result.container.querySelector('select.nimble-item-effect-picker');
		return { select: select as HTMLSelectElement, onChange };
	}

	it('names the select with the field label', () => {
		expect(renderPicker().select.getAttribute('aria-label')).toBe('Effect');
	});

	it('writes the id of the chosen effect', async () => {
		const { select, onChange } = renderPicker();

		await fireEvent.change(select, { target: { value: 'a' } });

		expect(onChange).toHaveBeenCalledWith('a');
	});
});
