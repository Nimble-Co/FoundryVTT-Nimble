import { fireEvent, render, screen } from '@testing-library/svelte';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ActorConditionsList from './ActorConditionsList.svelte';

function createActor({
	owner = true,
	statuses = ['blinded'],
}: {
	owner?: boolean;
	statuses?: string[];
} = {}): Actor.Implementation {
	return {
		id: 'actor-1',
		name: 'Hero',
		isOwner: owner,
		conditionsMetadata: {
			active: new Set(statuses),
			overlay: new Set<string>(),
		},
		toggleStatusEffect: vi.fn().mockResolvedValue(undefined),
	} as unknown as Actor.Implementation;
}

describe('ActorConditionsList', () => {
	beforeEach(() => {
		vi.clearAllMocks();

		(game.nimble.conditions as { get: (id: string) => unknown }).get = vi.fn((id: string) => ({
			id,
			name: CONFIG.NIMBLE.conditions[id] ?? id,
			img: CONFIG.NIMBLE.conditionDefaultImages[id] ?? '',
		}));
	});

	it('renders empty state when actor has no active conditions', () => {
		const actor = createActor({ statuses: [] });
		render(ActorConditionsList, { actor, mode: 'sheet', allowRemove: true });

		expect(screen.getByText('No conditions')).toBeInTheDocument();
	});

	it('renders condition rows in sheet mode with visible names', () => {
		const actor = createActor();
		render(ActorConditionsList, { actor, mode: 'sheet', allowRemove: true });

		expect(screen.getByText('Blinded')).toBeInTheDocument();
	});

	it('removes condition on right click in canvas mode', async () => {
		const actor = createActor();
		render(ActorConditionsList, { actor, mode: 'canvas', allowRemove: true });

		const rowButton = screen.getByRole('button', { name: /blinded/i });
		await fireEvent.contextMenu(rowButton);

		expect(actor.toggleStatusEffect).toHaveBeenCalledWith('blinded', { active: false });
	});

	it('shows delete button and removes condition in sheet mode', async () => {
		const actor = createActor();
		render(ActorConditionsList, { actor, mode: 'sheet', allowRemove: true });

		const removeButton = screen.getByRole('button', { name: 'Remove condition' });
		await fireEvent.click(removeButton);

		expect(actor.toggleStatusEffect).toHaveBeenCalledWith('blinded', { active: false });
	});

	it('hides remove controls when actor is not editable', () => {
		const actor = createActor({ owner: false });
		render(ActorConditionsList, { actor, mode: 'sheet', allowRemove: true });

		expect(screen.queryByRole('button', { name: 'Remove condition' })).not.toBeInTheDocument();
	});
});
