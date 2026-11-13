import { fireEvent, render, screen } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from 'vitest';
import ActorConditionsList from '../ActorConditionsList.svelte';

function confirmMock(): Mock {
	return (
		globalThis as unknown as {
			foundry: { applications: { api: { DialogV2: { confirm: Mock } } } };
		}
	).foundry.applications.api.DialogV2.confirm;
}

function createActor({
	owner = true,
	statuses = ['blinded'],
	effects,
}: {
	owner?: boolean;
	statuses?: string[];
	effects?: ActiveEffect[];
} = {}): Actor.Implementation {
	const actor = {
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
		deleteEmbeddedDocuments: vi.fn().mockResolvedValue([]),
	} as Record<string, unknown>;

	// Component accesses actor.reactive (which proxies back to actor)
	actor.reactive = {
		...actor,
		flags: { nimble: { editingEnabled: owner } },
	};

	return actor as unknown as Actor.Implementation;
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
		const actor = createActor({ statuses: [], effects: [] });
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

	it('removes non-standard status icons by deleting matching active effects', async () => {
		const actor = createActor({
			statuses: [],
			effects: [
				{
					id: 'effect-haste',
					name: 'Test Haste',
					img: 'icons/svg/aura.svg',
					statuses: new Set(['test-haste']),
					duration: { rounds: 2 },
				},
			] as unknown as ActiveEffect[],
		});

		render(ActorConditionsList, { actor, mode: 'canvas', allowRemove: true });
		const button = screen.getByRole('button', { name: 'test-haste' });
		await fireEvent.contextMenu(button);

		expect(actor.deleteEmbeddedDocuments).toHaveBeenCalledWith('ActiveEffect', ['effect-haste']);
		expect(actor.toggleStatusEffect).not.toHaveBeenCalledWith('test-haste', { active: false });
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
		const actor = createActor({ statuses: [], effects: [] });
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

	it('allows removing temporary effects from sheet without confirmation', async () => {
		const effectDelete = vi.fn().mockResolvedValue(undefined);
		const actor = createActor({
			effects: [
				{
					id: 'effect-haste',
					name: 'Haste',
					statuses: new Set(['haste']),
					duration: { rounds: 2 },
					delete: effectDelete,
				},
			] as unknown as ActiveEffect[],
		});

		render(ActorConditionsList, { actor, mode: 'sheet', allowRemove: true });
		const removeEffectButton = screen.getByRole('button', { name: 'Remove effect' });
		await fireEvent.click(removeEffectButton);

		expect(effectDelete).toHaveBeenCalledTimes(1);
		expect(confirmMock()).not.toHaveBeenCalled();
	});

	it('shows non-standard effect statuses in canvas mode', () => {
		const actor = createActor({
			statuses: [],
			effects: [
				{
					id: 'effect-haste',
					name: 'Test Haste',
					img: 'icons/svg/aura.svg',
					statuses: new Set(['test-haste']),
					duration: { rounds: 2 },
				},
			] as unknown as ActiveEffect[],
		});

		render(ActorConditionsList, { actor, mode: 'canvas', allowRemove: true });
		expect(screen.getByRole('button', { name: 'test-haste' })).toBeInTheDocument();
		expect(screen.getByText('2r')).toBeInTheDocument();
	});

	it('hides condition toggle controls when actor is not editable', () => {
		const actor = createActor({ owner: false });
		render(ActorConditionsList, { actor, mode: 'sheet', allowRemove: true });

		expect(screen.queryByRole('button', { name: 'Toggle Blinded' })).not.toBeInTheDocument();
	});

	describe('an effect that an item use gave', () => {
		const ITEM_UUID = 'Actor.actor-1.Item.rage-item';

		function createGivenEffect() {
			return {
				id: 'ae-rage',
				name: 'Rage',
				img: 'icons/svg/aura.svg',
				origin: ITEM_UUID,
				statuses: new Set<string>(),
				parent: { documentName: 'Actor' },
				delete: vi.fn().mockResolvedValue(undefined),
			};
		}

		function stubOriginItem(effects: { id: string; name: string; transfer: boolean }[] | null) {
			const item = effects
				? {
						documentName: 'Item',
						effects: Object.assign([...effects], {
							get: (id: string) => effects.find((each) => each.id === id),
						}),
					}
				: null;
			vi.stubGlobal(
				'fromUuidSync',
				vi.fn((uuid: string) => (uuid === ITEM_UUID ? item : null)),
			);
		}

		afterEach(() => {
			vi.unstubAllGlobals();
		});

		it('lists it in the Temporary Effects with the trash button', () => {
			stubOriginItem(null);
			const actor = createActor({
				statuses: [],
				effects: [createGivenEffect()] as unknown as ActiveEffect[],
			});

			render(ActorConditionsList, { actor, mode: 'sheet', allowRemove: true });

			const temporarySection = screen
				.getByText('Temporary Effects')
				.closest('.nimble-actor-conditions__section') as HTMLElement;
			expect(temporarySection).toHaveTextContent('Rage');
			expect(screen.getByRole('button', { name: 'Remove effect' })).toBeInTheDocument();
		});

		it('asks a plain question when the item still has the effect and can give it again', async () => {
			stubOriginItem([{ id: 'raging', name: 'Rage', transfer: false }]);
			confirmMock().mockResolvedValue(true);
			const effect = createGivenEffect();
			const actor = createActor({ statuses: [], effects: [effect] as unknown as ActiveEffect[] });

			render(ActorConditionsList, { actor, mode: 'sheet', allowRemove: true });
			await fireEvent.click(screen.getByRole('button', { name: 'Remove effect' }));

			expect(confirmMock()).toHaveBeenCalledWith(
				expect.objectContaining({ content: '<p>Delete Rage?</p>' }),
			);
			expect(effect.delete).toHaveBeenCalledTimes(1);
		});

		it('escapes the effect name in the question', async () => {
			stubOriginItem([{ id: 'raging', name: '<b>Rage</b>', transfer: false }]);
			confirmMock().mockResolvedValue(false);
			const effect = { ...createGivenEffect(), name: '<b>Rage</b>' };
			const actor = createActor({ statuses: [], effects: [effect] as unknown as ActiveEffect[] });

			render(ActorConditionsList, { actor, mode: 'sheet', allowRemove: true });
			await fireEvent.click(screen.getByRole('button', { name: 'Remove effect' }));

			expect(confirmMock()).toHaveBeenCalledWith(
				expect.objectContaining({ content: '<p>Delete &lt;b&gt;Rage&lt;/b&gt;?</p>' }),
			);
		});

		it('says that it cannot come back when the item no longer has the effect', async () => {
			stubOriginItem([{ id: 'other', name: 'Stoneskin', transfer: false }]);
			confirmMock().mockResolvedValue(false);
			const effect = createGivenEffect();
			const actor = createActor({ statuses: [], effects: [effect] as unknown as ActiveEffect[] });

			render(ActorConditionsList, { actor, mode: 'sheet', allowRemove: true });
			await fireEvent.click(screen.getByRole('button', { name: 'Remove effect' }));

			expect(confirmMock()).toHaveBeenCalledWith(
				expect.objectContaining({
					content: expect.stringContaining('cannot be restored without re-adding the item'),
				}),
			);
			expect(effect.delete).not.toHaveBeenCalled();
		});
	});

	describe('item-granted effects', () => {
		function createItemEffect({ id = 'ae-stoneskin', name = 'Stoneskin' } = {}) {
			return {
				id,
				name,
				img: 'icons/svg/shield.svg',
				statuses: new Set<string>(),
				parent: { documentName: 'Item' },
				delete: vi.fn().mockResolvedValue(undefined),
			};
		}

		function createActorWithItemEffect(itemEffect = createItemEffect()) {
			const actor = createActor({ statuses: [], effects: [] });
			// Item-transferred effects only surface through allApplicableEffects.
			(actor as unknown as Record<string, unknown>).allApplicableEffects = function* () {
				yield itemEffect;
			};
			return { actor, itemEffect };
		}

		it('lists item-transferred effects from allApplicableEffects in the passive bucket', () => {
			const { actor } = createActorWithItemEffect();

			render(ActorConditionsList, { actor, mode: 'sheet', allowRemove: true });

			const passiveSection = screen
				.getByText('Passive Effects')
				.closest('.nimble-actor-conditions__section') as HTMLElement;
			expect(passiveSection).toHaveTextContent('Stoneskin');
		});

		it('asks for confirmation and aborts deletion when declined', async () => {
			confirmMock().mockResolvedValue(false);
			const { actor, itemEffect } = createActorWithItemEffect();

			render(ActorConditionsList, { actor, mode: 'sheet', allowRemove: true });
			await fireEvent.click(screen.getByRole('button', { name: 'Remove effect' }));

			expect(confirmMock()).toHaveBeenCalledTimes(1);
			expect(itemEffect.delete).not.toHaveBeenCalled();
		});

		it('deletes the item-granted effect through its own document when confirmed', async () => {
			confirmMock().mockResolvedValue(true);
			const { actor, itemEffect } = createActorWithItemEffect();

			render(ActorConditionsList, { actor, mode: 'sheet', allowRemove: true });
			await fireEvent.click(screen.getByRole('button', { name: 'Remove effect' }));

			expect(confirmMock()).toHaveBeenCalledTimes(1);
			expect(itemEffect.delete).toHaveBeenCalledTimes(1);
		});

		it('shows item-granted effects on the canvas panel and confirms on right click', async () => {
			confirmMock().mockResolvedValue(true);
			const { actor, itemEffect } = createActorWithItemEffect();

			render(ActorConditionsList, { actor, mode: 'canvas', allowRemove: true });
			await fireEvent.contextMenu(screen.getByRole('button', { name: 'Stoneskin' }));

			expect(confirmMock()).toHaveBeenCalledTimes(1);
			expect(itemEffect.delete).toHaveBeenCalledTimes(1);
		});
	});
});
