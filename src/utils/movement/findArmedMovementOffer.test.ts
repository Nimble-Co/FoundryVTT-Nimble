import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { findArmedMovementOffer } from './findArmedMovementOffer.js';

const RollGlobal = Roll as unknown as {
	replaceFormulaData?: (formula: string, data: Record<string, unknown>) => string;
	safeEval?: (expression: string) => number;
};
const originalRoll = { replace: RollGlobal.replaceFormulaData, safeEval: RollGlobal.safeEval };
const g = globalThis as unknown as { fromUuidSync: unknown };
const originalFromUuid = g.fromUuidSync;

const GOBLIN = 'Scene.s.Token.gob';

const token = {
	id: 'gob',
	uuid: GOBLIN,
	name: 'Goblin',
	actor: {
		getRollData: () => ({}),
		system: { attributes: { movement: { walk: 4 }, sizeCategory: 'medium' } },
	},
};

beforeAll(() => {
	RollGlobal.replaceFormulaData = (formula) => formula;
	RollGlobal.safeEval = (expression) => Number(expression);
	g.fromUuidSync = vi.fn(() => token);
});

afterAll(() => {
	RollGlobal.replaceFormulaData = originalRoll.replace;
	RollGlobal.safeEval = originalRoll.safeEval;
	g.fromUuidSync = originalFromUuid;
});

afterEach(() => {
	vi.restoreAllMocks();
});

function moveNode(id: string, over: Record<string, unknown> = {}) {
	return {
		id,
		type: 'move',
		kind: 'forced',
		recipient: 'targets',
		distance: '2',
		distanceBySize: {},
		ignoreDifficultTerrain: true,
		direction: 'away',
		chooser: 'source',
		parentNode: null,
		parentContext: null,
		...over,
	};
}

function card(id: string, effects: unknown[], movementOffers: unknown[] = []) {
	return {
		id,
		author: { id: 'author' },
		speaker: { scene: 's', token: 'hero', actor: 'a-hero' },
		system: {
			actorName: 'Hero',
			targets: [GOBLIN],
			activation: { effects: effects as never[] },
			movementOffers: movementOffers as never[],
		},
	};
}

const enabled = { enabled: true };

describe('findArmedMovementOffer', () => {
	it('finds the offer a card makes to the token', () => {
		const found = findArmedMovementOffer(GOBLIN, {
			...enabled,
			messages: [card('m1', [moveNode('n1')])],
		});
		expect(found?.offer.spaces).toBe(2);
		expect(found?.offer.messageId).toBe('m1');
	});

	it('prefers the newest offer, so a second push supersedes the first', () => {
		const found = findArmedMovementOffer(GOBLIN, {
			...enabled,
			messages: [card('m1', [moveNode('n1')]), card('m2', [moveNode('n2', { distance: '4' })])],
		});
		expect(found?.offer.messageId).toBe('m2');
		expect(found?.offer.spaces).toBe(4);
	});

	it('skips an offer already recorded and falls back to an older one', () => {
		const spent = [{ id: 'm2.n2.gob', used: true }];
		const found = findArmedMovementOffer(GOBLIN, {
			...enabled,
			messages: [card('m1', [moveNode('n1')]), card('m2', [moveNode('n2')], spent)],
		});
		expect(found?.offer.messageId).toBe('m1');
	});

	it('finds a move node nested under a damage outcome', () => {
		const nested = {
			id: 'dmg',
			type: 'damage',
			formula: '1d6',
			damageType: 'bludgeoning',
			on: { hit: [moveNode('n1')] },
		};
		expect(
			findArmedMovementOffer(GOBLIN, { ...enabled, messages: [card('m1', [nested])] }),
		).not.toBeNull();
	});

	it('is nothing for a token the card does not name', () => {
		expect(
			findArmedMovementOffer('Scene.s.Token.other', {
				...enabled,
				messages: [card('m1', [moveNode('n1')])],
			}),
		).toBeNull();
	});

	it('is nothing for an offer of no distance', () => {
		expect(
			findArmedMovementOffer(GOBLIN, {
				...enabled,
				messages: [card('m1', [moveNode('n1', { distance: '0' })])],
			}),
		).toBeNull();
	});

	it('is nothing for cards that carry no move node, and nothing when the toggle is off', () => {
		const plain = card('m1', [{ id: 'd', type: 'damage', formula: '1d6', damageType: 'slashing' }]);
		expect(findArmedMovementOffer(GOBLIN, { ...enabled, messages: [plain] })).toBeNull();
		expect(
			findArmedMovementOffer(GOBLIN, { enabled: false, messages: [card('m1', [moveNode('n1')])] }),
		).toBeNull();
	});
});
