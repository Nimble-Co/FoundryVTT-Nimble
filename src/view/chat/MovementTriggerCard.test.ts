import { fireEvent, render, screen } from '@testing-library/svelte';
import MovementTriggerCard from './MovementTriggerCard.svelte';

type Globals = Record<string, any>;
const g = globalThis as Globals;

const activateItem = vi.fn(async () => null);
const setTargets = vi.fn();

function createItem(isOwner = true) {
	return { id: 'i1', name: 'Quick Strike', isOwner, actor: { activateItem } };
}

let documents: Record<string, unknown> = {};

function createMessage(system: Record<string, unknown> = {}) {
	const message = {
		id: 'msg1',
		timestamp: 0,
		author: { color: '#336699' },
		system: {
			actorName: 'Hero',
			name: 'Quick Strike',
			itemUuid: 'Actor.hero.Item.i1',
			payload: 'offer',
			message: 'Goblin moved next to Hero.',
			targets: ['Scene.s.Token.gob', 'Scene.s.Token.gone', 'Scene.s.Token.ogre'],
			moverName: 'Goblin',
			spaces: 3,
			spacesThisTurn: 3,
			...system,
		},
		reactive: null as unknown,
		delete: vi.fn(),
	};
	message.reactive = message;
	return message;
}

function renderCard(system: Record<string, unknown> = {}) {
	return render(MovementTriggerCard, {
		props: { messageDocument: createMessage(system) as never },
	});
}

const useButton = () => screen.queryByRole('button', { name: /Use Quick Strike/ });

let previous: Record<string, unknown>;

beforeEach(() => {
	previous = {
		fromUuidSync: g.fromUuidSync,
		canvas: g.canvas,
		timeSince: g.foundry.utils.timeSince,
	};
	documents = {
		'Actor.hero.Item.i1': createItem(),
		'Scene.s.Token.gob': { id: 'gob', name: 'Goblin', object: {} },
		'Scene.s.Token.ogre': { id: 'ogre', name: 'Ogre', object: {} },
	};
	g.fromUuidSync = vi.fn((uuid: string) => documents[uuid] ?? null);
	g.canvas = { tokens: { setTargets } };
	g.foundry.utils.timeSince = () => 'now';
});

afterEach(() => {
	g.fromUuidSync = previous.fromUuidSync;
	g.canvas = previous.canvas;
	g.foundry.utils.timeSince = previous.timeSince;
});

describe('MovementTriggerCard', () => {
	it('shows the feature name, the message and the creatures it found', () => {
		renderCard();
		expect(screen.getByRole('heading', { name: 'Quick Strike' })).toBeTruthy();
		expect(screen.getByText('Goblin moved next to Hero.')).toBeTruthy();
		expect(screen.getByText('Creatures: Goblin, Ogre')).toBeTruthy();
	});

	it('leaves out the creatures line when the trigger found none', () => {
		renderCard({ targets: [] });
		expect(screen.queryByText(/Creatures:/)).toBeNull();
	});

	it('shows a use button on an offer to the owner of the item', () => {
		renderCard();
		expect(useButton()).toBeTruthy();
	});

	it('shows no use button on a reminder', () => {
		renderCard({ payload: 'reminder' });
		expect(useButton()).toBeNull();
	});

	it('shows no use button to a user who does not own the item', () => {
		documents['Actor.hero.Item.i1'] = createItem(false);
		renderCard();
		expect(useButton()).toBeNull();
	});

	it('shows no use button when the item is gone', () => {
		delete documents['Actor.hero.Item.i1'];
		renderCard();
		expect(useButton()).toBeNull();
	});

	it("targets exactly the card's creatures, then uses the item, each time it is clicked", async () => {
		renderCard();
		await fireEvent.click(useButton()!);

		expect(setTargets).toHaveBeenCalledWith(['gob', 'ogre'], { mode: 'replace' });
		expect(activateItem).toHaveBeenCalledWith('i1');
		expect(setTargets.mock.invocationCallOrder[0]).toBeLessThan(
			activateItem.mock.invocationCallOrder[0],
		);

		await fireEvent.click(useButton()!);
		expect(activateItem).toHaveBeenCalledTimes(2);
	});

	it('targets only the creatures on the viewed scene', async () => {
		documents['Scene.s.Token.ogre'] = { id: 'ogre', name: 'Ogre', object: null };
		renderCard();
		await fireEvent.click(useButton()!);
		expect(setTargets).toHaveBeenCalledWith(['gob'], { mode: 'replace' });
	});
});
