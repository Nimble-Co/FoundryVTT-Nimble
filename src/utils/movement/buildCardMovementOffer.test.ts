import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildCardMovementOffer, cardMoveRecipients } from './buildCardMovementOffer.js';

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

const node = {
	id: 'n1',
	type: 'move' as const,
	kind: 'forced' as const,
	recipient: 'targets' as const,
	distance: '@str + @speed',
	distanceBySize: {},
	ignoreDifficultTerrain: false,
	direction: 'away' as const,
	chooser: 'source' as const,
	parentContext: null,
	parentNode: null,
};

function makeActor(str: number, walk: number, ownerIds: string[] = []) {
	return {
		getRollData: () => ({ str }),
		testUserPermission: (user: unknown, level: number) =>
			level === CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER &&
			ownerIds.includes((user as { id: string }).id),
		system: { attributes: { movement: { walk }, sizeCategory: 'medium' } },
	};
}

const hero = { id: 'hero', uuid: 'Scene.s.Token.hero', name: 'Hero', actor: makeActor(3, 6) };
const goblin = {
	id: 'gob',
	uuid: 'Scene.s.Token.gob',
	name: 'Goblin',
	actor: makeActor(-1, 4, ['gm-owner']),
};
const tokens: Record<string, typeof hero> = { [hero.uuid]: hero, [goblin.uuid]: goblin };

function makeMessage(effects: unknown[] = [node], movementOffers: unknown[] = []) {
	return {
		id: 'm1',
		author: { id: 'author' },
		speaker: { scene: 's', token: 'hero', actor: 'a-hero' },
		system: {
			actorName: 'Hero',
			targets: [goblin.uuid],
			activation: { effects: effects as never[] },
			movementOffers: movementOffers as never[],
		},
	};
}

const ref = { messageId: 'm1', nodeId: 'n1', tokenUuid: goblin.uuid };
const lookups = { resolveToken: (uuid: string) => tokens[uuid] ?? null };

describe('cardMoveRecipients', () => {
	it('is the speaker token for self and the targets otherwise', () => {
		const message = makeMessage();
		expect(cardMoveRecipients(message, { ...node, recipient: 'self' })).toEqual([hero.uuid]);
		expect(cardMoveRecipients(message, node)).toEqual([goblin.uuid]);
	});
});

describe('buildCardMovementOffer', () => {
	it("rebuilds the offer from the card with the feature user's data and the mover's speed", () => {
		const card = buildCardMovementOffer(ref, { message: makeMessage(), ...lookups });
		// 3 from the hero's data plus the goblin's walk speed of 4.
		expect(card?.offer).toEqual({
			id: 'm1.n1.gob',
			tokenUuid: goblin.uuid,
			kind: 'forced',
			spaces: 7,
			ignoreDifficultTerrain: true,
			direction: 'away',
			chooser: 'source',
			label: 'Hero',
			messageId: 'm1',
		});
		expect(card?.token).toBe(goblin);
		expect(card?.entry).toBeNull();
	});

	it('carries what the card already recorded for the offer', () => {
		const entry = { id: 'm1.n1.gob', used: true, movedSpaces: 2 };
		const card = buildCardMovementOffer(ref, { message: makeMessage([node], [entry]), ...lookups });
		expect(card?.entry).toBe(entry);
	});

	it('keeps a free move on the terrain rule its node states', () => {
		const free = { ...node, kind: 'free' as const, ignoreDifficultTerrain: false };
		const card = buildCardMovementOffer(ref, { message: makeMessage([free]), ...lookups });
		expect(card?.offer.ignoreDifficultTerrain).toBe(false);
	});

	it('finds the feature user through the speaker actor when the speaker token is gone', () => {
		const message = { ...makeMessage(), speaker: { scene: null, token: null, actor: 'a-hero' } };
		const resolveActor = (id: string) => (id === 'a-hero' ? hero.actor : null);
		expect(buildCardMovementOffer(ref, { message, ...lookups, resolveActor })?.offer.spaces).toBe(
			7,
		);
		expect(
			buildCardMovementOffer(ref, { message, ...lookups, resolveActor: () => null }),
		).toBeNull();
	});

	it('finds a move node nested under another effect', () => {
		const nested = {
			id: 'd',
			type: 'damage',
			formula: '1d6',
			damageType: 'slashing',
			on: { hit: [node] },
		};
		const card = buildCardMovementOffer(ref, { message: makeMessage([nested]), ...lookups });
		expect(card?.offer.spaces).toBe(7);
	});

	it('refuses a token that is not one of the node recipients', () => {
		const card = buildCardMovementOffer(
			{ ...ref, tokenUuid: hero.uuid },
			{ message: makeMessage(), ...lookups },
		);
		expect(card).toBeNull();
	});

	it('refuses an unknown node, card or token', () => {
		expect(
			buildCardMovementOffer({ ...ref, nodeId: 'nope' }, { message: makeMessage(), ...lookups }),
		).toBeNull();
		expect(buildCardMovementOffer(ref, { message: null, ...lookups })).toBeNull();
		expect(
			buildCardMovementOffer(ref, { message: makeMessage(), resolveToken: () => null }),
		).toBeNull();
	});
});
