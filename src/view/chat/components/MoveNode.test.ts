import { fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import MoveNodeTestHarness from './MoveNode.testHarness.svelte';

/**
 * The states a move node renders in: an offer with its Move button for the
 * people who may take it, text only for everyone else or with the toggle off,
 * and the recorded result once the drag landed.
 */

const takeMovementOffer = vi.hoisted(() => vi.fn().mockResolvedValue('declined'));
vi.mock('#utils/movement/takeMovementOffer.js', () => ({ takeMovementOffer }));

type Globals = {
	fromUuidSync: unknown;
	game: { user: unknown; settings: unknown };
	Roll: { replaceFormulaData?: unknown; safeEval?: unknown };
};

const g = globalThis as unknown as Globals;

function createToken(
	overrides: { id?: string; name?: string; ownerIds?: string[]; walk?: number } = {},
) {
	const ownerIds = overrides.ownerIds ?? ['player'];
	const id = overrides.id ?? 'tok1';
	return {
		id,
		uuid: `Scene.s1.Token.${id}`,
		name: overrides.name ?? 'Goblin Cutthroat',
		actor: {
			getRollData: () => ({ abilities: { strength: { mod: 0 } } }),
			testUserPermission: (user: { id: string }, level: number) =>
				level === CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER && ownerIds.includes(user.id),
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
	overrides: { targets?: string[]; movementOffers?: unknown[]; authorId?: string } = {},
) {
	const message = {
		id: 'msg1',
		author: { id: overrides.authorId ?? 'author' },
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
	takeMovementOffer.mockReset();
	takeMovementOffer.mockResolvedValue('declined');
});

afterEach(() => {
	g.fromUuidSync = previous.fromUuidSync;
	g.game.user = previous.game?.user;
	g.game.settings = previous.game?.settings;
	g.Roll.replaceFormulaData = previous.rollReplace;
	g.Roll.safeEval = previous.rollEval;
});

function moveButton() {
	return screen.queryByRole('button', { name: /move \(up to 2 spaces\)/i });
}

describe('MoveNode', () => {
	it('offers the drag to the recipient owner with the distance and direction', () => {
		renderNode();
		expect(screen.getByText(/Goblin Cutthroat: up to 2 spaces away from Sir Brannon/)).toBeTruthy();
		expect(screen.getByText(/Sir Brannon chooses where/)).toBeTruthy();
		expect(moveButton()).toBeTruthy();
	});

	it('shows text only to a user who neither owns the recipient nor used the feature', () => {
		g.fromUuidSync = vi.fn(() => createToken({ ownerIds: ['someone-else'] }));
		renderNode();
		expect(screen.getByText(/up to 2 spaces/)).toBeTruthy();
		expect(moveButton()).toBeNull();
	});

	it('offers the button to the user who used the feature', () => {
		g.fromUuidSync = vi.fn(() => createToken({ ownerIds: ['someone-else'] }));
		renderNode(createNode(), { authorId: 'player' });
		expect(moveButton()).toBeTruthy();
	});

	it('always offers the button to the GM', () => {
		g.fromUuidSync = vi.fn(() => createToken({ ownerIds: [] }));
		g.game.user = { isGM: true, id: 'gm' };
		renderNode();
		expect(moveButton()).toBeTruthy();
	});

	it('shows text only when Movement Offers is off', () => {
		g.game.settings = { get: vi.fn(() => false) };
		renderNode();
		expect(screen.getByText(/up to 2 spaces/)).toBeTruthy();
		expect(moveButton()).toBeNull();
	});

	it('resolves @speed against the recipient for a self free move', () => {
		renderNode(
			createNode({ kind: 'free', recipient: 'self', distance: '@speed', direction: 'any' }),
		);
		expect(screen.getByText(/up to 6 spaces in any direction/)).toBeTruthy();
	});

	it('uses the singular for one space', () => {
		renderNode(createNode({ distance: '1' }));
		expect(screen.getByText(/up to 1 space away/)).toBeTruthy();
		expect(screen.getByRole('button', { name: /move \(up to 1 space\)/i })).toBeTruthy();
	});

	it('offers every target its own button and holds all of them during one drag', async () => {
		const tokens = [
			createToken(),
			createToken({ id: 'tok2', name: 'Goblin Archer', ownerIds: ['player'] }),
		];
		g.fromUuidSync = vi.fn((uuid: string) => tokens.find((token) => token.uuid === uuid) ?? null);
		let release: () => void = () => {};
		takeMovementOffer.mockImplementation(
			() =>
				new Promise<string>((resolve) => {
					release = () => resolve('started');
				}),
		);
		renderNode(createNode(), { targets: ['Scene.s1.Token.tok1', 'Scene.s1.Token.tok2'] });

		const buttons = screen.getAllByRole('button', { name: /move \(up to 2 spaces\)/i });
		expect(buttons).toHaveLength(2);
		expect(screen.getByText(/Goblin Archer: up to 2 spaces/)).toBeTruthy();
		await fireEvent.click(buttons[1]);
		expect(buttons.every((button) => button.hasAttribute('disabled'))).toBe(true);
		release();
		await waitFor(() =>
			expect(buttons.every((button) => !button.hasAttribute('disabled'))).toBe(true),
		);
		expect(takeMovementOffer).toHaveBeenCalledWith({
			messageId: 'msg1',
			nodeId: 'node1',
			tokenUuid: 'Scene.s1.Token.tok2',
		});
	});

	it('keeps a taken offer taken even when the drag result is unknown', () => {
		renderNode(createNode(), {
			movementOffers: [
				{
					id: 'msg1.node1.tok1',
					nodeId: 'node1',
					tokenUuid: 'Scene.s1.Token.tok1',
					spaces: 2,
					used: true,
					usedBy: 'player',
					movedSpaces: null,
					stopped: false,
				},
			],
		});
		expect(screen.getByText(/Goblin Cutthroat moved\./)).toBeTruthy();
		expect(screen.queryByRole('button')).toBeNull();
	});

	it('shows no button for a distance that comes to zero', () => {
		renderNode(createNode({ distance: '0' }));
		expect(screen.queryByRole('button')).toBeNull();
	});

	it('takes the offer by card, node and token when clicked, once at a time', async () => {
		let release: () => void = () => {};
		takeMovementOffer.mockImplementation(
			() =>
				new Promise<string>((resolve) => {
					release = () => resolve('started');
				}),
		);
		renderNode();

		const button = moveButton()!;
		await fireEvent.click(button);
		await fireEvent.click(button);
		expect(button.hasAttribute('disabled')).toBe(true);
		release();

		await waitFor(() => expect(takeMovementOffer).toHaveBeenCalledTimes(1));
		expect(takeMovementOffer).toHaveBeenCalledWith({
			messageId: 'msg1',
			nodeId: 'node1',
			tokenUuid: 'Scene.s1.Token.tok1',
		});
		await waitFor(() => expect(moveButton()?.hasAttribute('disabled')).toBe(false));
	});

	it('replaces the button with the result once the drag landed', () => {
		renderNode(createNode(), {
			movementOffers: [
				{
					id: 'msg1.node1.tok1',
					nodeId: 'node1',
					tokenUuid: 'Scene.s1.Token.tok1',
					spaces: 2,
					used: true,
					usedBy: 'player',
					movedSpaces: 2,
					stopped: false,
				},
			],
		});
		expect(screen.getByText(/moved 2 of 2 spaces/)).toBeTruthy();
		expect(moveButton()).toBeNull();
		expect(screen.queryByText(/1d6 bludgeoning/)).toBeNull();
	});

	it('reminds the table about damage when a push was cut short', () => {
		renderNode(createNode(), {
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
		expect(screen.getByText(/moved 1 of 2 spaces, shortened by 1/)).toBeTruthy();
		expect(screen.getByText(/1d6 bludgeoning damage for every space shortened/)).toBeTruthy();
	});

	it('says so when the card has no creature to move', () => {
		renderNode(createNode(), { targets: [] });
		expect(screen.getByText(/No creature to move/)).toBeTruthy();
	});
});
