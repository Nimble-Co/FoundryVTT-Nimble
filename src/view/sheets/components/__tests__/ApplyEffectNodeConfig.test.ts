import { fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import ApplyEffectNodeConfig from './ApplyEffectNodeConfig.testHarness.svelte';

function makeItem() {
	const list = [
		{ id: 'fx', name: 'Taunted', transfer: false, sheet: { render: vi.fn() } },
		{ id: 'passive', name: 'Passive', transfer: true, sheet: { render: vi.fn() } },
	];
	const effects = {
		get: (id: string) => list.find((effect) => effect.id === id),
		has: (id: string) => list.some((effect) => effect.id === id),
		[Symbol.iterator]: () => list[Symbol.iterator](),
	};
	return {
		id: 'item1',
		name: 'Face Me!',
		img: 'face.svg',
		effects,
		update: vi.fn(async () => undefined),
		createEmbeddedDocuments: vi.fn(async () => [{ id: 'new' }]),
	};
}

function node(fields: Record<string, unknown> = {}) {
	return {
		id: 'n1',
		type: 'applyEffect',
		effectId: 'fx',
		recipient: 'targets',
		tempHealingNodeId: null,
		parentNode: null,
		parentContext: null,
		...fields,
	};
}

describe('ApplyEffectNodeConfig', () => {
	it('lists the effects that stay on the item, and opens the chosen one', async () => {
		const document = makeItem();
		const applyNode = node();
		render(ApplyEffectNodeConfig, {
			props: { document, effects: [applyNode] } as never,
		});

		const options = screen.getAllByRole('option').map((option) => option.textContent?.trim());
		expect(options).toEqual(['No effect', 'Taunted', 'New effect']);
		await fireEvent.click(screen.getByRole('button', { name: 'Edit the effect' }));
		expect(document.effects.get('fx')?.sheet.render).toHaveBeenCalledWith(true);
	});

	it('creates a new effect on the item and points the node at it', async () => {
		const document = makeItem();
		const applyNode = node({ effectId: null });
		render(ApplyEffectNodeConfig, {
			props: { document, effects: [applyNode] } as never,
		});

		await fireEvent.change(screen.getByRole('combobox'), { target: { value: '__new' } });

		await waitFor(() =>
			expect(document.update).toHaveBeenCalledWith({
				'system.activation.effects': [expect.objectContaining({ effectId: 'new' })],
			}),
		);
		expect(document.createEmbeddedDocuments).toHaveBeenCalledWith('ActiveEffect', [
			{ name: 'Face Me!', img: 'face.svg', type: 'nimble', transfer: false },
		]);
	});

	it('offers the temp healing of the same card only when there is one', () => {
		const document = makeItem();
		const applyNode = node();
		const temp = {
			id: 'h1',
			type: 'healing',
			healingType: 'tempHealing',
			formula: '2*@key',
			parentNode: null,
			parentContext: null,
		};
		render(ApplyEffectNodeConfig, {
			props: { document, effects: [applyNode, temp] } as never,
		});

		expect(screen.getByRole('option', { name: 'Temp healing 2*@key' })).toBeTruthy();
	});
});
