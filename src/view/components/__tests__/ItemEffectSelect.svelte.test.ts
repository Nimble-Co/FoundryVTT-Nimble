import { fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { flushSync, tick } from 'svelte';
import { describe, expect, it, vi } from 'vitest';
import { createItemEffectSelectState } from '../ItemEffectSelect.svelte.ts';
import ItemEffectSelect from './ItemEffectSelect.testHarness.svelte';

type FakeEffect = {
	id: string;
	name: string;
	transfer: boolean;
	img?: string;
	system?: Record<string, unknown>;
	parent?: unknown;
	sheet?: { render: ReturnType<typeof vi.fn> };
};

function fakeItem(effects: FakeEffect[], fields: Record<string, unknown> = {}) {
	const item = {
		documentName: 'Item',
		uuid: 'Item.abc',
		name: 'Rage',
		img: 'rage.svg',
		effects: new Map<string, FakeEffect>(),
		createEmbeddedDocuments: vi.fn(async () => [{ id: 'made' }]),
		deleteEmbeddedDocuments: vi.fn(async () => []),
		...fields,
	};
	for (const effect of effects) {
		item.effects.set(effect.id, { sheet: { render: vi.fn() }, ...effect, parent: item });
	}
	return item;
}

describe('createItemEffectSelectState', () => {
	it('lists the effects of the item that are not applied to the actor, by name', () => {
		const item = fakeItem([
			{ id: 'b', name: 'Slowed', transfer: false },
			{ id: 'a', name: 'Burning', transfer: false },
			{ id: 'c', name: 'Passive Bonus', transfer: true },
		]);
		const state = createItemEffectSelectState(
			() => item,
			() => null,
		);

		expect(state.options).toEqual([
			{ id: 'a', name: 'Burning' },
			{ id: 'b', name: 'Slowed' },
		]);
		expect(state.isMissing).toBe(false);
		expect(state.picked).toBeNull();
	});

	it('says a stored id that is not on the item is missing', () => {
		const item = fakeItem([{ id: 'a', name: 'Burning', transfer: false }]);

		expect(
			createItemEffectSelectState(
				() => item,
				() => 'gone',
			).isMissing,
		).toBe(true);
		expect(
			createItemEffectSelectState(
				() => item,
				() => 'a',
			).picked?.name,
		).toBe('Burning');
	});

	it('reads the options again when an effect is made on the item, not on another', async () => {
		const item = fakeItem([{ id: 'a', name: 'Burning', transfer: false }]);
		const state = createItemEffectSelectState(
			() => item,
			() => null,
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

describe('ItemEffectSelect', () => {
	it('ends the select with New effect, and opens the picked effect with the pencil', async () => {
		const item = fakeItem([
			{ id: 'b', name: 'Slowed', transfer: false },
			{ id: 'a', name: 'Burning', transfer: false },
		]);
		render(ItemEffectSelect, {
			props: { item, value: 'b', onchange: vi.fn(), recipient: 'targets', label: 'Effect' },
		});

		const options = screen.getAllByRole('option').map((option) => option.textContent?.trim());
		expect(options).toEqual(['No effect', 'Burning', 'Slowed', 'New effect']);
		await fireEvent.click(screen.getByRole('button', { name: 'Edit the effect' }));
		expect(item.effects.get('b')?.sheet?.render).toHaveBeenCalledWith(true);
	});

	it('shows the Lasts Until of the picked effect as the card row reads it', () => {
		const lastsUntil = [
			{ kind: 'event', event: 'zeroHp', who: 'holder', effectName: '', boundary: null },
		];
		const item = fakeItem([{ id: 'a', name: 'Raging', transfer: false, system: { lastsUntil } }]);

		const { rerender } = render(ItemEffectSelect, {
			props: { item, value: 'a', onchange: vi.fn(), recipient: 'targets', label: 'Effect' },
		});
		expect(screen.getByText('Until they drop to 0 HP')).toBeTruthy();

		rerender({ item, value: 'a', onchange: vi.fn(), recipient: 'self', label: 'Effect' });
		return waitFor(() => expect(screen.getByText('Until you drop to 0 HP')).toBeTruthy());
	});

	it('makes a new effect with the name and image of the item, and picks it', async () => {
		const item = fakeItem([]);
		const onchange = vi.fn();
		render(ItemEffectSelect, {
			props: { item, value: null, onchange, recipient: 'targets', label: 'Effect' },
		});

		await fireEvent.change(screen.getByRole('combobox', { name: 'Effect' }), {
			target: { value: '__new' },
		});

		await waitFor(() => expect(onchange).toHaveBeenCalledWith('made'));
		expect(item.createEmbeddedDocuments).toHaveBeenCalledWith('ActiveEffect', [
			{ name: 'Rage', img: 'rage.svg', type: 'nimble', transfer: false },
		]);
	});

	it('deletes the untouched effect it moves off, when nothing points at it', async () => {
		const blank = { id: 'old', name: 'Rage', img: 'rage.svg', transfer: false };
		const item = fakeItem([blank, { id: 'a', name: 'Burning', transfer: false }]);
		render(ItemEffectSelect, {
			props: { item, value: 'old', onchange: vi.fn(), recipient: 'targets', label: 'Effect' },
		});

		await fireEvent.change(screen.getByRole('combobox'), { target: { value: 'a' } });

		await waitFor(() =>
			expect(item.deleteEmbeddedDocuments).toHaveBeenCalledWith('ActiveEffect', ['old']),
		);
	});

	it('keeps the effect it moves off while a rule field of the item still holds it', async () => {
		const blank = { id: 'old', name: 'Rage', img: 'rage.svg', transfer: false };
		const item = fakeItem([blank, { id: 'a', name: 'Burning', transfer: false }], {
			system: { rules: [{ id: 'r', type: 'markTarget', effectId: 'old' }] },
		});
		const onchange = vi.fn();
		render(ItemEffectSelect, {
			props: { item, value: 'old', onchange, recipient: 'targets', label: 'Effect' },
		});

		await fireEvent.change(screen.getByRole('combobox'), { target: { value: 'a' } });

		await waitFor(() => expect(onchange).toHaveBeenCalledWith('a'));
		expect(item.deleteEmbeddedDocuments).not.toHaveBeenCalled();
	});

	it('puts the select back on the stored pick when a pick comes while the last one is stored', async () => {
		const item = fakeItem([
			{ id: 'a', name: 'Burning', transfer: false },
			{ id: 'b', name: 'Slowed', transfer: false },
		]);
		let finish: () => void = () => {};
		const onchange = vi.fn(() => new Promise<void>((resolve) => (finish = resolve)));
		render(ItemEffectSelect, {
			props: { item, value: null, onchange, recipient: 'targets', label: 'Effect' },
		});
		const select = screen.getByRole('combobox', { name: 'Effect' }) as HTMLSelectElement;

		await fireEvent.change(select, { target: { value: 'a' } });
		await waitFor(() => expect(onchange).toHaveBeenCalledWith('a'));
		await fireEvent.change(select, { target: { value: 'b' } });

		await waitFor(() => expect(select.value).toBe(''));
		expect(onchange).toHaveBeenCalledTimes(1);
		finish();
	});
});
