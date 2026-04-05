import { afterEach, describe, expect, it, vi } from 'vitest';
import { countAdjacentEnemies } from './tokenAdjacency.js';

const GRID_SIZE = 100;

function stubCanvas(gridSize = GRID_SIZE) {
	vi.stubGlobal('canvas', { grid: { size: gridSize } });
}

/**
 * Creates a minimal Token mock placed at the given grid coordinates.
 * `x` and `y` are the top-left corner of the token in grid squares.
 * Width and height default to 1 grid square.
 */
function makeToken(
	x: number,
	y: number,
	disposition: number,
	id = Math.random().toString(36).slice(2),
): Token.Implementation {
	return {
		name: id,
		document: {
			id,
			x: x * GRID_SIZE,
			y: y * GRID_SIZE,
			width: 1,
			height: 1,
			disposition,
		},
	} as unknown as Token.Implementation;
}

const HOSTILE = CONST.TOKEN_DISPOSITIONS.HOSTILE;
const FRIENDLY = CONST.TOKEN_DISPOSITIONS.FRIENDLY;
const NEUTRAL = CONST.TOKEN_DISPOSITIONS.NEUTRAL;

describe('countAdjacentEnemies', () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	describe('with diagonals included', () => {
		it('counts an orthogonally adjacent enemy', () => {
			stubCanvas();
			const hero = makeToken(0, 0, FRIENDLY);
			const enemy = makeToken(1, 0, HOSTILE);
			expect(countAdjacentEnemies(hero, [hero, enemy], undefined, true)).toBe(1);
		});

		it('counts a diagonally adjacent enemy', () => {
			stubCanvas();
			const hero = makeToken(0, 0, FRIENDLY);
			const enemy = makeToken(1, 1, HOSTILE);
			expect(countAdjacentEnemies(hero, [hero, enemy], undefined, true)).toBe(1);
		});

		it('does not count an enemy two squares away', () => {
			stubCanvas();
			const hero = makeToken(0, 0, FRIENDLY);
			const enemy = makeToken(2, 0, HOSTILE);
			expect(countAdjacentEnemies(hero, [hero, enemy], undefined, true)).toBe(0);
		});

		it('counts multiple adjacent enemies', () => {
			stubCanvas();
			const hero = makeToken(1, 1, FRIENDLY);
			const enemyN = makeToken(1, 0, HOSTILE);
			const enemyE = makeToken(2, 1, HOSTILE);
			const enemyFar = makeToken(3, 3, HOSTILE);
			expect(countAdjacentEnemies(hero, [hero, enemyN, enemyE, enemyFar], undefined, true)).toBe(2);
		});
	});

	describe('with diagonals excluded', () => {
		it('counts an orthogonally adjacent enemy', () => {
			stubCanvas();
			const hero = makeToken(0, 0, FRIENDLY);
			const enemy = makeToken(1, 0, HOSTILE);
			expect(countAdjacentEnemies(hero, [hero, enemy], undefined, false)).toBe(1);
		});

		it('does not count a diagonally adjacent enemy', () => {
			stubCanvas();
			const hero = makeToken(0, 0, FRIENDLY);
			const enemy = makeToken(1, 1, HOSTILE);
			expect(countAdjacentEnemies(hero, [hero, enemy], undefined, false)).toBe(0);
		});
	});

	describe('enemy detection', () => {
		it('does not count friendly tokens', () => {
			stubCanvas();
			const hero = makeToken(0, 0, FRIENDLY);
			const ally = makeToken(1, 0, FRIENDLY);
			expect(countAdjacentEnemies(hero, [hero, ally], undefined, true)).toBe(0);
		});

		it('does not count neutral tokens', () => {
			stubCanvas();
			const hero = makeToken(0, 0, FRIENDLY);
			const neutral = makeToken(1, 0, NEUTRAL);
			expect(countAdjacentEnemies(hero, [hero, neutral], undefined, true)).toBe(0);
		});

		it('does not count the token itself', () => {
			stubCanvas();
			const hero = makeToken(0, 0, FRIENDLY);
			expect(countAdjacentEnemies(hero, [hero], undefined, true)).toBe(0);
		});

		it('works from the hostile perspective', () => {
			stubCanvas();
			const monster = makeToken(0, 0, HOSTILE);
			const hero = makeToken(1, 0, FRIENDLY);
			expect(countAdjacentEnemies(monster, [monster, hero], undefined, true)).toBe(1);
		});
	});

	describe('position overrides', () => {
		it('uses override position instead of document position', () => {
			stubCanvas();
			const hero = makeToken(0, 0, FRIENDLY);
			const enemy = makeToken(5, 5, HOSTILE); // far by document position

			const overrides = new Map([[enemy.document.id!, { x: GRID_SIZE, y: 0 }]]);
			expect(countAdjacentEnemies(hero, [hero, enemy], overrides, true)).toBe(1);
		});

		it('returns 0 without override when enemy is out of range', () => {
			stubCanvas();
			const hero = makeToken(0, 0, FRIENDLY);
			const enemy = makeToken(5, 5, HOSTILE);
			expect(countAdjacentEnemies(hero, [hero, enemy], undefined, true)).toBe(0);
		});
	});

	describe('when canvas is not ready', () => {
		it('returns 0 when canvas is null', () => {
			vi.stubGlobal('canvas', null);
			const hero = makeToken(0, 0, FRIENDLY);
			const enemy = makeToken(1, 0, HOSTILE);
			expect(countAdjacentEnemies(hero, [hero, enemy], undefined, true)).toBe(0);
		});
	});
});
