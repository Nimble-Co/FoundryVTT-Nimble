import { render, screen } from '@testing-library/svelte';
import MoveNodeTestHarness from './MoveNode.testHarness.svelte';

/**
 * The move node is a record, not a control: it states the offer while it
 * stands, tells the reader to drag the token, and reports what the finished
 * Movement came to. It never carries a button.
 */

type Globals = {
	fromUuidSync: unknown;
	game: { user: unknown; settings: unknown };
	Roll: { replaceFormulaData?: unknown; safeEval?: unknown };
};

const g = globalThis as unknown as Globals;

function createToken(overrides: { id?: string; name?: string; walk?: number } = {}) {
	const id = overrides.id ?? 'tok1';
	return {
		id,
		uuid: `Scene.s1.Token.${id}`,
		name: overrides.name ?? 'Goblin Cutthroat',
		actor: {
			getRollData: () => ({ abilities: { strength: { mod: 0 } } }),
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
	node: Record<string, unknown>,
	overrides: { targets?: string[]; movementOffers?: unknown[] } = {},
) {
	const message = {
		id: 'msg1',
		author: { id: 'author' },
		speaker: { scene: 's1', token: 'tok1', actor: 'actor1' },
		system: {
			actorName: 'Sir Brannon',
			targets: overrides.targets ?? ['Scene.s1.Token.tok1'],
			movementOffers: overrides.movementOffers ?? [],
			activation: { effects: [node] },
		},
		reactive: null as unknown,
	};
	message.reactive = message;
	return message;
}

function renderNode(node = createNode(), overrides: Parameters<typeof createMessage>[1] = {}) {
	return render(MoveNodeTestHarness, {
		props: { messageDocument: createMessage(node, overrides), node },
	});
}

function takenEntry(over: Record<string, unknown> = {}) {
	return {
		id: 'msg1.node1.tok1',
		nodeId: 'node1',
		tokenUuid: 'Scene.s1.Token.tok1',
		spaces: 2,
		used: true,
		usedBy: 'player',
		movedSpaces: 2,
		stopped: false,
		...over,
	};
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
	g.Roll.replaceFormulaData = (formula: string, data: { speed?: number }) =>
		formula.replace('@speed', String(data.speed ?? 0));
	g.Roll.safeEval = (expression: string) => Number(expression);
});

afterEach(() => {
	g.fromUuidSync = previous.fromUuidSync;
	g.game.user = previous.game?.user;
	g.game.settings = previous.game?.settings;
	g.Roll.replaceFormulaData = previous.rollReplace;
	g.Roll.safeEval = previous.rollEval;
});

describe('MoveNode', () => {
	it('states the offer and tells the reader to drag the token', () => {
		renderNode();
		expect(screen.getByText(/Goblin Cutthroat: up to 2 spaces away from Sir Brannon/)).toBeTruthy();
		expect(screen.getByText(/Sir Brannon chooses where/)).toBeTruthy();
		expect(screen.getByText(/Drag Goblin Cutthroat: the ruler stops at 2 spaces/)).toBeTruthy();
	});

	it('carries no button in any state', () => {
		renderNode();
		expect(screen.queryByRole('button')).toBeNull();
	});

	it('leaves out the drag hint when Movement Offers is off', () => {
		g.game.settings = { get: vi.fn(() => false) };
		renderNode();
		expect(screen.getByText(/up to 2 spaces/)).toBeTruthy();
		expect(screen.queryByText(/the ruler stops/)).toBeNull();
	});

	it('resolves @speed against the recipient for a self free move', () => {
		renderNode(
			createNode({ kind: 'free', recipient: 'self', distance: '@speed', direction: 'any' }),
		);
		expect(screen.getByText(/up to 6 spaces in any direction/)).toBeTruthy();
		expect(screen.getByText('Free Move')).toBeTruthy();
	});

	it('uses the singular for one space', () => {
		renderNode(createNode({ distance: '1' }));
		expect(screen.getByText(/up to 1 space away/)).toBeTruthy();
	});

	it('offers nothing to drag when the distance comes to zero', () => {
		renderNode(createNode({ distance: '0' }));
		expect(screen.queryByText(/the ruler stops/)).toBeNull();
	});

	it('names every target of a push', () => {
		const tokens = [createToken(), createToken({ id: 'tok2', name: 'Goblin Archer' })];
		g.fromUuidSync = vi.fn((uuid: string) => tokens.find((t) => t.uuid === uuid) ?? null);
		renderNode(createNode(), { targets: ['Scene.s1.Token.tok1', 'Scene.s1.Token.tok2'] });
		expect(screen.getByText(/Goblin Cutthroat: up to 2 spaces/)).toBeTruthy();
		expect(screen.getByText(/Goblin Archer: up to 2 spaces/)).toBeTruthy();
	});

	it('reports the finished Movement in place of the offer', () => {
		renderNode(createNode(), { movementOffers: [takenEntry()] });
		expect(screen.getByText(/moved 2 of 2 spaces/)).toBeTruthy();
		expect(screen.queryByText(/the ruler stops/)).toBeNull();
		expect(screen.queryByText(/1d6 bludgeoning/)).toBeNull();
	});

	it('reminds the table about damage when a push was cut short', () => {
		renderNode(createNode(), { movementOffers: [takenEntry({ movedSpaces: 1, stopped: true })] });
		expect(screen.getByText(/moved 1 of 2 spaces, shortened by 1/)).toBeTruthy();
		expect(screen.getByText(/1d6 bludgeoning damage for every space shortened/)).toBeTruthy();
	});

	it('says so when the mover went their own way instead', () => {
		renderNode(createNode(), { movementOffers: [takenEntry({ movedSpaces: null })] });
		expect(screen.getByText(/moved on its own, so this went unused/)).toBeTruthy();
		expect(screen.queryByText(/the ruler stops/)).toBeNull();
	});

	it('says so when the card has no creature to move', () => {
		renderNode(createNode(), { targets: [] });
		expect(screen.getByText(/No creature to move/)).toBeTruthy();
	});
});
