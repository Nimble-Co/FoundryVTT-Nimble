import { describe, expect, it } from 'vitest';
import {
	areAdjacentOnGrid,
	areWithinSpaces,
	countAdjacentAllies,
	countAdjacentEnemies,
} from './tokenAdjacency.js';

const GRID_SIZE = 100;

type Diagonals = 'equidistant' | 'illegal';

function makeGrid(diagonals: Diagonals = 'equidistant') {
	return {
		isGridless: false,
		size: GRID_SIZE,
		measurePath([from, to]: { i: number; j: number }[]) {
			const di = Math.abs(from.i - to.i);
			const dj = Math.abs(from.j - to.j);
			return { spaces: diagonals === 'illegal' ? di + dj : Math.max(di, dj) };
		},
	};
}

/**
 * Creates a minimal Token mock placed at the given grid coordinates.
 * `x` and `y` are the top-left corner of the token in grid squares.
 */
function makeToken(
	x: number,
	y: number,
	disposition: number,
	grid = makeGrid(),
	id = Math.random().toString(36).slice(2),
): Token.Implementation {
	const document = {
		id,
		x: x * GRID_SIZE,
		y: y * GRID_SIZE,
		width: 1,
		height: 1,
		disposition,
		parent: { grid },
		getOccupiedGridSpaceOffsets(data?: { x?: number; y?: number }) {
			return [
				{
					i: Math.floor((data?.y ?? document.y) / GRID_SIZE),
					j: Math.floor((data?.x ?? document.x) / GRID_SIZE),
				},
			];
		},
	};
	return { name: id, document } as unknown as Token.Implementation;
}

const HOSTILE = CONST.TOKEN_DISPOSITIONS.HOSTILE;
const FRIENDLY = CONST.TOKEN_DISPOSITIONS.FRIENDLY;
const NEUTRAL = CONST.TOKEN_DISPOSITIONS.NEUTRAL;

describe('countAdjacentEnemies', () => {
	describe('with the default diagonal rule', () => {
		it('counts an orthogonally adjacent enemy', () => {
			const hero = makeToken(0, 0, FRIENDLY);
			const enemy = makeToken(1, 0, HOSTILE);
			expect(countAdjacentEnemies(hero, [hero, enemy])).toBe(1);
		});

		it('counts a diagonally adjacent enemy', () => {
			const hero = makeToken(0, 0, FRIENDLY);
			const enemy = makeToken(1, 1, HOSTILE);
			expect(countAdjacentEnemies(hero, [hero, enemy])).toBe(1);
		});

		it('does not count an enemy two squares away', () => {
			const hero = makeToken(0, 0, FRIENDLY);
			const enemy = makeToken(2, 0, HOSTILE);
			expect(countAdjacentEnemies(hero, [hero, enemy])).toBe(0);
		});

		it('counts multiple adjacent enemies', () => {
			const hero = makeToken(1, 1, FRIENDLY);
			const enemyN = makeToken(1, 0, HOSTILE);
			const enemyE = makeToken(2, 1, HOSTILE);
			const enemyFar = makeToken(3, 3, HOSTILE);
			expect(countAdjacentEnemies(hero, [hero, enemyN, enemyE, enemyFar])).toBe(2);
		});
	});

	describe('when the world forbids diagonal adjacency', () => {
		const grid = makeGrid('illegal');

		it('counts an orthogonally adjacent enemy', () => {
			const hero = makeToken(0, 0, FRIENDLY, grid);
			const enemy = makeToken(1, 0, HOSTILE, grid);
			expect(countAdjacentEnemies(hero, [hero, enemy])).toBe(1);
		});

		it('does not count a diagonally adjacent enemy', () => {
			const hero = makeToken(0, 0, FRIENDLY, grid);
			const enemy = makeToken(1, 1, HOSTILE, grid);
			expect(countAdjacentEnemies(hero, [hero, enemy])).toBe(0);
		});
	});

	describe('enemy detection', () => {
		it('does not count friendly tokens', () => {
			const hero = makeToken(0, 0, FRIENDLY);
			const ally = makeToken(1, 0, FRIENDLY);
			expect(countAdjacentEnemies(hero, [hero, ally])).toBe(0);
		});

		it('does not count neutral tokens', () => {
			const hero = makeToken(0, 0, FRIENDLY);
			const neutral = makeToken(1, 0, NEUTRAL);
			expect(countAdjacentEnemies(hero, [hero, neutral])).toBe(0);
		});

		it('does not count the token itself', () => {
			const hero = makeToken(0, 0, HOSTILE);
			expect(countAdjacentEnemies(hero, [hero])).toBe(0);
		});

		it('works from the hostile perspective', () => {
			const monster = makeToken(0, 0, HOSTILE);
			const hero = makeToken(1, 0, FRIENDLY);
			expect(countAdjacentEnemies(monster, [monster, hero])).toBe(1);
		});
	});

	describe('position overrides', () => {
		it('uses the override position instead of the document position', () => {
			const hero = makeToken(0, 0, FRIENDLY);
			const enemy = makeToken(5, 5, HOSTILE);
			const overrides = new Map([[enemy.document.id as string, { x: GRID_SIZE, y: 0 }]]);
			expect(countAdjacentEnemies(hero, [hero, enemy], overrides)).toBe(1);
		});

		it('returns 0 without an override when the enemy is out of range', () => {
			const hero = makeToken(0, 0, FRIENDLY);
			const enemy = makeToken(5, 5, HOSTILE);
			expect(countAdjacentEnemies(hero, [hero, enemy])).toBe(0);
		});
	});

	it('returns 0 when the scene has no grid', () => {
		const hero = makeToken(0, 0, FRIENDLY);
		const enemy = makeToken(1, 0, HOSTILE);
		(hero.document as unknown as { parent: unknown }).parent = null;
		(enemy.document as unknown as { parent: unknown }).parent = null;
		expect(countAdjacentEnemies(hero, [hero, enemy])).toBe(0);
	});
});

describe('countAdjacentAllies', () => {
	it('counts an adjacent hostile token as an ally of a hostile token', () => {
		const monster = makeToken(0, 0, HOSTILE);
		const other = makeToken(1, 0, HOSTILE);
		expect(countAdjacentAllies(monster, [monster, other])).toBe(1);
	});

	it('counts an adjacent neutral token as an ally of a friendly token', () => {
		const hero = makeToken(0, 0, FRIENDLY);
		const neutral = makeToken(1, 0, NEUTRAL);
		expect(countAdjacentAllies(hero, [hero, neutral])).toBe(1);
	});

	it('does not count an adjacent hostile token as an ally of a friendly token', () => {
		const hero = makeToken(0, 0, FRIENDLY);
		const enemy = makeToken(1, 0, HOSTILE);
		expect(countAdjacentAllies(hero, [hero, enemy])).toBe(0);
	});

	it('does not count the token itself', () => {
		const hero = makeToken(0, 0, FRIENDLY);
		expect(countAdjacentAllies(hero, [hero])).toBe(0);
	});

	it('does not count an ally two squares away', () => {
		const hero = makeToken(0, 0, FRIENDLY);
		const ally = makeToken(2, 0, FRIENDLY);
		expect(countAdjacentAllies(hero, [hero, ally])).toBe(0);
	});

	it('does not count a diagonally adjacent ally when the world forbids diagonals', () => {
		const grid = makeGrid('illegal');
		const hero = makeToken(0, 0, FRIENDLY, grid);
		const ally = makeToken(1, 1, FRIENDLY, grid);
		expect(countAdjacentAllies(hero, [hero, ally])).toBe(0);
	});
});

describe('areWithinSpaces', () => {
	it('returns true at exactly N spaces and false just beyond', () => {
		const a = makeToken(0, 0, FRIENDLY);
		expect(areWithinSpaces(a, makeToken(2, 0, FRIENDLY), 2)).toBe(true);
		expect(areWithinSpaces(a, makeToken(3, 0, FRIENDLY), 2)).toBe(false);
	});

	it('follows the world diagonal rule for a diagonal at N spaces', () => {
		const a = makeToken(0, 0, FRIENDLY);
		expect(areWithinSpaces(a, makeToken(2, 2, FRIENDLY), 2)).toBe(true);
		const grid = makeGrid('illegal');
		const b = makeToken(0, 0, FRIENDLY, grid);
		expect(areWithinSpaces(b, makeToken(2, 2, FRIENDLY, grid), 2)).toBe(false);
	});

	it.each([
		[1, 0],
		[1, 1],
		[2, 0],
		[2, 2],
	])('matches areAdjacentOnGrid at 1 space for offset (%i, %i)', (x, y) => {
		const a = makeToken(0, 0, FRIENDLY);
		const b = makeToken(x, y, FRIENDLY);
		expect(areWithinSpaces(a, b, 1)).toBe(areAdjacentOnGrid(a, b));
	});
});
