import { fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';
import SchemaFieldRenderer from '../SchemaFieldRenderer.svelte';

const { fields } = foundry.data;

type FakeEffect = { id: string; name: string; transfer: boolean; img?: string; parent?: unknown };

function fakeItem(effects: FakeEffect[]) {
	const item = {
		documentName: 'Item',
		uuid: 'Item.abc',
		name: 'Taunt',
		img: 'taunt.svg',
		system: { rules: [] as Record<string, unknown>[] },
		effects: new Map<string, FakeEffect>(),
		createEmbeddedDocuments: vi.fn(async () => [{ id: 'made' }]),
		deleteEmbeddedDocuments: vi.fn(async () => []),
	};
	for (const effect of effects) item.effects.set(effect.id, { ...effect, parent: item });
	return item;
}

function renderPicker(document: unknown, value = '', onChange = vi.fn()) {
	render(SchemaFieldRenderer, {
		field: new fields.StringField({
			required: true,
			nullable: false,
			blank: true,
			initial: '',
			label: 'Effect',
			widget: 'itemEffectPicker',
		} as never),
		value,
		parentData: {},
		name: 'effectId',
		onChange,
		document: document as never,
	});
	return { select: screen.getByRole('combobox', { name: 'Effect' }), onChange };
}

describe('itemEffectPicker widget', () => {
	it('writes the id of the chosen effect', async () => {
		const { select, onChange } = renderPicker(
			fakeItem([{ id: 'a', name: 'Burning', transfer: false }]),
		);

		await fireEvent.change(select, { target: { value: 'a' } });

		await waitFor(() => expect(onChange).toHaveBeenCalledWith('a'));
	});

	it('writes an empty id for no effect', async () => {
		const { select, onChange } = renderPicker(
			fakeItem([{ id: 'a', name: 'Burning', transfer: false }]),
			'a',
		);

		await fireEvent.change(select, { target: { value: '' } });

		await waitFor(() => expect(onChange).toHaveBeenCalledWith(''));
	});

	it('makes the new effect on the item of a rule-holding effect', async () => {
		const item = fakeItem([]);
		const { select, onChange } = renderPicker({ documentName: 'ActiveEffect', parent: item });

		await fireEvent.change(select, { target: { value: '__new' } });

		await waitFor(() => expect(onChange).toHaveBeenCalledWith('made'));
		expect(item.createEmbeddedDocuments).toHaveBeenCalledWith('ActiveEffect', [
			{ name: 'Taunt', img: 'taunt.svg', type: 'nimble', transfer: false },
		]);
	});

	it('deletes the untouched effect the rule field left, after the rule is stored', async () => {
		const item = fakeItem([
			{ id: 'old', name: 'Taunt', img: 'taunt.svg', transfer: false },
			{ id: 'a', name: 'Burning', transfer: false },
		]);
		item.system.rules = [{ id: 'r', type: 'markTarget', effectId: 'old' }];
		const onChange = vi.fn(async (next: string) => {
			item.system.rules = [{ id: 'r', type: 'markTarget', effectId: next }];
		});
		const { select } = renderPicker(item, 'old', onChange);

		await fireEvent.change(select, { target: { value: 'a' } });

		await waitFor(() =>
			expect(item.deleteEmbeddedDocuments).toHaveBeenCalledWith('ActiveEffect', ['old']),
		);
	});

	it('is off with a hint when the rule is not on an item', () => {
		const { select } = renderPicker({ documentName: 'Actor' });

		expect((select as HTMLSelectElement).disabled).toBe(true);
		expect(screen.getByText(/This rule is not on an item/)).toBeTruthy();
	});
});
