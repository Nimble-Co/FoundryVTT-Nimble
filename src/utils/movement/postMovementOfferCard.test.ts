import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { type MovementOfferCardInput, postMovementOfferCard } from './postMovementOfferCard.js';

type Globals = {
	ChatMessage: { create?: unknown; getSpeaker?: unknown };
	fromUuidSync?: unknown;
	Roll: {
		replaceFormulaData?: (formula: string, data: Record<string, unknown>) => string;
		safeEval?: (expression: string) => number;
	};
};

const g = globalThis as unknown as Globals;
const original = {
	create: g.ChatMessage.create,
	getSpeaker: g.ChatMessage.getSpeaker,
	fromUuidSync: g.fromUuidSync,
	replace: g.Roll.replaceFormulaData,
	safeEval: g.Roll.safeEval,
};

function makeActor(name: string, walk: number) {
	return {
		id: `a-${name}`,
		name,
		type: 'character',
		permission: 3,
		getRollData: () => ({}),
		system: { attributes: { movement: { walk }, sizeCategory: 'medium' } },
		getActiveTokens: vi.fn(() => [] as unknown[]),
	};
}

const hero = makeActor('Hero', 6);
const goblin = makeActor('Goblin', 4);
const ogre = makeActor('Ogre', 8);
const heroToken = {
	id: 'hero',
	uuid: 'Scene.s.Token.hero',
	name: 'Hero',
	actor: hero,
	parent: { id: 's' },
};
const tokens: Record<string, unknown> = {
	'Scene.s.Token.hero': heroToken,
	'Scene.s.Token.gob': { name: 'Goblin', actor: goblin },
	'Scene.s.Token.ogre': { name: 'Ogre', actor: ogre },
};

const create = vi.fn(async (data: unknown) => ({ id: 'm1', ...(data as object) }));
const getSpeaker = vi.fn(
	({ actor, token }: { actor?: { id: string }; token?: typeof heroToken | null }) => ({
		scene: token ? token.parent.id : null,
		token: token?.id ?? null,
		actor: actor?.id ?? null,
		alias: 'Hero',
	}),
);

beforeAll(() => {
	g.Roll.replaceFormulaData = (formula, data) => formula.replace('@speed', String(data.speed));
	g.Roll.safeEval = (expression) => {
		if (!/^[\d\s+\-*/().]+$/.test(expression)) throw new Error(`unsafe: ${expression}`);
		return Function(`"use strict"; return (${expression});`)() as number;
	};
});

afterAll(() => {
	g.Roll.replaceFormulaData = original.replace;
	g.Roll.safeEval = original.safeEval;
});

beforeEach(() => {
	g.ChatMessage.create = create;
	g.ChatMessage.getSpeaker = getSpeaker;
	g.fromUuidSync = (uuid: string) => tokens[uuid] ?? null;
	hero.getActiveTokens.mockReturnValue([{ document: heroToken }]);
});

afterEach(() => {
	g.ChatMessage.create = original.create;
	g.ChatMessage.getSpeaker = original.getSpeaker;
	g.fromUuidSync = original.fromUuidSync;
});

function input(over: Partial<MovementOfferCardInput> = {}): MovementOfferCardInput {
	return {
		actor: hero as unknown as Actor,
		name: 'Shove',
		reason: 'Hero hit the goblin.',
		node: {
			kind: 'forced',
			distance: '2',
			ignoreDifficultTerrain: true,
			direction: 'away',
			chooser: 'source',
		},
		recipients: ['Scene.s.Token.gob'],
		...over,
	};
}

function posted() {
	return create.mock.calls[0]?.[0] as {
		type: string;
		author: string;
		speaker: Record<string, unknown>;
		system: Record<string, any>;
	};
}

describe('postMovementOfferCard', () => {
	it('posts a card born with one open offer per recipient', async () => {
		const message = await postMovementOfferCard(
			input({ recipients: ['Scene.s.Token.gob', 'Scene.s.Token.ogre'] }),
		);

		expect(message).not.toBeNull();
		expect(create).toHaveBeenCalledTimes(1);
		const offers = posted().system.movementOffers;
		expect(offers).toEqual([
			expect.objectContaining({ name: 'Goblin', state: 'open', spaces: 2, kind: 'forced' }),
			expect.objectContaining({ name: 'Ogre', state: 'open', spaces: 2, kind: 'forced' }),
		]);
	});

	it("offers to the speaker's token for 'self'", async () => {
		await postMovementOfferCard(
			input({
				recipients: 'self',
				node: {
					kind: 'free',
					distance: '@speed',
					ignoreDifficultTerrain: false,
					direction: 'any',
					chooser: 'mover',
				},
			}),
		);

		const data = posted();
		expect(getSpeaker).toHaveBeenCalledWith({ actor: hero, token: heroToken });
		expect(data.speaker).toEqual(expect.objectContaining({ scene: 's', token: 'hero' }));
		expect(data.system.targets).toEqual([]);
		expect(data.system.movementOffers).toEqual([
			expect.objectContaining({
				tokenUuid: 'Scene.s.Token.hero',
				name: 'Hero',
				kind: 'free',
				spaces: 6,
				state: 'open',
			}),
		]);
	});

	it('uses the token the caller gives over the active token', async () => {
		const other = { ...heroToken, id: 'hero2', uuid: 'Scene.s.Token.hero2' };
		await postMovementOfferCard(input({ token: other as unknown as TokenDocument }));
		expect(getSpeaker).toHaveBeenCalledWith({ actor: hero, token: other });
	});

	it('posts nothing when the list of recipients is empty', async () => {
		expect(await postMovementOfferCard(input({ recipients: [] }))).toBeNull();
		expect(create).not.toHaveBeenCalled();
	});

	it("posts nothing for 'self' when the source has no token", async () => {
		hero.getActiveTokens.mockReturnValue([]);
		expect(await postMovementOfferCard(input({ recipients: 'self' }))).toBeNull();
		expect(create).not.toHaveBeenCalled();
	});

	it('writes a movementOffer card whose node carries the input fields', async () => {
		await postMovementOfferCard(
			input({
				image: 'icons/shove.webp',
				node: {
					kind: 'forced',
					distance: '1',
					distanceBySize: { small: '3' },
					ignoreDifficultTerrain: true,
					direction: 'toward',
					chooser: 'mover',
				},
			}),
		);

		const data = posted();
		expect(data.type).toBe('movementOffer');
		expect(data.author).toBe('test-user-id');
		expect(data.system).toEqual(
			expect.objectContaining({
				actorName: 'Hero',
				actorType: 'character',
				image: 'icons/shove.webp',
				permissions: 3,
				rollMode: 0,
				name: 'Shove',
				reason: 'Hero hit the goblin.',
				targets: ['Scene.s.Token.gob'],
			}),
		);
		const [node] = data.system.activation.effects;
		expect(node).toEqual({
			id: expect.any(String),
			type: 'move',
			kind: 'forced',
			recipient: 'targets',
			distance: '1',
			distanceBySize: { small: '3' },
			ignoreDifficultTerrain: true,
			direction: 'toward',
			chooser: 'mover',
			parentContext: null,
			parentNode: null,
		});
		expect(data.system.movementOffers[0].nodeId).toBe(node.id);
	});
});
