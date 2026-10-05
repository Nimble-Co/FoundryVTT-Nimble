import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { FORCED_MOVEMENT_ACTION, FREE_MOVEMENT_ACTION } from '#utils/movement/movementActions.js';
import { forgetArmedMovementOffers } from '#utils/movement/movementOffers.js';
import { MOVEMENT_OFFER_TAG_KEY } from '#utils/movement/movementOfferTag.js';
import { NimbleToken } from './token.js';

type DragLayer = { _dragMovementAction: string | null; _draggedToken?: unknown };
type DropOptions = {
	constrainOptions?: Record<string, unknown>;
	movement: Record<string, { constrainOptions?: Record<string, unknown> }>;
};
type TokenUnderTest = {
	document: { uuid: string | null; movementAction: string };
	layer: DragLayer;
	switchableDragOffer(): { id: string; messageId: string } | null;
	nextDragAction(reverse?: boolean): string | null | undefined;
	_getDragMovementAction(): string;
	_prepareDragLeftDropUpdates(event: unknown): [object[], DropOptions];
};
type CoreToken = {
	_getDragConstrainOptions?: () => { ignoreWalls: boolean; ignoreCost: boolean };
	_getDragMovementAction?: () => string;
	_prepareDragLeftDropUpdates?: (event: unknown) => [object[], DropOptions];
};

const core = Object.getPrototypeOf(NimbleToken.prototype) as CoreToken;
const globals = globalThis as unknown as {
	game: { messages?: unknown; settings?: unknown };
	CONFIG: { Token: unknown };
};
const original = {
	messages: globals.game.messages,
	settings: globals.game.settings,
	token: globals.CONFIG.Token,
};

const GOBLIN = 'Scene.s.Token.gob';
const OGRE = 'Scene.s.Token.ogre';
const BAT = 'Scene.s.Token.bat';

let unconstrained: boolean;
let coreDrop: [object[], DropOptions];

function openOffer(id: string, tokenUuid: string, kind: 'free' | 'forced') {
	return { id, tokenUuid, kind, spaces: 2, state: 'open', conditional: false };
}

function makeLayer(): DragLayer {
	return { _dragMovementAction: null };
}

function makeToken(uuid: string | null, layer: DragLayer, movementAction = 'walk'): TokenUnderTest {
	const token = new (NimbleToken as unknown as new () => object)() as TokenUnderTest;
	token.document = { uuid, movementAction };
	token.layer = layer;
	return token;
}

function dropEvent(tokens: Record<string, unknown>) {
	return {
		interactionData: {
			contexts: Object.fromEntries(Object.entries(tokens).map(([id, token]) => [id, { token }])),
		},
	};
}

function offerNamedOn(options: DropOptions, id: string): unknown {
	return options.movement[id]?.constrainOptions?.[MOVEMENT_OFFER_TAG_KEY];
}

beforeAll(() => {
	core._getDragConstrainOptions = () => ({ ignoreWalls: unconstrained, ignoreCost: unconstrained });
	core._getDragMovementAction = function (this: TokenUnderTest) {
		return this.document.movementAction;
	};
	core._prepareDragLeftDropUpdates = () => coreDrop;
});

afterAll(() => {
	delete core._getDragConstrainOptions;
	delete core._getDragMovementAction;
	delete core._prepareDragLeftDropUpdates;
});

beforeEach(() => {
	unconstrained = false;
	coreDrop = [
		[{ _id: 'gob' }, { _id: 'ogre' }, { _id: 'bat' }],
		{
			constrainOptions: { ignoreWalls: false },
			movement: { gob: {}, ogre: {}, bat: {} },
		},
	];
	globals.game.settings = { get: () => true };
	globals.game.messages = {
		contents: [
			{
				id: 'card-1',
				system: {
					movementOffers: [
						openOffer('n1.gob', GOBLIN, 'forced'),
						openOffer('n2.ogre', OGRE, 'free'),
					],
				},
			},
		],
	};
	globals.CONFIG.Token = {
		movement: {
			actions: {
				walk: { canSelect: () => true },
				fly: { canSelect: () => false },
				swim: { canSelect: () => true },
				[FREE_MOVEMENT_ACTION]: { canSelect: () => false },
				[FORCED_MOVEMENT_ACTION]: { canSelect: () => false },
			},
		},
	};
	forgetArmedMovementOffers();
});

afterEach(() => {
	globals.game.messages = original.messages;
	globals.game.settings = original.settings;
	globals.CONFIG.Token = original.token;
	forgetArmedMovementOffers();
});

describe('NimbleToken._getDragMovementAction', () => {
	it('drags a token that carries a Forced Movement offer under the forced action', () => {
		expect(makeToken(GOBLIN, makeLayer())._getDragMovementAction()).toBe(FORCED_MOVEMENT_ACTION);
	});

	it('drags a token that carries a Free Move offer under the free action', () => {
		expect(makeToken(OGRE, makeLayer())._getDragMovementAction()).toBe(FREE_MOVEMENT_ACTION);
	});

	it('uses the action of core for a token with no offer', () => {
		expect(makeToken(BAT, makeLayer(), 'fly')._getDragMovementAction()).toBe('fly');
	});

	it('uses the action of core for a token with no uuid', () => {
		expect(makeToken(null, makeLayer(), 'swim')._getDragMovementAction()).toBe('swim');
	});

	it('uses the action of core when the user switched the drag to another action', () => {
		const layer = makeLayer();
		layer._dragMovementAction = 'swim';
		expect(makeToken(GOBLIN, layer, 'walk')._getDragMovementAction()).toBe('walk');
	});

	it('uses the action of core when Movement Offers are off', () => {
		globals.game.settings = { get: () => false };
		expect(makeToken(GOBLIN, makeLayer(), 'walk')._getDragMovementAction()).toBe('walk');
	});

	it('drags as if there is no offer under core Unconstrained Movement', () => {
		unconstrained = true;
		expect(makeToken(GOBLIN, makeLayer(), 'walk')._getDragMovementAction()).toBe('walk');
	});

	it('keeps the offer when core ignores only walls', () => {
		core._getDragConstrainOptions = () => ({ ignoreWalls: true, ignoreCost: false });
		try {
			expect(makeToken(GOBLIN, makeLayer())._getDragMovementAction()).toBe(FORCED_MOVEMENT_ACTION);
		} finally {
			core._getDragConstrainOptions = () => ({
				ignoreWalls: unconstrained,
				ignoreCost: unconstrained,
			});
		}
	});
});

describe('NimbleToken.switchableDragOffer', () => {
	it('gives the offer of the token that is dragged', () => {
		const layer = makeLayer();
		const token = makeToken(GOBLIN, layer);
		layer._draggedToken = token;
		expect(token.switchableDragOffer()).toMatchObject({ id: 'n1.gob', messageId: 'card-1' });
	});

	it('is null for a token that is not the dragged token', () => {
		const layer = makeLayer();
		const token = makeToken(GOBLIN, layer);
		layer._draggedToken = makeToken(OGRE, layer);
		expect(token.switchableDragOffer()).toBeNull();
	});

	it('is null when no token is dragged', () => {
		expect(makeToken(GOBLIN, makeLayer()).switchableDragOffer()).toBeNull();
	});

	it('stays available after the user switched the drag to another action', () => {
		const layer = makeLayer();
		const token = makeToken(GOBLIN, layer);
		layer._draggedToken = token;
		layer._dragMovementAction = 'swim';
		expect(token.switchableDragOffer()).toMatchObject({ id: 'n1.gob' });
	});

	it('is null under core Unconstrained Movement', () => {
		unconstrained = true;
		const layer = makeLayer();
		const token = makeToken(GOBLIN, layer);
		layer._draggedToken = token;
		expect(token.switchableDragOffer()).toBeNull();
	});
});

describe('NimbleToken.nextDragAction', () => {
	function dragged(uuid: string, movementAction = 'walk') {
		const layer = makeLayer();
		const token = makeToken(uuid, layer, movementAction);
		layer._draggedToken = token;
		return { layer, token };
	}

	function ringFrom(token: TokenUnderTest, layer: DragLayer, reverse: boolean, steps: number) {
		const visited: (string | null | undefined)[] = [];
		for (let step = 0; step < steps; step++) {
			const next = token.nextDragAction(reverse);
			visited.push(next);
			layer._dragMovementAction = next ?? null;
		}
		return visited;
	}

	it('goes from the offer through each selectable action and back to the offer', () => {
		const { layer, token } = dragged(GOBLIN);
		expect(ringFrom(token, layer, false, 3)).toEqual(['walk', 'swim', null]);
	});

	it('goes the other way in reverse', () => {
		const { layer, token } = dragged(GOBLIN);
		expect(ringFrom(token, layer, true, 3)).toEqual(['swim', 'walk', null]);
	});

	it('includes the own movement action of the token when it is not selectable', () => {
		const { layer, token } = dragged(GOBLIN, 'fly');
		expect(ringFrom(token, layer, false, 4)).toEqual(['walk', 'fly', 'swim', null]);
	});

	it('asks each action if the token document can select it', () => {
		const { token } = dragged(GOBLIN);
		const canSelect = vi.fn(() => true);
		globals.CONFIG.Token = { movement: { actions: { burrow: { canSelect } } } };
		expect(token.nextDragAction()).toBe('burrow');
		expect(canSelect).toHaveBeenCalledWith(token.document);
	});

	it('is undefined for a dragged token with no offer', () => {
		expect(dragged(BAT).token.nextDragAction()).toBeUndefined();
	});

	it('is undefined for a token that is not dragged', () => {
		expect(makeToken(GOBLIN, makeLayer()).nextDragAction()).toBeUndefined();
	});

	it('is undefined under core Unconstrained Movement', () => {
		unconstrained = true;
		expect(dragged(GOBLIN).token.nextDragAction()).toBeUndefined();
	});
});

describe('NimbleToken._prepareDragLeftDropUpdates', () => {
	function dropAll(layer: DragLayer) {
		const goblin = makeToken(GOBLIN, layer);
		const tokens = { gob: goblin, ogre: makeToken(OGRE, layer), bat: makeToken(BAT, layer) };
		return goblin._prepareDragLeftDropUpdates(dropEvent(tokens));
	}

	it('names the own offer of each dragged token on its movement entry', () => {
		const [, options] = dropAll(makeLayer());
		expect(offerNamedOn(options, 'gob')).toEqual({ messageId: 'card-1', offerId: 'n1.gob' });
		expect(offerNamedOn(options, 'ogre')).toEqual({ messageId: 'card-1', offerId: 'n2.ogre' });
	});

	it('names no offer for a token that carries none', () => {
		const [, options] = dropAll(makeLayer());
		expect(options.movement.bat).toEqual({});
	});

	it('keeps the constrain options of core on a tagged entry', () => {
		const [, options] = dropAll(makeLayer());
		expect(options.movement.gob.constrainOptions).toMatchObject({ ignoreWalls: false });
	});

	it('keeps the updates and the shared options of core', () => {
		const [updates, options] = dropAll(makeLayer());
		expect(updates).toBe(coreDrop[0]);
		expect(options.constrainOptions).toEqual({ ignoreWalls: false });
		expect(options.constrainOptions).not.toHaveProperty(MOVEMENT_OFFER_TAG_KEY);
	});

	it('names no offer when the user switched the drag to another action', () => {
		const layer = makeLayer();
		layer._dragMovementAction = 'swim';
		const [, options] = dropAll(layer);
		expect(options.movement).toEqual({ gob: {}, ogre: {}, bat: {} });
	});

	it('names no offer under core Unconstrained Movement', () => {
		unconstrained = true;
		const [, options] = dropAll(makeLayer());
		expect(options.movement).toEqual({ gob: {}, ogre: {}, bat: {} });
	});

	it('names no offer for a dragged object that is not a system token', () => {
		const layer = makeLayer();
		const goblin = makeToken(GOBLIN, layer);
		const stranger = { document: { uuid: OGRE }, layer };
		const [, options] = goblin._prepareDragLeftDropUpdates(
			dropEvent({ gob: goblin, ogre: stranger }),
		);
		expect(offerNamedOn(options, 'ogre')).toBeUndefined();
	});
});
