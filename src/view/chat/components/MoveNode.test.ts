import { render, screen } from '@testing-library/svelte';
import MoveNodeTestHarness from './MoveNode.testHarness.svelte';

/**
 * The states a move node renders in: an offer with its Move button for the
 * recipient's owner, text only for everyone else or with the toggle off, and
 * the recorded result once the drag landed.
 */

type Globals = {
	fromUuidSync: unknown;
	game: { user: unknown; settings: unknown };
	Roll: { replaceFormulaData?: unknown; safeEval?: unknown };
};

const g = globalThis as unknown as Globals;

function createToken(overrides: { isOwner?: boolean; walk?: number } = {}) {
	return {
		id: 'tok1',
		uuid: 'Scene.s1.Token.tok1',
		name: 'Goblin Cutthroat',
		actor: {
			isOwner: overrides.isOwner ?? true,
			getRollData: () => ({}),
			system: { attributes: { movement: { walk: overrides.walk ?? 6 }, sizeCategory: 'medium' } },
		},
	};
}

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

function createMessage(
	overrides: { targets?: string[]; movementOffers?: unknown[]; speaker?: unknown } = {},
) {
	const message = {
		id: 'msg1',
		speaker: overrides.speaker ?? { scene: 's1', token: 'tok1' },
		system: {
			actorName: 'Sir Brannon',
			targets: overrides.targets ?? ['Scene.s1.Token.tok1'],
			movementOffers: overrides.movementOffers ?? [],
		},
		reactive: null as unknown,
	};
	message.reactive = message;
	return message;
}

let previous: Partial<Globals> & { rollReplace?: unknown; rollEval?: unknown } = {};

beforeEach(() => {
	previous = {
		fromUuidSync: g.fromUuidSync,
		game: { user: g.game.user, settings: g.game.settings },
		rollReplace: g.Roll.replaceFormulaData,
		rollEval: g.Roll.safeEval,
	};
	g.fromUuidSync = vi.fn(() => createToken());
	g.game.user = { isGM: false, id: 'player' };
	g.game.settings = { get: vi.fn(() => true) };
	g.Roll.replaceFormulaData = (formula: string) => formula;
	g.Roll.safeEval = (expression: string) => Number(expression);
});

afterEach(() => {
	g.fromUuidSync = previous.fromUuidSync;
	g.game.user = previous.game?.user;
	g.game.settings = previous.game?.settings;
	g.Roll.replaceFormulaData = previous.rollReplace;
	g.Roll.safeEval = previous.rollEval;
});

function moveButton() {
	return screen.queryByRole('button', { name: /move \(up to 2\)/i });
}

describe('MoveNode', () => {
	it('offers the drag to the recipient owner with the distance and direction', () => {
		render(MoveNodeTestHarness, {
			props: { messageDocument: createMessage(), node: createNode() },
		});
		expect(screen.getByText(/Goblin Cutthroat: up to 2 spaces away from Sir Brannon/)).toBeTruthy();
		expect(screen.getByText(/Sir Brannon chooses where/)).toBeTruthy();
		expect(moveButton()).toBeTruthy();
	});

	it('shows text only to a user who does not own the recipient', () => {
		g.fromUuidSync = vi.fn(() => createToken({ isOwner: false }));
		render(MoveNodeTestHarness, {
			props: { messageDocument: createMessage(), node: createNode() },
		});
		expect(screen.getByText(/up to 2 spaces/)).toBeTruthy();
		expect(moveButton()).toBeNull();
	});

	it('always offers the button to the GM', () => {
		g.fromUuidSync = vi.fn(() => createToken({ isOwner: false }));
		g.game.user = { isGM: true, id: 'gm' };
		render(MoveNodeTestHarness, {
			props: { messageDocument: createMessage(), node: createNode() },
		});
		expect(moveButton()).toBeTruthy();
	});

	it('shows text only when Movement Offers is off', () => {
		g.game.settings = { get: vi.fn(() => false) };
		render(MoveNodeTestHarness, {
			props: { messageDocument: createMessage(), node: createNode() },
		});
		expect(screen.getByText(/up to 2 spaces/)).toBeTruthy();
		expect(moveButton()).toBeNull();
	});

	it('resolves @speed against the recipient for a self free move', () => {
		g.Roll.safeEval = (expression: string) => Number(expression.replace('@speed', '6'));
		g.Roll.replaceFormulaData = (formula: string) => formula.replace('@speed', '6');
		const node = createNode({
			kind: 'free',
			recipient: 'self',
			distance: '@speed',
			direction: 'any',
		});
		render(MoveNodeTestHarness, { props: { messageDocument: createMessage(), node } });
		expect(screen.getByText(/up to 6 spaces in any direction/)).toBeTruthy();
	});

	it('replaces the button with the result once the drag landed', () => {
		const message = createMessage({
			movementOffers: [
				{
					id: 'msg1.node1.tok1',
					nodeId: 'node1',
					tokenUuid: 'Scene.s1.Token.tok1',
					spaces: 2,
					used: true,
					usedBy: 'player',
					movedSpaces: 1,
					stopped: true,
				},
			],
		});
		render(MoveNodeTestHarness, { props: { messageDocument: message, node: createNode() } });
		expect(screen.getByText(/moved 1 of 2 spaces, shortened by 1/)).toBeTruthy();
		expect(moveButton()).toBeNull();
	});

	it('says so when the card has no creature to move', () => {
		render(MoveNodeTestHarness, {
			props: { messageDocument: createMessage({ targets: [] }), node: createNode() },
		});
		expect(screen.getByText(/No creature to move/)).toBeTruthy();
	});
});
