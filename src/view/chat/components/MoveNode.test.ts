import { render, screen } from '@testing-library/svelte';
import MoveNodeTestHarness from './MoveNode.testHarness.svelte';

/**
 * The move node is a record, not a control: it states each stored offer and
 * what the finished Movement came to. It never carries a button.
 */

type Globals = { game: { settings: unknown } };

const g = globalThis as unknown as Globals;

const SPEAKER_TOKEN = 'Scene.s1.Token.hero';

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

function createSelfOffer(overrides: Record<string, unknown> = {}) {
	return createOffer({
		id: 'node1.hero',
		tokenUuid: SPEAKER_TOKEN,
		name: 'Sir Brannon',
		kind: 'free',
		ignoreDifficultTerrain: false,
		...overrides,
	});
}

const selfNode = (overrides: Record<string, unknown> = {}) =>
	createNode({
		kind: 'free',
		recipient: 'self',
		direction: 'any',
		chooser: 'mover',
		ignoreDifficultTerrain: false,
		...overrides,
	});

function createMessage(movementOffers: unknown[]) {
	const message = {
		id: 'msg1',
		speaker: { scene: 's1', token: 'hero', actor: 'a1' },
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

function nodeText(container: HTMLElement): string {
	return (container.querySelector('.nimble-move-node')?.textContent ?? '')
		.replace(/\s+/g, ' ')
		.trim();
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
	describe('an offer to the card speaker alone', () => {
		it('puts the distance on the heading line and shows no name', () => {
			const { container } = renderNode([createSelfOffer()], selfNode());
			expect(nodeText(container)).toBe('Free Move - up to 2 spaces');
			expect(screen.queryByText(/Sir Brannon/)).toBeNull();
		});

		it('puts the result on the heading line once settled', () => {
			const { container } = renderNode(
				[createSelfOffer({ state: 'taken', usedBy: 'player', movedSpaces: 2 })],
				selfNode(),
			);
			expect(nodeText(container)).toBe('Free Move - moved 2 of 2 spaces');
		});

		it('tags a Free Move that ignores difficult terrain', () => {
			const { container } = renderNode(
				[createSelfOffer({ ignoreDifficultTerrain: true })],
				selfNode({ ignoreDifficultTerrain: true }),
			);
			expect(nodeText(container)).toBe('Free Move - up to 2 spaces ignores difficult terrain');
		});
	});

	describe('offers to other creatures', () => {
		it('names the one recipient in a row, even when there is only one', () => {
			const { container } = renderNode();
			expect(nodeText(container)).toBe(
				'Forced Movement - away from Sir Brannon Goblin Cutthroat up to 2 spaces',
			);
			expect(screen.getByText('Goblin Cutthroat')).toBeTruthy();
		});

		it('names every recipient in its own row', () => {
			const { container } = renderNode([
				createOffer(),
				createOffer({
					id: 'node1.tok2',
					tokenUuid: 'Scene.s1.Token.tok2',
					name: 'Goblin Archer',
					spaces: 3,
				}),
			]);
			expect(container.querySelectorAll('.nimble-move-node__row')).toHaveLength(2);
			expect(screen.getByText('Goblin Cutthroat')).toBeTruthy();
			expect(screen.getByText('Goblin Archer')).toBeTruthy();
			expect(screen.getByText('up to 3 spaces')).toBeTruthy();
		});

		it('names the speaker too when it is one of several recipients', () => {
			renderNode([createSelfOffer(), createOffer()], selfNode({ recipient: 'targets' }));
			expect(screen.getByText('Sir Brannon')).toBeTruthy();
			expect(screen.getByText('Goblin Cutthroat')).toBeTruthy();
		});

		it('adds the result to the row after the distance', () => {
			const { container } = renderNode([
				createOffer({ state: 'taken', usedBy: 'player', movedSpaces: 2 }),
			]);
			expect(nodeText(container)).toContain(
				'Goblin Cutthroat up to 2 spaces - moved 2 of 2 spaces',
			);
		});
	});

	describe('direction', () => {
		it('shows toward the source', () => {
			renderNode([createOffer()], createNode({ direction: 'toward' }));
			expect(screen.getByText(/toward Sir Brannon/)).toBeTruthy();
		});

		it('shows nothing for any direction', () => {
			const { container } = renderNode([createOffer()], createNode({ direction: 'any' }));
			expect(nodeText(container)).toBe('Forced Movement Goblin Cutthroat up to 2 spaces');
			expect(screen.queryByText(/direction/)).toBeNull();
		});
	});

	describe('difficult terrain', () => {
		it('gives Forced Movement no tag', () => {
			renderNode();
			expect(screen.queryByText(/difficult terrain/)).toBeNull();
		});

		it('gives a Free Move that follows difficult terrain no tag', () => {
			renderNode([createSelfOffer()], selfNode());
			expect(screen.queryByText(/difficult terrain/)).toBeNull();
		});
	});

	it('shows no chooser line and no drag hint', () => {
		const { container } = renderNode();
		expect(nodeText(container)).not.toMatch(/chooses|Drag|ruler/);
	});

	it('shows the distance when Movement Offers is off', () => {
		g.game.settings = { get: vi.fn(() => false) };
		renderNode();
		expect(screen.getByText('up to 2 spaces')).toBeTruthy();
	});

	it('uses the singular for one space', () => {
		renderNode([createOffer({ spaces: 1, state: 'taken', movedSpaces: 1 })]);
		expect(screen.getByText('up to 1 space')).toBeTruthy();
		expect(screen.getByText(/- moved 1 of 1 space$/)).toBeTruthy();
	});

	describe('results', () => {
		it('reports a taken offer', () => {
			renderNode([createOffer({ state: 'taken', usedBy: 'player', movedSpaces: 2 })]);
			expect(screen.getByText(/- moved 2 of 2 spaces$/)).toBeTruthy();
			expect(screen.queryByText(/shortened by/)).toBeNull();
			expect(screen.queryByText(/1d6 bludgeoning/)).toBeNull();
		});

		it('reminds the table about damage when a push was cut short', () => {
			renderNode([
				createOffer({ state: 'taken', usedBy: 'player', movedSpaces: 1, stopped: true }),
			]);
			expect(screen.getByText(/- moved 1 of 2 spaces, shortened by 1$/)).toBeTruthy();
			expect(screen.getByText(/1d6 bludgeoning damage for every space shortened/)).toBeTruthy();
		});

		it('gives no damage reminder when a Free Move was cut short', () => {
			renderNode(
				[
					createSelfOffer({
						state: 'taken',
						usedBy: 'player',
						spaces: 6,
						movedSpaces: 4,
						stopped: true,
					}),
				],
				selfNode(),
			);
			expect(screen.getByText(/moved 4 of 6 spaces, shortened by 2/)).toBeTruthy();
			expect(screen.queryByText(/1d6 bludgeoning/)).toBeNull();
		});

		it('says so when the mover went their own way instead', () => {
			renderNode([createOffer({ state: 'unused', usedBy: 'player' })]);
			expect(screen.getByText(/- moved on its own$/)).toBeTruthy();
		});

		it('says so when the turn ended before the offer was taken', () => {
			renderNode([createOffer({ state: 'lapsed' })]);
			expect(screen.getByText(/- not taken before the turn ended$/)).toBeTruthy();
		});
	});

	it('shows only the offers of its own node', () => {
		renderNode([
			createOffer(),
			createOffer({ id: 'node2.tok2', nodeId: 'node2', name: 'Goblin Archer' }),
		]);
		expect(screen.getByText('Goblin Cutthroat')).toBeTruthy();
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
