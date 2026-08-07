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
	chargePool?: { identifier: string; current: number; max: number };
}

function createItem(options: ReactionItemOptions) {
	const chargePool = options.chargePool;
	const item = {
		_id: options.id,
		id: options.id,
		sort: options.sort ?? 0,
		type: 'feature',
		rules: new Map(
			chargePool
				? [
						[
							'0',
							{
								type: 'chargePool',
								identifier: chargePool.identifier,
								max: String(chargePool.max),
								initial: 'max',
							},
						],
					]
				: [],
		),
		flags: {
			nimble: {
				chargePools: chargePool
					? { [chargePool.identifier]: { current: chargePool.current, max: chargePool.max } }
					: {},
			},
		},
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
	// The panel reads `items` as a list while the charge helpers read it as an
	// embedded collection, so the fixture answers to both shapes.
	const itemCollection = Object.assign(items, {
		contents: items,
		get: (id: string) => items.find((item) => item.id === id),
	});

	const actor = {
		id: 'custom-reaction-actor',
		type: 'character',
		flags: { nimble: { chargePools: {} } },
		items: itemCollection,
		getRollData: () => ({}),
		activateItem: vi.fn().mockResolvedValue({ ok: true }),
	} as Record<string, unknown>;

	actor.reactive = actor;

	return actor as typeof actor & { activateItem: ReturnType<typeof vi.fn> };
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

	it('shows the localized Free label for an explicit zero action cost', () => {
		const actor = createActor([
			createItem({ id: 'free-reaction', name: 'Sidestep', isReaction: true, quantity: 0 }),
		]);
		const application = { _onDragStart: vi.fn() };

		render(CustomReactionsPanelTestHarness, { actor, application });

		expect(screen.getByText('Free')).toBeInTheDocument();
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

	describe('charge indicators', () => {
		beforeAll(() => {
			// The badge tooltip escapes every interpolated value; the shared Foundry
			// mock has no escapeHTML, so stand one in for this suite only.
			(foundry.utils as unknown as { escapeHTML: (value: string) => string }).escapeHTML = (
				value: string,
			) => value;
		});

		it('shows the remaining charges on a reaction that has a pool', () => {
			const actor = createActor([
				createItem({
					id: 'reaction-1',
					name: 'Counterspell',
					isReaction: true,
					chargePool: { identifier: 'counterspell-uses', current: 1, max: 2 },
				}),
			]);
			const application = { _onDragStart: vi.fn() };

			render(CustomReactionsPanelTestHarness, { actor, application });

			expect(screen.getByText('1/2')).toBeInTheDocument();
		});

		it('leaves a reaction without pools untouched', () => {
			const actor = createActor([
				createItem({ id: 'reaction-1', name: 'Counterspell', isReaction: true }),
			]);
			const application = { _onDragStart: vi.fn() };

			const { container } = render(CustomReactionsPanelTestHarness, { actor, application });

			expect(container.querySelector('.charge-indicator')).not.toBeInTheDocument();
		});
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
