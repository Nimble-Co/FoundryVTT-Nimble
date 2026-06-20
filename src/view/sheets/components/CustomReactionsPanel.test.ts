import { fireEvent, render, screen, waitFor } from '@testing-library/svelte';

import { isCustomReaction } from './CustomReactionsPanel.svelte.js';
import CustomReactionsPanelTestHarness from './CustomReactionsPanel.testHarness.svelte';

interface ReactionItemOptions {
	id: string;
	name: string;
	isReaction: boolean;
	quantity?: number;
	costType?: string;
	details?: string;
	description?: unknown;
	sort?: number;
}

function createItem(options: ReactionItemOptions) {
	const item = {
		_id: options.id,
		id: options.id,
		sort: options.sort ?? 0,
		type: 'feature',
		system: {
			activation: {
				cost: {
					type: options.costType ?? 'action',
					quantity: options.quantity ?? 1,
					isReaction: options.isReaction,
					details: options.details ?? '',
				},
			},
			description: options.description ?? '',
		},
		reactive: {
			name: options.name,
			img: `${options.id}.webp`,
		},
	};
	// `reactive` mirrors the document itself in the real model.
	(item.reactive as Record<string, unknown>)._id = options.id;
	return item;
}

function createActor(items: ReturnType<typeof createItem>[]) {
	return {
		id: 'custom-reaction-actor',
		activateItem: vi.fn().mockResolvedValue({ ok: true }),
		reactive: {
			items,
		},
	};
}

describe('isCustomReaction', () => {
	it('is true only when the activation cost has Is Reaction checked', () => {
		const reaction = createItem({ id: 'r', name: 'Parry', isReaction: true });
		const spell = createItem({ id: 's', name: 'Fireball', isReaction: false });

		expect(isCustomReaction(reaction as unknown as Item)).toBe(true);
		expect(isCustomReaction(spell as unknown as Item)).toBe(false);
	});

	it('is false when the item has no activation data', () => {
		expect(isCustomReaction({ system: {} } as unknown as Item)).toBe(false);
	});
});

describe('CustomReactionsPanel', () => {
	it('lists only items with "Is Reaction" checked', () => {
		const actor = createActor([
			createItem({ id: 'reaction-1', name: 'Counterspell', isReaction: true }),
			createItem({ id: 'not-a-reaction', name: 'Fireball', isReaction: false }),
		]);
		const application = { _onDragStart: vi.fn() };

		render(CustomReactionsPanelTestHarness, { actor, application });

		expect(screen.getByText('Counterspell')).toBeInTheDocument();
		expect(screen.queryByText('Fireball')).not.toBeInTheDocument();
	});

	it('shows the action cost only when it costs more than one action', () => {
		const actor = createActor([
			createItem({ id: 'single', name: 'Single', isReaction: true, quantity: 1 }),
			createItem({ id: 'double', name: 'Double', isReaction: true, quantity: 2 }),
		]);
		const application = { _onDragStart: vi.fn() };

		render(CustomReactionsPanelTestHarness, { actor, application });

		expect(screen.getByText('2 Actions')).toBeInTheDocument();
		expect(screen.queryByText('1 Action')).not.toBeInTheDocument();
	});

	it('shows the configured reaction trigger', () => {
		const actor = createActor([
			createItem({
				id: 'reaction-1',
				name: 'Parry',
				isReaction: true,
				details: 'When you are hit by a melee attack',
			}),
		]);
		const application = { _onDragStart: vi.fn() };

		render(CustomReactionsPanelTestHarness, { actor, application });

		expect(screen.getByText('When you are hit by a melee attack')).toBeInTheDocument();
	});

	it('activates the reaction when its card is clicked', async () => {
		const actor = createActor([
			createItem({ id: 'reaction-1', name: 'Counterspell', isReaction: true }),
		]);
		const application = { _onDragStart: vi.fn() };

		render(CustomReactionsPanelTestHarness, { actor, application });

		await fireEvent.click(screen.getByRole('button', { name: /counterspell/i }));

		expect(actor.activateItem).toHaveBeenCalledWith('reaction-1');
	});

	it('expands the description when the toggle is clicked', async () => {
		const actor = createActor([
			createItem({
				id: 'reaction-1',
				name: 'Counterspell',
				isReaction: true,
				description: '<p>Negate a spell.</p>',
			}),
		]);
		const application = { _onDragStart: vi.fn() };

		render(CustomReactionsPanelTestHarness, { actor, application });

		expect(screen.queryByText('Negate a spell.')).not.toBeInTheDocument();

		await fireEvent.click(screen.getByRole('button', { name: /expand/i }));

		await waitFor(() => expect(screen.getByText('Negate a spell.')).toBeInTheDocument());
	});
});
