import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { Predicate } from '../../../etc/Predicate.js';
import { DefendOptionRule } from '../../../models/rules/defendOption.js';
import { resolveMoveDistance } from '../../movement/resolveMoveDistance.js';
import { defendOptionEffect } from '../defendOptions.js';

// tests/setup.ts loads movement offers before this file's mock applies.
const offerMovement = vi.fn(async (_input: unknown, _host: unknown) => true);
vi.mock('../../movement/postMovementOfferCard.js', () => ({
	offerMovement: (input: unknown, host: unknown) => offerMovement(input, host),
}));

let offerDefendOptionMoves: typeof import('../defendOptionMove.js').offerDefendOptionMoves;

const RollGlobal = Roll as unknown as {
	replaceFormulaData?: (formula: string, data: Record<string, unknown>) => string;
	safeEval?: (expression: string) => number;
};
const originalRoll = { replace: RollGlobal.replaceFormulaData, safeEval: RollGlobal.safeEval };

function lookup(data: Record<string, unknown>, path: string): unknown {
	return path
		.split('.')
		.reduce<unknown>((cursor, key) => (cursor as Record<string, unknown>)?.[key], data);
}

beforeAll(async () => {
	vi.resetModules();
	({ offerDefendOptionMoves } = await import('../defendOptionMove.js'));
	RollGlobal.replaceFormulaData = (formula, data) =>
		formula.replace(/@([\w.]+)/g, (_match, path: string) => String(lookup(data, path) ?? 0));
	RollGlobal.safeEval = (expression) => {
		const floored = expression.replace(/floor\(([^)]+)\)/g, (_match, inner: string) =>
			String(Math.floor(Function(`"use strict"; return (${inner});`)() as number)),
		);
		if (!/^[\d\s+\-*/().]+$/.test(floored)) throw new Error(`unsafe: ${expression}`);
		return Function(`"use strict"; return (${floored});`)() as number;
	};
});

afterAll(() => {
	RollGlobal.replaceFormulaData = originalRoll.replace;
	RollGlobal.safeEval = originalRoll.safeEval;
});

const TOKEN = 'Scene.s.Token.hero';

function makeRule(config: Record<string, unknown> = {}) {
	const actor = {
		uuid: 'Actor.hero',
		name: 'Hero',
		getDomain: () => new Set<string>(),
		getRollData: () => ({ level: 2 }),
		system: { attributes: { movement: { walk: 6 }, sizeCategory: 'medium' } },
	};
	const item = {
		isEmbedded: true,
		actor,
		name: 'Decoy',
		img: 'icons/decoy.webp',
		uuid: 'Actor.hero.Item.decoy',
		getDomain: () => new Set<string>(),
	};
	const rule = new DefendOptionRule({ type: 'defendOption' } as never, {
		parent: item as unknown as foundry.abstract.DataModel.Any,
		strict: false,
	});
	Object.assign(rule, {
		disabled: false,
		predicate: new Predicate({}),
		label: 'Decoy',
		outcome: 'miss',
		reminder: 'Move up to half your speed away.',
		moveDistance: '',
		moveDirection: 'any',
		...config,
	});
	Object.defineProperty(rule, 'parent', { get: () => item, configurable: true });
	Object.defineProperty(rule, 'actor', { get: () => actor, configurable: true });
	return { rule, actor };
}

const card = { id: 'm1' } as ChatMessage;

beforeEach(() => {
	offerMovement.mockClear();
	offerMovement.mockResolvedValue(true);
	vi.stubGlobal('fromUuidSync', (uuid: string) => (uuid === TOKEN ? { uuid: TOKEN } : null));
	(game as unknown as { settings: { get: () => boolean } }).settings = {
		get: () => true,
	};
});

describe('offerDefendOptionMoves', () => {
	it('offers the distance away from the attacker on the attack card', async () => {
		const { rule, actor } = makeRule({
			moveDistance: 'floor(@speed / 2)',
			moveDirection: 'away',
		});

		expect(
			await offerDefendOptionMoves({
				rules: [rule],
				actor: actor as never,
				tokenUuid: TOKEN,
				fromName: 'Goblin',
				card,
			}),
		).toBe(true);

		expect(offerMovement).toHaveBeenCalledWith(
			expect.objectContaining({
				name: 'Decoy',
				image: 'icons/decoy.webp',
				reason: 'Decoy',
				recipients: [TOKEN],
				whisper: false,
				node: {
					kind: 'free',
					distance: 'floor(@speed / 2)',
					direction: 'away',
					ignoreDifficultTerrain: false,
					sourceName: 'Goblin',
				},
			}),
			{ card },
		);
		expect(
			resolveMoveDistance({ distance: 'floor(@speed / 2)', distanceBySize: {} }, actor, {
				getRollData: () => ({}),
				system: { attributes: { movement: { walk: 6 }, sizeCategory: 'medium' } },
			}),
		).toBe(3);
		expect(defendOptionEffect([rule]).outcome).toBe('miss');
	});

	it('keeps the miss when the move is not taken', async () => {
		const { rule, actor } = makeRule({
			moveDistance: 'floor(@speed / 2)',
			moveDirection: 'away',
		});
		offerMovement.mockResolvedValue(false);

		await offerDefendOptionMoves({
			rules: [rule],
			actor: actor as never,
			tokenUuid: TOKEN,
			fromName: 'Goblin',
			card,
		});

		expect(defendOptionEffect([rule]).outcome).toBe('miss');
	});

	it('offers nothing when the formula is empty', async () => {
		const { rule, actor } = makeRule({ moveDistance: '  ' });

		expect(
			await offerDefendOptionMoves({
				rules: [rule],
				actor: actor as never,
				tokenUuid: TOKEN,
				fromName: 'Goblin',
				card,
			}),
		).toBe(false);
		expect(offerMovement).not.toHaveBeenCalled();
	});

	it('offers nothing while movement offers are off', async () => {
		(game as unknown as { settings: { get: () => boolean } }).settings = { get: () => false };
		const { rule, actor } = makeRule({
			moveDistance: 'floor(@speed / 2)',
			moveDirection: 'away',
		});

		expect(
			await offerDefendOptionMoves({
				rules: [rule],
				actor: actor as never,
				tokenUuid: TOKEN,
				fromName: 'Goblin',
				card,
			}),
		).toBe(false);
		expect(offerMovement).not.toHaveBeenCalled();
		expect(defendOptionEffect([rule]).outcome).toBe('miss');
	});
});
