import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { forgetArmedMovementOffers } from '#utils/movement/movementOffers.js';
import { NimbleToken } from './token.js';
import { NimbleTokenLayer } from './tokenLayer.js';

type LayerUnderTest = {
	_draggedToken?: unknown;
	_dragMovementAction: string | null;
	_movementPlanningContext?: { object?: unknown; allowedActions?: string[] | null } | null;
	_onCycleViewKey(event: { shiftKey: boolean }): boolean;
};
type CoreLayer = {
	_onCycleViewKey?: (event: unknown) => boolean;
	recalculatePlannedMovementPaths?: () => void;
};
type CoreToken = {
	_getDragConstrainOptions?: () => { ignoreWalls: boolean; ignoreCost: boolean };
};

const coreLayer = Object.getPrototypeOf(NimbleTokenLayer.prototype) as CoreLayer;
const coreToken = Object.getPrototypeOf(NimbleToken.prototype) as CoreToken;
const globals = globalThis as unknown as {
	game: { messages?: unknown; settings?: unknown };
	CONFIG: { Token: unknown };
	ui: { controls?: unknown };
};
const original = {
	messages: globals.game.messages,
	settings: globals.game.settings,
	token: globals.CONFIG.Token,
	controls: globals.ui.controls,
};

const GOBLIN = 'Scene.s.Token.gob';
const BAT = 'Scene.s.Token.bat';
const CORE_RESULT = false;

const coreCycle = vi.fn(() => CORE_RESULT);
const recalculate = vi.fn();
const press = { shiftKey: false };
const shiftPress = { shiftKey: true };

function setTool(tool: unknown): void {
	globals.ui.controls = { tool };
}

function setRulerActive(active: boolean): void {
	vi.stubGlobal('canvas', { controls: { ruler: { active } } });
}

function makeLayer(): LayerUnderTest {
	const layer = new (NimbleTokenLayer as unknown as new () => object)() as LayerUnderTest;
	layer._dragMovementAction = null;
	return layer;
}

function makeToken(uuid: string, layer: LayerUnderTest) {
	const token = new (NimbleToken as unknown as new () => object)() as {
		document: unknown;
		layer: unknown;
	};
	token.document = { uuid, movementAction: 'walk' };
	token.layer = layer;
	return token;
}

function layerDragging(uuid: string): LayerUnderTest {
	const layer = makeLayer();
	layer._draggedToken = makeToken(uuid, layer);
	return layer;
}

function expectDeferredToCore(layer: LayerUnderTest, event: { shiftKey: boolean }): void {
	const before = layer._dragMovementAction;
	expect(layer._onCycleViewKey(event)).toBe(CORE_RESULT);
	expect(coreCycle).toHaveBeenCalledExactlyOnceWith(event);
	expect(layer._dragMovementAction).toBe(before);
	expect(recalculate).not.toHaveBeenCalled();
}

beforeAll(() => {
	coreLayer._onCycleViewKey = coreCycle;
	coreLayer.recalculatePlannedMovementPaths = recalculate;
	coreToken._getDragConstrainOptions = () => ({ ignoreWalls: false, ignoreCost: false });
});

afterAll(() => {
	delete coreLayer._onCycleViewKey;
	delete coreLayer.recalculatePlannedMovementPaths;
	delete coreToken._getDragConstrainOptions;
});

beforeEach(() => {
	coreCycle.mockClear();
	recalculate.mockClear();
	setTool({ control: {} });
	setRulerActive(false);
	globals.game.settings = { get: () => true };
	globals.game.messages = {
		contents: [
			{
				id: 'card-1',
				system: {
					movementOffers: [
						{
							id: 'n1.gob',
							tokenUuid: GOBLIN,
							kind: 'forced',
							spaces: 2,
							state: 'open',
							conditional: false,
						},
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
			},
		},
	};
	forgetArmedMovementOffers();
});

afterEach(() => {
	vi.unstubAllGlobals();
	globals.game.messages = original.messages;
	globals.game.settings = original.settings;
	globals.CONFIG.Token = original.token;
	globals.ui.controls = original.controls;
	forgetArmedMovementOffers();
});

describe('NimbleTokenLayer._onCycleViewKey with an offer on the dragged token', () => {
	it('switches the drag from the offered movement to the first action', () => {
		const layer = layerDragging(GOBLIN);
		layer._onCycleViewKey(press);
		expect(layer._dragMovementAction).toBe('walk');
	});

	it('goes round the ring and back to the offered movement', () => {
		const layer = layerDragging(GOBLIN);
		const visited = [1, 2, 3].map(() => {
			layer._onCycleViewKey(press);
			return layer._dragMovementAction;
		});
		expect(visited).toEqual(['walk', 'swim', null]);
	});

	it('goes the other way with Shift', () => {
		const layer = layerDragging(GOBLIN);
		const visited = [1, 2, 3].map(() => {
			layer._onCycleViewKey(shiftPress);
			return layer._dragMovementAction;
		});
		expect(visited).toEqual(['swim', 'walk', null]);
	});

	it('calculates the planned paths again and reports the key as handled', () => {
		const layer = layerDragging(GOBLIN);
		expect(layer._onCycleViewKey(press)).toBe(true);
		expect(recalculate).toHaveBeenCalledOnce();
		expect(coreCycle).not.toHaveBeenCalled();
	});

	it('handles the key when the planning context is for another token', () => {
		const layer = layerDragging(GOBLIN);
		layer._movementPlanningContext = { object: makeToken(BAT, layer), allowedActions: ['fly'] };
		expect(layer._onCycleViewKey(press)).toBe(true);
		expect(layer._dragMovementAction).toBe('walk');
	});

	it('handles the key when the planning context of the token has no allowed actions', () => {
		const layer = layerDragging(GOBLIN);
		layer._movementPlanningContext = { object: layer._draggedToken, allowedActions: null };
		expect(layer._onCycleViewKey(press)).toBe(true);
		expect(layer._dragMovementAction).toBe('walk');
	});
});

describe('NimbleTokenLayer._onCycleViewKey defers to core', () => {
	it('when the dragged token carries no offer', () => {
		expectDeferredToCore(layerDragging(BAT), press);
	});

	it('when no token is dragged', () => {
		expectDeferredToCore(makeLayer(), shiftPress);
	});

	it('when the dragged object is not a system token', () => {
		const layer = makeLayer();
		layer._draggedToken = { document: { uuid: GOBLIN }, layer };
		expectDeferredToCore(layer, press);
	});

	it('when the active tool has no control', () => {
		setTool({});
		expectDeferredToCore(layerDragging(GOBLIN), press);
	});

	it('when there is no active tool', () => {
		setTool(undefined);
		expectDeferredToCore(layerDragging(GOBLIN), press);
	});

	it('when the canvas ruler is measuring', () => {
		setRulerActive(true);
		expectDeferredToCore(layerDragging(GOBLIN), press);
	});

	it('when the planning context of the token has its own allowed actions', () => {
		const layer = layerDragging(GOBLIN);
		layer._movementPlanningContext = { object: layer._draggedToken, allowedActions: ['fly'] };
		expectDeferredToCore(layer, press);
	});

	it('and keeps an action the user already switched to', () => {
		const layer = layerDragging(BAT);
		layer._dragMovementAction = 'swim';
		expectDeferredToCore(layer, press);
	});
});
