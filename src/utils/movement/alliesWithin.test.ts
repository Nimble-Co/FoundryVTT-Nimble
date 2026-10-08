import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type * as AlliesWithin from './alliesWithin.js';

// tests/setup.ts caches this module before the mock below registers. Load a fresh copy that sees it.
let alliesWithin: typeof AlliesWithin.alliesWithin;
let areAllies: typeof AlliesWithin.areAllies;
beforeAll(async () => {
	vi.resetModules();
	({ alliesWithin, areAllies } = await import('./alliesWithin.js'));
});

const distances = new Map<string, number>();
vi.mock('./spacesBetween.js', () => ({
	spacesBetween: (a: { id: string }, b: { id: string }) => distances.get(`${a.id}>${b.id}`) ?? 0,
}));

const { FRIENDLY, HOSTILE, NEUTRAL, SECRET } = CONST.TOKEN_DISPOSITIONS;

function token(id: string, overrides: Record<string, unknown> = {}): TokenDocument {
	return { id, disposition: FRIENDLY, hidden: false, actor: {}, ...overrides } as never;
}

describe('areAllies', () => {
	it('is true for two tokens on the same side', () => {
		expect(areAllies(token('a'), token('b'))).toBe(true);
		expect(
			areAllies(token('a', { disposition: HOSTILE }), token('b', { disposition: HOSTILE })),
		).toBe(true);
	});

	it('is false across sides, and for neutral and secret tokens', () => {
		expect(areAllies(token('a'), token('b', { disposition: HOSTILE }))).toBe(false);
		for (const disposition of [NEUTRAL, SECRET]) {
			expect(areAllies(token('a', { disposition }), token('b', { disposition }))).toBe(false);
		}
	});
});

describe('alliesWithin', () => {
	const source = token('hero');
	const near = token('near');
	const far = token('far');
	const scene = [
		source,
		near,
		far,
		token('hidden', { hidden: true }),
		token('empty', { actor: null }),
		token('enemy', { disposition: HOSTILE }),
	];

	beforeEach(() => {
		distances.clear();
		distances.set('hero>near', 3);
		distances.set('hero>far', 13);
	});

	it('keeps the visible allies with an actor inside the range, and never the source', () => {
		expect(alliesWithin(source, scene, 12)).toEqual([near]);
	});

	it('includes an ally exactly at the range', () => {
		expect(alliesWithin(source, scene, 13)).toEqual([near, far]);
	});

	it('means every ally on the scene for a range of 0', () => {
		expect(alliesWithin(source, scene, 0)).toEqual([near, far]);
	});
});
