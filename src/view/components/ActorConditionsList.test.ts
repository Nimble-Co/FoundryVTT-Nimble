import { fireEvent, render, screen } from '@testing-library/svelte';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ActorConditionsList from './ActorConditionsList.svelte';

function createActor({
	owner = true,
	statuses = ['blinded'],
	effects,
}: {
	owner?: boolean;
	statuses?: string[];
	effects?: ActiveEffect[];
} = {}): Actor.Implementation {
	return {
		id: 'actor-1',
		name: 'Hero',
		isOwner: owner,
		conditionsMetadata: {
			active: new Set(statuses),
			overlay: new Set<string>(),
		},
		effects:
			effects ??
			([
				{
					id: 'effect-condition',
					name: 'Blinded Condition Effect',
					statuses: new Set(['blinded']),
					duration: { rounds: 3 },
					sourceName: 'Spell',
				},
			] as unknown as ActiveEffect[]),
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

	it('renders no content in canvas mode when actor has no active conditions', () => {
		const actor = createActor({ statuses: [] });
		const { container } = render(ActorConditionsList, { actor, mode: 'canvas', allowRemove: true });

		expect(container.querySelector('.nimble-actor-conditions__icons')).not.toBeInTheDocument();
		expect(screen.queryByText('No conditions')).not.toBeInTheDocument();
	});

	it('renders condition rows and effect sections in sheet mode', () => {
		const actor = createActor();
		render(ActorConditionsList, { actor, mode: 'sheet', allowRemove: true });

		expect(screen.getAllByText('Blinded').length).toBeGreaterThan(0);
		expect(screen.getByText('Temporary Effects')).toBeInTheDocument();
		expect(screen.getByText('Passive Effects')).toBeInTheDocument();
	});

	it('removes condition on right click in canvas mode', async () => {
		const actor = createActor();
		render(ActorConditionsList, { actor, mode: 'canvas', allowRemove: true });

		const rowButton = screen.getByRole('button', { name: /blinded/i });
		expect(rowButton).toHaveAttribute(
			'data-tooltip-class',
			'nimble-tooltip nimble-tooltip--rules nimble-tooltip--condition',
		);
		expect(rowButton).toHaveAttribute('data-tooltip');
		expect(screen.getByText('3r')).toBeInTheDocument();
		await fireEvent.contextMenu(rowButton);

		expect(actor.toggleStatusEffect).toHaveBeenCalledWith('blinded', { active: false });
	});

	it('shows toggle button and can remove active conditions in sheet mode', async () => {
		const actor = createActor();
		render(ActorConditionsList, { actor, mode: 'sheet', allowRemove: true });

		const toggleButton = screen.getByRole('button', { name: 'Toggle Blinded' });
		const sheetRow = toggleButton.closest('.nimble-actor-conditions__catalog-item');
		expect(sheetRow).toHaveAttribute(
			'class',
			expect.stringContaining('nimble-document-card--active'),
		);

		await fireEvent.click(toggleButton);

		expect(actor.toggleStatusEffect).toHaveBeenCalledWith('blinded', { active: false });
	});

	it('shows apply toggle for inactive condition and activates it', async () => {
		const actor = createActor({ statuses: [] });
		render(ActorConditionsList, { actor, mode: 'sheet', allowRemove: true });

		const applyButton = screen.getByRole('button', { name: 'Toggle Blinded' });
		await fireEvent.click(applyButton);

		expect(actor.toggleStatusEffect).toHaveBeenCalledWith('blinded', { active: true });
	});

	it('does not include standard condition effects in temporary/passive effect sections', () => {
		const actor = createActor({
			effects: [
				{
					id: 'effect-condition',
					name: 'Blinded Condition Effect',
					statuses: new Set(['blinded']),
					duration: { rounds: 2 },
				},
				{
					id: 'effect-haste',
					name: 'Haste',
					statuses: new Set(['haste']),
					duration: { rounds: 2 },
				},
			] as unknown as ActiveEffect[],
		});

		render(ActorConditionsList, { actor, mode: 'sheet', allowRemove: true });

		expect(screen.queryByText('Blinded Condition Effect')).not.toBeInTheDocument();
		expect(screen.getByText('Haste')).toBeInTheDocument();
	});

	it('hides condition toggle controls when actor is not editable', () => {
		const actor = createActor({ owner: false });
		render(ActorConditionsList, { actor, mode: 'sheet', allowRemove: true });

		expect(screen.queryByRole('button', { name: 'Toggle Blinded' })).not.toBeInTheDocument();
	});
});
