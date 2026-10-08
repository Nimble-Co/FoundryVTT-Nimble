import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MovementOffer } from '#types/movement.js';
import { NimbleChatMessage } from './chatMessage.js';

type MockedMessage = NimbleChatMessage & { update: ReturnType<typeof vi.fn> };
type WrittenSystem = { targets: string[]; movementOffers: MovementOffer[] };

const RollGlobal = Roll as unknown as {
	replaceFormulaData?: (formula: string, data: Record<string, unknown>) => string;
	safeEval?: (expression: string) => number;
};
const originalRoll = { replace: RollGlobal.replaceFormulaData, safeEval: RollGlobal.safeEval };
const globals = globalThis as unknown as { game: { user?: unknown } };
const originalUser = globals.game.user;

const HERO = 'Scene.s.Token.hero';
const GOBLIN = 'Scene.s.Token.gob';
const OGRE = 'Scene.s.Token.ogre';

function makeActor(walk: number) {
	return {
		getRollData: () => ({}),
		system: { attributes: { movement: { walk }, sizeCategory: 'medium' } },
	};
}

const tokenDocuments: Record<string, { name: string; actor: ReturnType<typeof makeActor> }> = {
	[HERO]: { name: 'Hero', actor: makeActor(6) },
	[GOBLIN]: { name: 'Goblin', actor: makeActor(4) },
	[OGRE]: { name: 'Ogre', actor: makeActor(8) },
};

function canvasToken(uuid: string) {
	return { document: { uuid } };
}

function pushNode() {
	return {
		id: 'n1',
		type: 'move',
		kind: 'forced',
		recipient: 'targets',
		distance: '2',
		distanceBySize: {},
		ignoreDifficultTerrain: false,
		direction: 'away',
		parentContext: null,
		parentNode: null,
	};
}

function offerTo(tokenUuid: string, over: Partial<MovementOffer> = {}): MovementOffer {
	return {
		id: `n1.${tokenUuid.split('.').at(-1)}`,
		nodeId: 'n1',
		tokenUuid,
		name: tokenDocuments[tokenUuid].name,
		kind: 'forced',
		spaces: 2,
		ignoreDifficultTerrain: true,
		state: 'open',
		usedBy: null,
		movedSpaces: null,
		stopped: false,
		conditional: false,
		...over,
	} as MovementOffer;
}

function createCard(
	targets: string[],
	movementOffers: MovementOffer[],
	effects: unknown[] = [pushNode()],
): MockedMessage {
	const message = new NimbleChatMessage({
		type: 'feature',
		speaker: { scene: 's', token: 'hero', actor: 'hero-actor' },
		system: { targets, movementOffers, activation: { effects } },
	} as unknown as ChatMessage.CreateData) as MockedMessage;
	message.update = vi.fn().mockResolvedValue(undefined);
	return message;
}

function written(message: MockedMessage): WrittenSystem {
	expect(message.update).toHaveBeenCalledOnce();
	return (message.update.mock.calls[0][0] as { system: WrittenSystem }).system;
}

function offerIds(system: WrittenSystem): string[] {
	return system.movementOffers.map((offer) => offer.id);
}

beforeAll(() => {
	RollGlobal.replaceFormulaData = (formula, data) => formula.replace('@speed', String(data.speed));
	RollGlobal.safeEval = (expression) => Number(expression);
});

afterAll(() => {
	RollGlobal.replaceFormulaData = originalRoll.replace;
	RollGlobal.safeEval = originalRoll.safeEval;
});

beforeEach(() => {
	vi.stubGlobal('fromUuidSync', (uuid: string) => tokenDocuments[uuid] ?? null);
});

afterEach(() => {
	vi.unstubAllGlobals();
	globals.game.user = originalUser;
});

describe('adding a target to a card with a move node', () => {
	it('makes a Movement Offer for a selected token', async () => {
		vi.stubGlobal('canvas', { tokens: { controlled: [canvasToken(OGRE)] } });
		const message = createCard([GOBLIN], [offerTo(GOBLIN)]);

		await message.addSelectedTokensAsTargets();

		const system = written(message);
		expect(system.targets).toEqual([GOBLIN, OGRE]);
		expect(system.movementOffers).toEqual([offerTo(GOBLIN), offerTo(OGRE)]);
	});

	it('makes a Movement Offer for a targeted token', async () => {
		globals.game.user = { targets: new Set([canvasToken(OGRE)]) };
		const message = createCard([GOBLIN], [offerTo(GOBLIN)]);

		await message.addTargetedTokensAsTargets();

		expect(offerIds(written(message))).toEqual(['n1.gob', 'n1.ogre']);
	});

	it('makes a Movement Offer for a token inside a placed region', async () => {
		const inRegion = {
			document: { uuid: OGRE, hidden: false, elevation: 0 },
			center: { x: 0, y: 0 },
		};
		vi.stubGlobal('canvas', { tokens: { placeables: [inRegion] } });
		const message = createCard([GOBLIN], [offerTo(GOBLIN)]);

		await message.addTokensInRegionAsTargets({ testPoint: () => true } as never);

		expect(offerIds(written(message))).toEqual(['n1.gob', 'n1.ogre']);
	});

	it('keeps the settled record of a creature that was already a target', async () => {
		vi.stubGlobal('canvas', { tokens: { controlled: [canvasToken(OGRE)] } });
		const taken = offerTo(GOBLIN, { state: 'taken', movedSpaces: 1, usedBy: 'gm' });
		const message = createCard([GOBLIN], [taken]);

		await message.addSelectedTokensAsTargets();

		expect(written(message).movementOffers).toEqual([taken, offerTo(OGRE)]);
	});

	it('makes no second offer for a creature that is already a target', async () => {
		vi.stubGlobal('canvas', { tokens: { controlled: [canvasToken(GOBLIN)] } });
		const message = createCard([GOBLIN], [offerTo(GOBLIN)]);

		await message.addSelectedTokensAsTargets();

		const system = written(message);
		expect(system.targets).toEqual([GOBLIN]);
		expect(offerIds(system)).toEqual(['n1.gob']);
	});

	it('makes no offer on a card with no move node', async () => {
		vi.stubGlobal('canvas', { tokens: { controlled: [canvasToken(OGRE)] } });
		const message = createCard([GOBLIN], [], []);

		await message.addSelectedTokensAsTargets();

		const system = written(message);
		expect(system.targets).toEqual([GOBLIN, OGRE]);
		expect(system.movementOffers).toEqual([]);
	});
});

describe('removing a target from a card with a move node', () => {
	it('withdraws an offer that the creature did not use', async () => {
		const message = createCard([GOBLIN, OGRE], [offerTo(GOBLIN), offerTo(OGRE)]);

		await message.removeTarget(OGRE);

		const system = written(message);
		expect(system.targets).toEqual([GOBLIN]);
		expect(system.movementOffers).toEqual([offerTo(GOBLIN)]);
	});

	it('withdraws an untracked offer', async () => {
		const message = createCard([GOBLIN], [offerTo(GOBLIN, { state: 'untracked' })]);

		await message.removeTarget(GOBLIN);

		expect(written(message).movementOffers).toEqual([]);
	});

	it.each(['taken', 'unused', 'lapsed'] as const)(
		'keeps a record that is already %s',
		async (state) => {
			const settled = offerTo(OGRE, { state, usedBy: 'gm' });
			const message = createCard([GOBLIN, OGRE], [offerTo(GOBLIN), settled]);

			await message.removeTarget(OGRE);

			const system = written(message);
			expect(system.targets).toEqual([GOBLIN]);
			expect(system.movementOffers).toEqual([offerTo(GOBLIN), settled]);
		},
	);

	it('keeps the offers of the other targets when the uuid is not a target', async () => {
		const message = createCard([GOBLIN], [offerTo(GOBLIN)]);

		await message.removeTarget(OGRE);

		expect(written(message).movementOffers).toEqual([offerTo(GOBLIN)]);
	});
});
