import { fireEvent, render, screen, waitFor, within } from '@testing-library/svelte';
import { flushSync } from 'svelte';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ItemEffectsTab from './ItemEffectsTab.testHarness.svelte';

type FakeEffect = {
	id: string;
	name: string;
	transfer: boolean;
	img?: string;
	parent?: unknown;
	sheet: { render: ReturnType<typeof vi.fn> };
};

const applyNode = (id: string, effectId: string | null) => ({
	id,
	type: 'applyEffect',
	effectId,
	recipient: 'self',
	parentContext: null,
	parentNode: null,
});

function makeItem() {
	const made: FakeEffect = { id: 'made', name: 'Rage', transfer: true, sheet: { render: vi.fn() } };
	const item = {
		uuid: 'Item.rage',
		name: 'Rage',
		img: 'rage.svg',
		system: {
			activation: { effects: [applyNode('n1', 'raging')] },
			rules: [{ id: 'r1', type: 'markTarget', effectId: 'raging' }],
		},
		effects: new Map<string, FakeEffect>(),
		get reactive() {
			return item;
		},
		update: vi.fn(async () => undefined),
		createEmbeddedDocuments: vi.fn(async () => [made]),
		deleteEmbeddedDocuments: vi.fn(async () => []),
	};
	const add = (effect: Omit<FakeEffect, 'sheet' | 'parent'>) =>
		item.effects.set(effect.id, { ...effect, parent: item, sheet: { render: vi.fn() } });
	add({ id: 'raging', name: 'Raging', transfer: false });
	add({ id: 'tough', name: 'Tough Skin', transfer: true });
	return { item, made, add };
}

function confirmMock() {
	return vi.mocked(foundry.applications.api.DialogV2.confirm);
}

function list(name: string) {
	return screen.getByRole('region', { name });
}

describe('ItemEffectsTab', () => {
	beforeEach(() => confirmMock().mockReset());

	it('puts each effect in its list, with what uses it', () => {
		const { item } = makeItem();
		render(ItemEffectsTab, { props: { item } });

		const given = list('Given when something uses them');
		expect(within(given).getByText('Raging')).toBeTruthy();
		expect(
			within(given).getByText('Used by: On use: Apply Effect, Rule: Mark Target'),
		).toBeTruthy();

		const alwaysOn = list('Always on while you have this item');
		expect(within(alwaysOn).getByText('Tough Skin')).toBeTruthy();
		expect(within(alwaysOn).getByText('Nothing uses this effect.')).toBeTruthy();
	});

	it('makes a new effect with the transfer of its list and opens it', async () => {
		const { item, made } = makeItem();
		render(ItemEffectsTab, { props: { item } });

		const alwaysOn = list('Always on while you have this item');
		await fireEvent.click(within(alwaysOn).getByRole('button', { name: 'New effect' }));

		expect(item.createEmbeddedDocuments).toHaveBeenCalledWith('ActiveEffect', [
			{ name: 'Rage', img: 'rage.svg', type: 'nimble', transfer: true },
		]);
		await waitFor(() => expect(made.sheet.render).toHaveBeenCalledWith(true));
	});

	it('opens the effect window with the edit button', async () => {
		const { item } = makeItem();
		render(ItemEffectsTab, { props: { item } });

		await fireEvent.click(screen.getByRole('button', { name: 'Edit Raging' }));

		expect(item.effects.get('raging')?.sheet.render).toHaveBeenCalledWith(true);
	});

	it('names the users in the delete confirm, and clears them on yes', async () => {
		const { item } = makeItem();
		confirmMock().mockResolvedValue(true as never);
		render(ItemEffectsTab, { props: { item } });

		await fireEvent.click(screen.getByRole('button', { name: 'Delete Raging' }));

		await waitFor(() =>
			expect(item.deleteEmbeddedDocuments).toHaveBeenCalledWith('ActiveEffect', ['raging']),
		);
		const content = (confirmMock().mock.calls[0]?.[0] as { content: string }).content;
		expect(content).toContain('Used by: On use: Apply Effect, Rule: Mark Target.');
		expect(item.update).toHaveBeenCalledWith({
			'system.activation.effects': [applyNode('n1', null)],
			'system.rules': [{ id: 'r1', type: 'markTarget', effectId: '' }],
		});
	});

	it('deletes nothing when the confirm is answered no', async () => {
		const { item } = makeItem();
		confirmMock().mockResolvedValue(false as never);
		render(ItemEffectsTab, { props: { item } });

		await fireEvent.click(screen.getByRole('button', { name: 'Delete Tough Skin' }));

		await waitFor(() => expect(confirmMock()).toHaveBeenCalled());
		const content = (confirmMock().mock.calls[0]?.[0] as { content: string }).content;
		expect(content).not.toContain('Used by');
		expect(item.deleteEmbeddedDocuments).not.toHaveBeenCalled();
	});

	it('draws a new row when an effect is made on the item', () => {
		const { item, add } = makeItem();
		render(ItemEffectsTab, { props: { item } });
		const onCreate = vi
			.mocked(Hooks.on)
			.mock.calls.findLast(([hook]) => (hook as string) === 'createActiveEffect')?.[1] as
			| ((effect: unknown) => void)
			| undefined;

		add({ id: 'fresh', name: 'Fury', transfer: false });
		onCreate?.(item.effects.get('fresh'));
		flushSync();

		expect(within(list('Given when something uses them')).getByText('Fury')).toBeTruthy();
	});
});
