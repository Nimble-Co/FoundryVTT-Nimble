import { render, screen } from '@testing-library/svelte';
import MoveNodeTestHarness from './MoveNode.testHarness.svelte';

/**
 * The move node is a record, not a control: it states each stored offer, tells
 * the reader to drag the token while the offer stands, and reports what the
 * finished Movement came to. It never carries a button.
 */

type Globals = { game: { settings: unknown } };

const g = globalThis as unknown as Globals;

function createNode(overrides: Record<string, unknown> = {}) {
	return {
		id: 'node1',
		type: 'move',
		kind: 'forced',
		recipient: 'targets',
		distance: '2',
		distanceBySize: {},
		ignoreDifficultTerrain: true,
		direction: 'away',
		chooser: 'source',
		parentContext: null,
		parentNode: null,
		...overrides,
	};
}

function createOffer(overrides: Record<string, unknown> = {}) {
	return {
		id: 'node1.tok1',
		nodeId: 'node1',
		tokenUuid: 'Scene.s1.Token.tok1',
		name: 'Goblin Cutthroat',
		kind: 'forced',
		spaces: 2,
		ignoreDifficultTerrain: true,
		state: 'open',
		usedBy: null,
		movedSpaces: null,
		stopped: false,
		...overrides,
	};
}

function createMessage(movementOffers: unknown[]) {
	const message = {
		id: 'msg1',
		system: { actorName: 'Sir Brannon', movementOffers },
		reactive: null as unknown,
	};
	message.reactive = message;
	return message;
}

function renderNode(movementOffers: unknown[] = [createOffer()], node = createNode()) {
	return render(MoveNodeTestHarness, {
		props: { messageDocument: createMessage(movementOffers), node },
	});
}

let previousSettings: unknown;

beforeEach(() => {
	previousSettings = g.game.settings;
	g.game.settings = { get: vi.fn(() => true) };
});

afterEach(() => {
	g.game.settings = previousSettings;
});

describe('MoveNode', () => {
	it('states an open offer and tells the reader to drag the token', () => {
		renderNode();
		expect(screen.getByText(/Goblin Cutthroat: up to 2 spaces away from Sir Brannon/)).toBeTruthy();
		expect(screen.getByText(/Sir Brannon chooses where/)).toBeTruthy();
		expect(screen.getByText(/Drag Goblin Cutthroat: the ruler changes past 2 spaces/)).toBeTruthy();
	});

	it('leaves out the drag hint when Movement Offers is off', () => {
		g.game.settings = { get: vi.fn(() => false) };
		renderNode();
		expect(screen.getByText(/up to 2 spaces/)).toBeTruthy();
		expect(screen.queryByText(/the ruler changes/)).toBeNull();
	});

	it('offers nothing to drag for an offer of zero spaces', () => {
		renderNode([createOffer({ spaces: 0 })]);
		expect(screen.getByText(/up to 0 spaces/)).toBeTruthy();
		expect(screen.queryByText(/the ruler changes/)).toBeNull();
	});

	it('uses the singular for one space', () => {
		renderNode([createOffer({ spaces: 1 })]);
		expect(screen.getByText(/up to 1 space away/)).toBeTruthy();
		expect(screen.getByText(/the ruler changes past 1 space\./)).toBeTruthy();
	});

	it('names every recipient of a push', () => {
		renderNode([
			createOffer(),
			createOffer({
				id: 'node1.tok2',
				tokenUuid: 'Scene.s1.Token.tok2',
				name: 'Goblin Archer',
				spaces: 3,
			}),
		]);
		expect(screen.getByText(/Goblin Cutthroat: up to 2 spaces/)).toBeTruthy();
		expect(screen.getByText(/Goblin Archer: up to 3 spaces/)).toBeTruthy();
	});

	it('reports a taken offer in place of the drag hint', () => {
		renderNode([createOffer({ state: 'taken', usedBy: 'player', movedSpaces: 2 })]);
		expect(screen.getByText(/Goblin Cutthroat moved 2 of 2 spaces\./)).toBeTruthy();
		expect(screen.queryByText(/shortened by/)).toBeNull();
		expect(screen.queryByText(/the ruler changes/)).toBeNull();
		expect(screen.queryByText(/1d6 bludgeoning/)).toBeNull();
	});

	it('reminds the table about damage when a push was cut short', () => {
		renderNode([createOffer({ state: 'taken', usedBy: 'player', movedSpaces: 1, stopped: true })]);
		expect(screen.getByText(/moved 1 of 2 spaces, shortened by 1/)).toBeTruthy();
		expect(screen.getByText(/1d6 bludgeoning damage for every space shortened/)).toBeTruthy();
	});

	it('gives no damage reminder when a Free Move was cut short', () => {
		renderNode(
			[
				createOffer({
					kind: 'free',
					state: 'taken',
					usedBy: 'player',
					spaces: 6,
					movedSpaces: 4,
					stopped: true,
				}),
			],
			createNode({ kind: 'free', recipient: 'self', direction: 'any', chooser: 'mover' }),
		);
		expect(screen.getByText('Free Move')).toBeTruthy();
		expect(screen.getByText(/moved 4 of 6 spaces, shortened by 2/)).toBeTruthy();
		expect(screen.queryByText(/1d6 bludgeoning/)).toBeNull();
	});

	it('says so when the mover went their own way instead', () => {
		renderNode([createOffer({ state: 'unused', usedBy: 'player' })]);
		expect(screen.getByText(/Goblin Cutthroat moved on its own, so this went unused/)).toBeTruthy();
		expect(screen.queryByText(/the ruler changes/)).toBeNull();
	});

	it('shows only the offers of its own node', () => {
		renderNode([
			createOffer(),
			createOffer({ id: 'node2.tok2', nodeId: 'node2', name: 'Goblin Archer' }),
		]);
		expect(screen.getByText(/Goblin Cutthroat: up to 2 spaces/)).toBeTruthy();
		expect(screen.queryByText(/Goblin Archer/)).toBeNull();
	});

	it('says so when the card has no offer for this node', () => {
		renderNode([]);
		expect(screen.getByText(/No creature to move/)).toBeTruthy();
	});

	it('carries no button in any state', () => {
		for (const offer of [
			createOffer(),
			createOffer({ state: 'taken', movedSpaces: 1, stopped: true }),
			createOffer({ state: 'unused' }),
		]) {
			const { unmount } = renderNode([offer]);
			expect(screen.queryByRole('button')).toBeNull();
			unmount();
		}
		renderNode([]);
		expect(screen.queryByRole('button')).toBeNull();
	});
});
