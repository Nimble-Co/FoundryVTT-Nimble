import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
	buildCardMovementOffer,
	canUserTakeMovementOffer,
	cardMoveRecipients,
} from './buildCardMovementOffer.js';

const RollGlobal = Roll as unknown as {
	replaceFormulaData?: (formula: string, data: Record<string, unknown>) => string;
	safeEval?: (expression: string) => number;
};
const original = { replace: RollGlobal.replaceFormulaData, safeEval: RollGlobal.safeEval };

beforeAll(() => {
	RollGlobal.replaceFormulaData = (formula, data) =>
		formula.replace('@speed', String(data.speed)).replace('@str', String(data.str));
	RollGlobal.safeEval = (expression) => Number(expression);
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
	distance: '@str',
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
		testUserPermission: (user: unknown) => ownerIds.includes((user as { id: string }).id),
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

function makeMessage(effects: unknown[] = [node]) {
	return {
		id: 'm1',
		author: { id: 'author' },
		speaker: { scene: 's', token: 'hero', actor: 'a-hero' },
		system: {
			actorName: 'Hero',
			targets: [goblin.uuid],
			activation: { effects: effects as never[] },
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
		expect(card?.offer).toEqual({
			id: 'm1.n1.gob',
			tokenUuid: goblin.uuid,
			kind: 'forced',
			spaces: 3,
			ignoreDifficultTerrain: true,
			direction: 'away',
			chooser: 'source',
			label: 'Hero',
			messageId: 'm1',
		});
		expect(card?.token).toBe(goblin);
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
		expect(card?.offer.spaces).toBe(3);
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

describe('canUserTakeMovementOffer', () => {
	const card = buildCardMovementOffer(ref, { message: makeMessage(), ...lookups })!;

	it('allows the GM, the card author and the token owner, nobody else', () => {
		expect(canUserTakeMovementOffer({ id: 'x', isGM: true }, card)).toBe(true);
		expect(canUserTakeMovementOffer({ id: 'author', isGM: false }, card)).toBe(true);
		expect(canUserTakeMovementOffer({ id: 'gm-owner', isGM: false }, card)).toBe(true);
		expect(canUserTakeMovementOffer({ id: 'stranger', isGM: false }, card)).toBe(false);
		expect(canUserTakeMovementOffer(null, card)).toBe(false);
	});
});
