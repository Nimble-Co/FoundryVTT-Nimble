import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { MoveNode } from '#types/effectTree.js';
import type { MovementOffer } from '#types/movement.js';
import {
	findArmedMovementOffer,
	movementOfferOutcome,
	type OfferCard,
	type OfferToken,
	reconcileMovementOffers,
	settleMovementOffer,
} from './movementOffers.js';

const RollGlobal = Roll as unknown as {
	replaceFormulaData?: (formula: string, data: Record<string, unknown>) => string;
	safeEval?: (expression: string) => number;
};
const original = { replace: RollGlobal.replaceFormulaData, safeEval: RollGlobal.safeEval };

beforeAll(() => {
	RollGlobal.replaceFormulaData = (formula, data) =>
		formula.replace('@speed', String(data.speed)).replace('@str', String(data.str));
	RollGlobal.safeEval = (expression) => {
		if (!/^[\d\s+\-*/().]+$/.test(expression)) throw new Error(`unsafe: ${expression}`);
		return Function(`"use strict"; return (${expression});`)() as number;
	};
});

afterAll(() => {
	RollGlobal.replaceFormulaData = original.replace;
	RollGlobal.safeEval = original.safeEval;
});

function moveNode(over: Partial<MoveNode> = {}): MoveNode {
	return {
		id: 'n1',
		type: 'move',
		kind: 'forced',
		recipient: 'targets',
		distance: '@str + @speed',
		distanceBySize: {},
		ignoreDifficultTerrain: false,
		direction: 'away',
		chooser: 'source',
		parentContext: null,
		parentNode: null,
		...over,
	};
}

function makeActor(str: number, walk: number) {
	return {
		getRollData: () => ({ str }),
		system: { attributes: { movement: { walk }, sizeCategory: 'medium' } },
	};
}

const hero = { name: 'Hero', actor: makeActor(3, 6) };
const goblin = { name: 'Goblin', actor: makeActor(-1, 4) };
const ogre = { name: 'Ogre', actor: makeActor(4, 8) };
const tokens: Record<string, OfferToken> = {
	'Scene.s.Token.hero': hero,
	'Scene.s.Token.gob': goblin,
	'Scene.s.Token.ogre': ogre,
};
const lookups = {
	resolveToken: (uuid: string) => tokens[uuid] ?? null,
	resolveActor: () => null,
};

function card(
	effects: unknown[] = [moveNode()],
	targets = ['Scene.s.Token.gob'],
	movementOffers: MovementOffer[] = [],
): OfferCard {
	return {
		id: 'm1',
		speaker: { scene: 's', token: 'hero', actor: 'a-hero' },
		system: { targets, activation: { effects: effects as never[] }, movementOffers },
	};
}

function offer(over: Partial<MovementOffer> = {}): MovementOffer {
	return {
		id: 'n1.gob',
		nodeId: 'n1',
		tokenUuid: 'Scene.s.Token.gob',
		name: 'Goblin',
		kind: 'forced',
		spaces: 7,
		ignoreDifficultTerrain: true,
		state: 'open',
		usedBy: null,
		movedSpaces: null,
		stopped: false,
		...over,
	};
}

describe('reconcileMovementOffers', () => {
	it("works out one offer per recipient from the feature user's data and the mover's speed", () => {
		expect(reconcileMovementOffers(card(), lookups)).toEqual([offer()]);
	});

	it('makes a self offer to the speaker token', () => {
		const offers = reconcileMovementOffers(
			card([moveNode({ recipient: 'self', kind: 'free', distance: '@speed' })]),
			lookups,
		);
		expect(offers).toEqual([
			offer({
				id: 'n1.hero',
				tokenUuid: 'Scene.s.Token.hero',
				name: 'Hero',
				kind: 'free',
				spaces: 6,
				ignoreDifficultTerrain: false,
			}),
		]);
	});

	it('uses the source the caller already holds', () => {
		const offers = reconcileMovementOffers(card(), { ...lookups, source: makeActor(10, 0) });
		expect(offers[0].spaces).toBe(14);
	});

	it('finds the feature user through the speaker actor when the speaker token is gone', () => {
		const offers = reconcileMovementOffers(card(), {
			resolveToken: (uuid) => (uuid === 'Scene.s.Token.gob' ? goblin : null),
			resolveActor: (id) => (id === 'a-hero' ? hero.actor : null),
		});
		expect(offers[0].spaces).toBe(7);
	});

	it('keeps an offer as it was made when the card is reconciled again', () => {
		const made = offer({ spaces: 2 });
		expect(reconcileMovementOffers(card(undefined, undefined, [made]), lookups)).toEqual([made]);
	});

	it('adds an offer for a target added later and leaves the others alone', () => {
		const made = offer({ spaces: 2 });
		const offers = reconcileMovementOffers(
			card(undefined, ['Scene.s.Token.gob', 'Scene.s.Token.ogre'], [made]),
			lookups,
		);
		expect(offers.map((o) => [o.id, o.spaces])).toEqual([
			['n1.gob', 2],
			['n1.ogre', 11],
		]);
	});

	it('drops an open offer with its removed target but keeps a settled one', () => {
		const open = offer();
		const taken = offer({ id: 'n1.ogre', tokenUuid: 'Scene.s.Token.ogre', state: 'taken' });
		expect(reconcileMovementOffers(card(undefined, [], [open, taken]), lookups)).toEqual([taken]);
	});

	it('skips a recipient that does not resolve here', () => {
		expect(reconcileMovementOffers(card(undefined, ['Scene.s.Token.gone']), lookups)).toEqual([]);
	});

	it('finds a move node nested under another effect', () => {
		const nested = [{ id: 'd', type: 'damage', on: { hit: [moveNode()] } }];
		expect(reconcileMovementOffers(card(nested), lookups)).toEqual([offer()]);
	});

	it('leaves a card with no move node as it is', () => {
		const kept = [offer()];
		expect(reconcileMovementOffers(card([], undefined, kept), lookups)).toEqual(kept);
	});
});

describe('findArmedMovementOffer', () => {
	const message = (id: string, offers: MovementOffer[]): OfferCard => ({
		id,
		system: { movementOffers: offers },
	});

	it('is the open offer a card makes to the token, with its card', () => {
		const armed = findArmedMovementOffer('Scene.s.Token.gob', {
			messages: [message('m1', [offer()])],
			enabled: true,
		});
		expect(armed).toEqual({ ...offer(), messageId: 'm1' });
	});

	it('prefers the newest card, so a second push supersedes the first', () => {
		const armed = findArmedMovementOffer('Scene.s.Token.gob', {
			messages: [message('old', [offer()]), message('new', [offer({ spaces: 3 })])],
			enabled: true,
		});
		expect(armed?.messageId).toBe('new');
	});

	it('passes over a settled offer to an older open one', () => {
		const armed = findArmedMovementOffer('Scene.s.Token.gob', {
			messages: [message('old', [offer()]), message('new', [offer({ state: 'taken' })])],
			enabled: true,
		});
		expect(armed?.messageId).toBe('old');
	});

	it('is nothing for another token, an offer of no distance, or the toggle off', () => {
		const messages = [
			message('m1', [offer(), offer({ id: 'x', tokenUuid: 'Scene.s.Token.ogre', spaces: 0 })]),
		];
		expect(findArmedMovementOffer('Scene.s.Token.hero', { messages, enabled: true })).toBeNull();
		expect(findArmedMovementOffer('Scene.s.Token.ogre', { messages, enabled: true })).toBeNull();
		expect(findArmedMovementOffer('Scene.s.Token.gob', { messages, enabled: false })).toBeNull();
	});
});

describe('settleMovementOffer', () => {
	const settle = (over: Partial<Parameters<typeof settleMovementOffer>[2]> = {}) =>
		settleMovementOffer([offer({ spaces: 2 }), offer({ id: 'other' })], 'n1.gob', {
			taken: true,
			spaces: 2,
			stopped: false,
			userId: 'p1',
			...over,
		});

	it('records the spaces a taken offer covered and leaves the other offers alone', () => {
		const offers = settle();
		expect(offers?.[0]).toMatchObject({
			state: 'taken',
			usedBy: 'p1',
			movedSpaces: 2,
			stopped: false,
		});
		expect(offers?.[1]).toEqual(offer({ id: 'other' }));
	});

	it('never records more than was offered, however far the token went', () => {
		expect(settle({ spaces: 5 })?.[0].movedSpaces).toBe(2);
	});

	it('keeps a Movement cut short', () => {
		expect(settle({ spaces: 1, stopped: true })?.[0]).toMatchObject({
			movedSpaces: 1,
			stopped: true,
		});
	});

	it('leaves the offer unused when the mover went their own way', () => {
		expect(settle({ taken: false, stopped: true })?.[0]).toMatchObject({
			state: 'unused',
			movedSpaces: null,
			stopped: false,
		});
	});

	it('is nothing to write for a missing or already settled offer', () => {
		const base = { taken: true, spaces: 1, stopped: false, userId: null };
		expect(settleMovementOffer([offer()], 'missing', base)).toBeNull();
		expect(settleMovementOffer([offer({ state: 'unused' })], 'n1.gob', base)).toBeNull();
	});
});

describe('movementOfferOutcome', () => {
	it('reports a push cut short, with the damage the book deals for it', () => {
		const outcome = movementOfferOutcome(offer({ state: 'taken', movedSpaces: 3, stopped: true }));
		expect(outcome).toEqual({
			state: 'taken',
			offered: 7,
			moved: 3,
			shortfall: 4,
			damageOwed: true,
		});
	});

	it('owes no damage for a Free Move cut short', () => {
		const outcome = movementOfferOutcome(
			offer({ kind: 'free', state: 'taken', movedSpaces: 3, stopped: true }),
		);
		expect(outcome).toMatchObject({ shortfall: 4, damageOwed: false });
	});

	it('is no shortfall when the mover chose to stop early', () => {
		expect(movementOfferOutcome(offer({ state: 'taken', movedSpaces: 3 })).shortfall).toBe(0);
	});

	it('has no moved spaces for an open or unused offer', () => {
		expect(movementOfferOutcome(offer()).moved).toBeNull();
		expect(movementOfferOutcome(offer({ state: 'unused' })).moved).toBeNull();
	});
});
