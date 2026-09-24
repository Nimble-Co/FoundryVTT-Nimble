import { describe, expect, it } from 'vitest';
import type { MovementKind, MovementRecord } from '#types/movement.js';
import { type MovementTriggerOptions, matchMovementTrigger } from './matchMovementTrigger.js';

const GRID = 100;
const { FRIENDLY, HOSTILE, NEUTRAL, SECRET } = {
	SECRET: -2,
	HOSTILE: -1,
	NEUTRAL: 0,
	FRIENDLY: 1,
} as const;

const grid = {
	isGridless: false,
	size: GRID,
	measurePath([from, to]: { i: number; j: number }[]) {
		return { spaces: Math.max(Math.abs(from.i - to.i), Math.abs(from.j - to.j)) };
	},
};

let nextId = 0;

function makeToken(
	gx: number,
	gy: number,
	disposition: number,
	extra: { hidden?: boolean; actor?: object | null } = {},
) {
	const doc = {
		id: `token${nextId++}`,
		x: gx * GRID,
		y: gy * GRID,
		width: 1,
		height: 1,
		disposition,
		hidden: extra.hidden ?? false,
		actor: extra.actor === undefined ? {} : extra.actor,
		parent: { grid },
		getOccupiedGridSpaceOffsets(data?: { x?: number; y?: number }) {
			return [
				{ i: Math.floor((data?.y ?? doc.y) / GRID), j: Math.floor((data?.x ?? doc.x) / GRID) },
			];
		},
	};
	return doc as unknown as TokenDocument;
}

function makeRecord(
	mover: TokenDocument,
	path: [number, number][],
	extra: { kind?: MovementKind; spaces?: number; spacesThisTurn?: number | null } = {},
): MovementRecord {
	const positions = path.map(([gx, gy]) => ({ x: gx * GRID, y: gy * GRID }));
	return {
		token: mover,
		actor: null,
		kind: extra.kind ?? 'regular',
		origin: positions[0],
		stop: positions.at(-1) ?? positions[0],
		path: positions,
		spaces: extra.spaces ?? path.length - 1,
		spacesThisTurn: extra.spacesThisTurn === undefined ? path.length - 1 : extra.spacesThisTurn,
	} as unknown as MovementRecord;
}

function options(overrides: Partial<MovementTriggerOptions> = {}): MovementTriggerOptions {
	return {
		event: 'selfMoved',
		creature: 'enemy',
		kinds: ['regular', 'free', 'forced'],
		minSpaces: 0,
		spacesScope: 'thisMovement',
		geometry: 'any',
		reach: 1,
		minTargets: 1,
		observerScope: 'self',
		allyRadius: 0,
		...overrides,
	};
}

describe('matchMovementTrigger', () => {
	describe('selfMoved', () => {
		it('fires with no targets for geometry any', () => {
			const self = makeToken(0, 0, FRIENDLY);
			const record = makeRecord(self, [
				[0, 0],
				[1, 0],
			]);
			expect(matchMovementTrigger(record, self, true, options(), [self])).toEqual({
				targets: [],
			});
		});

		it('returns null when the observer is not the mover', () => {
			const self = makeToken(0, 0, FRIENDLY);
			const record = makeRecord(self, [
				[0, 0],
				[1, 0],
			]);
			expect(matchMovementTrigger(record, self, false, options(), [self])).toBeNull();
		});

		it('endsAdjacent matches enemies next to the Stop', () => {
			const self = makeToken(0, 0, FRIENDLY);
			const near = makeToken(3, 0, HOSTILE);
			const far = makeToken(6, 0, HOSTILE);
			const record = makeRecord(self, [
				[0, 0],
				[1, 0],
				[2, 0],
			]);
			const geometry = options({ geometry: 'endsAdjacent' });
			expect(matchMovementTrigger(record, self, true, geometry, [self, near, far])).toEqual({
				targets: [near],
			});
			expect(matchMovementTrigger(record, self, true, geometry, [self, far])).toBeNull();
		});

		it('enteredReach matches only enemies whose Reach the path entered', () => {
			const self = makeToken(0, 0, FRIENDLY);
			const entered = makeToken(4, 0, HOSTILE);
			const alreadyInside = makeToken(0, 1, HOSTILE);
			const record = makeRecord(self, [
				[0, 0],
				[1, 0],
				[2, 0],
			]);
			const result = matchMovementTrigger(
				record,
				self,
				true,
				options({ geometry: 'enteredReach', reach: 2 }),
				[self, entered, alreadyInside],
			);
			expect(result).toEqual({ targets: [entered] });
		});

		it('leftReach matches enemies the path moved away from', () => {
			const self = makeToken(0, 0, FRIENDLY);
			const left = makeToken(0, 1, HOSTILE);
			const record = makeRecord(self, [
				[0, 0],
				[1, 0],
				[2, 0],
			]);
			const geometry = options({ geometry: 'leftReach' });
			expect(matchMovementTrigger(record, self, true, geometry, [self, left])).toEqual({
				targets: [left],
			});
			const stay = makeRecord(self, [
				[0, 0],
				[1, 0],
			]);
			expect(matchMovementTrigger(stay, self, true, geometry, [self, left])).toBeNull();
		});

		it('inPath matches enemies the path passed through', () => {
			const self = makeToken(0, 0, FRIENDLY);
			const crossed = makeToken(1, 0, HOSTILE);
			const beside = makeToken(1, 1, HOSTILE);
			const record = makeRecord(self, [
				[0, 0],
				[1, 0],
				[2, 0],
			]);
			expect(
				matchMovementTrigger(record, self, true, options({ geometry: 'inPath' }), [
					self,
					crossed,
					beside,
				]),
			).toEqual({ targets: [crossed] });
		});

		it('movedToward compares the origin and the Stop', () => {
			const self = makeToken(0, 0, FRIENDLY);
			const ahead = makeToken(5, 0, HOSTILE);
			const behind = makeToken(-3, 0, HOSTILE);
			const toward = makeRecord(self, [
				[0, 0],
				[1, 0],
				[2, 0],
			]);
			const geometry = options({ geometry: 'movedToward' });
			expect(matchMovementTrigger(toward, self, true, geometry, [self, ahead, behind])).toEqual({
				targets: [ahead],
			});
			const sideways = makeRecord(self, [
				[5, 3],
				[6, 3],
			]);
			expect(matchMovementTrigger(sideways, self, true, geometry, [self, ahead])).toBeNull();
		});

		it('fires only when at least minTargets tokens match', () => {
			const self = makeToken(0, 0, FRIENDLY);
			const one = makeToken(3, 0, HOSTILE);
			const two = makeToken(3, 1, HOSTILE);
			const record = makeRecord(self, [
				[0, 0],
				[2, 0],
			]);
			const scene = [self, one, two];
			expect(
				matchMovementTrigger(
					record,
					self,
					true,
					options({ geometry: 'endsAdjacent', minTargets: 2 }),
					scene,
				),
			).toEqual({ targets: [one, two] });
			expect(
				matchMovementTrigger(
					record,
					self,
					true,
					options({ geometry: 'endsAdjacent', minTargets: 3 }),
					scene,
				),
			).toBeNull();
		});

		it('ignores minTargets for geometry any', () => {
			const self = makeToken(0, 0, FRIENDLY);
			const record = makeRecord(self, [
				[0, 0],
				[1, 0],
			]);
			expect(matchMovementTrigger(record, self, true, options({ minTargets: 3 }), [self])).toEqual({
				targets: [],
			});
		});

		it('skips hidden tokens, tokens without an actor, and the mover itself', () => {
			const self = makeToken(0, 0, HOSTILE);
			const hidden = makeToken(3, 0, FRIENDLY, { hidden: true });
			const noActor = makeToken(3, 1, FRIENDLY, { actor: null });
			const record = makeRecord(self, [
				[0, 0],
				[2, 0],
			]);
			expect(
				matchMovementTrigger(
					record,
					self,
					true,
					options({ geometry: 'endsAdjacent', creature: 'any' }),
					[self, hidden, noActor],
				),
			).toBeNull();
		});

		it('matches creatures by their relation to the observer', () => {
			const self = makeToken(0, 0, FRIENDLY);
			const enemy = makeToken(3, 0, HOSTILE);
			const ally = makeToken(3, 1, FRIENDLY);
			const neutral = makeToken(3, -1, NEUTRAL);
			const secret = makeToken(2, 1, SECRET);
			const record = makeRecord(self, [
				[0, 0],
				[2, 0],
			]);
			const scene = [self, enemy, ally, neutral, secret];
			const run = (creature: 'enemy' | 'ally' | 'any') =>
				matchMovementTrigger(
					record,
					self,
					true,
					options({ geometry: 'endsAdjacent', creature }),
					scene,
				)?.targets;
			expect(run('enemy')).toEqual([enemy]);
			expect(run('ally')).toEqual([ally]);
			expect(run('any')).toEqual([enemy, ally, neutral, secret]);
		});

		it('never treats neutral or secret tokens as allies of each other', () => {
			for (const disposition of [NEUTRAL, SECRET]) {
				const self = makeToken(0, 0, disposition);
				const same = makeToken(3, 0, disposition);
				const record = makeRecord(self, [
					[0, 0],
					[2, 0],
				]);
				for (const creature of ['ally', 'enemy'] as const) {
					expect(
						matchMovementTrigger(
							record,
							self,
							true,
							options({ geometry: 'endsAdjacent', creature }),
							[self, same],
						),
					).toBeNull();
				}
			}
		});

		it('treats hostile tokens as allies of each other and enemies of friendly ones', () => {
			const self = makeToken(0, 0, HOSTILE);
			const ally = makeToken(3, 0, HOSTILE);
			const enemy = makeToken(3, 1, FRIENDLY);
			const neutral = makeToken(3, -1, NEUTRAL);
			const record = makeRecord(self, [
				[0, 0],
				[2, 0],
			]);
			const scene = [self, ally, enemy, neutral];
			const run = (creature: 'enemy' | 'ally') =>
				matchMovementTrigger(
					record,
					self,
					true,
					options({ geometry: 'endsAdjacent', creature }),
					scene,
				)?.targets;
			expect(run('ally')).toEqual([ally]);
			expect(run('enemy')).toEqual([enemy]);
		});
	});

	describe('creatureMoved', () => {
		const watch = (overrides: Partial<MovementTriggerOptions> = {}) =>
			options({ event: 'creatureMoved', ...overrides });

		it('fires with the mover as target when an enemy ends adjacent', () => {
			const self = makeToken(3, 0, FRIENDLY);
			const mover = makeToken(0, 0, HOSTILE);
			const record = makeRecord(mover, [
				[0, 0],
				[2, 0],
			]);
			expect(
				matchMovementTrigger(record, self, false, watch({ geometry: 'endsAdjacent' }), [
					self,
					mover,
				]),
			).toEqual({ targets: [mover] });
		});

		it('watches an ally inside allyRadius for selfOrAllyWithin', () => {
			const self = makeToken(10, 0, FRIENDLY);
			const ally = makeToken(3, 0, FRIENDLY);
			const mover = makeToken(0, 0, HOSTILE);
			const record = makeRecord(mover, [
				[0, 0],
				[2, 0],
			]);
			const scene = [self, ally, mover];
			const scoped = (allyRadius: number) =>
				watch({ geometry: 'endsAdjacent', observerScope: 'selfOrAllyWithin', allyRadius });
			expect(matchMovementTrigger(record, self, false, scoped(7), scene)).toEqual({
				targets: [mover],
			});
			expect(matchMovementTrigger(record, self, false, scoped(6), scene)).toBeNull();
			expect(matchMovementTrigger(record, self, false, scoped(0), scene)).toEqual({
				targets: [mover],
			});
			expect(
				matchMovementTrigger(record, self, false, watch({ geometry: 'endsAdjacent' }), scene),
			).toBeNull();
		});

		it('returns null when the observer is the mover', () => {
			const self = makeToken(0, 0, FRIENDLY);
			const record = makeRecord(self, [
				[0, 0],
				[1, 0],
			]);
			expect(matchMovementTrigger(record, self, true, watch(), [self])).toBeNull();
		});

		it('fires with the mover for geometry any', () => {
			const self = makeToken(20, 0, FRIENDLY);
			const mover = makeToken(0, 0, HOSTILE);
			const record = makeRecord(mover, [
				[0, 0],
				[1, 0],
			]);
			expect(matchMovementTrigger(record, self, false, watch(), [self, mover])).toEqual({
				targets: [mover],
			});
		});

		it('tests each geometry against the watched token', () => {
			const self = makeToken(3, 0, FRIENDLY);
			const mover = makeToken(0, 0, HOSTILE);
			const scene = [self, mover];
			const run = (geometry: MovementTriggerOptions['geometry'], path: [number, number][]) =>
				matchMovementTrigger(makeRecord(mover, path), self, false, watch({ geometry }), scene);
			const approach: [number, number][] = [
				[0, 0],
				[1, 0],
				[2, 0],
			];
			const retreat: [number, number][] = [
				[2, 0],
				[1, 0],
				[0, 0],
			];
			const through: [number, number][] = [
				[2, 0],
				[3, 0],
				[4, 0],
			];

			expect(run('enteredReach', approach)).toEqual({ targets: [mover] });
			expect(run('enteredReach', retreat)).toBeNull();
			expect(run('leftReach', retreat)).toEqual({ targets: [mover] });
			expect(run('leftReach', approach)).toBeNull();
			expect(run('inPath', through)).toEqual({ targets: [mover] });
			expect(run('inPath', approach)).toBeNull();
			expect(run('movedToward', approach)).toEqual({ targets: [mover] });
			expect(run('movedToward', retreat)).toBeNull();
			expect(run('endsAdjacent', retreat)).toBeNull();
		});

		it('matches the mover by its relation to the observer', () => {
			const self = makeToken(3, 0, FRIENDLY);
			const path: [number, number][] = [
				[0, 0],
				[2, 0],
			];
			const run = (disposition: number, creature: 'enemy' | 'ally' | 'any') => {
				const mover = makeToken(0, 0, disposition);
				return matchMovementTrigger(
					makeRecord(mover, path),
					self,
					false,
					watch({ geometry: 'endsAdjacent', creature }),
					[self, mover],
				);
			};
			expect(run(HOSTILE, 'enemy')).not.toBeNull();
			expect(run(HOSTILE, 'ally')).toBeNull();
			expect(run(FRIENDLY, 'ally')).not.toBeNull();
			expect(run(FRIENDLY, 'enemy')).toBeNull();
			expect(run(NEUTRAL, 'enemy')).toBeNull();
			expect(run(NEUTRAL, 'ally')).toBeNull();
			expect(run(NEUTRAL, 'any')).not.toBeNull();
		});

		it('ignores a hidden mover or one without an actor', () => {
			const self = makeToken(3, 0, FRIENDLY);
			for (const extra of [{ hidden: true }, { actor: null }]) {
				const mover = makeToken(0, 0, HOSTILE, extra);
				const record = makeRecord(mover, [
					[0, 0],
					[2, 0],
				]);
				expect(matchMovementTrigger(record, self, false, watch(), [self, mover])).toBeNull();
			}
		});

		it('does not watch hidden or non-ally tokens for selfOrAllyWithin', () => {
			const self = makeToken(10, 0, FRIENDLY);
			const hiddenAlly = makeToken(3, 0, FRIENDLY, { hidden: true });
			const neutral = makeToken(3, 1, NEUTRAL);
			const mover = makeToken(0, 0, HOSTILE);
			const record = makeRecord(mover, [
				[0, 0],
				[2, 0],
			]);
			expect(
				matchMovementTrigger(
					record,
					self,
					false,
					watch({ geometry: 'endsAdjacent', observerScope: 'selfOrAllyWithin' }),
					[self, hiddenAlly, neutral, mover],
				),
			).toBeNull();
		});
	});

	describe('common filters', () => {
		const self = makeToken(0, 0, FRIENDLY);
		const step: [number, number][] = [
			[0, 0],
			[1, 0],
		];

		it('counts only the listed kinds', () => {
			const forced = makeRecord(self, step, { kind: 'forced' });
			expect(
				matchMovementTrigger(forced, self, true, options({ kinds: ['regular', 'free'] }), [self]),
			).toBeNull();
			expect(
				matchMovementTrigger(forced, self, true, options({ kinds: ['forced'] }), [self]),
			).toEqual({ targets: [] });
			expect(matchMovementTrigger(forced, self, true, options({ kinds: [] }), [self])).toBeNull();
		});

		it('never counts a teleport', () => {
			const teleport = makeRecord(self, step, { kind: 'teleport', spaces: 0 });
			const all = options({ kinds: ['regular', 'free', 'forced', 'teleport'] as never });
			expect(matchMovementTrigger(teleport, self, true, all, [self])).toBeNull();
		});

		it('reads minSpaces from this Movement', () => {
			const record = makeRecord(self, step, { spaces: 2, spacesThisTurn: 5 });
			const scope = { spacesScope: 'thisMovement' } as const;
			expect(
				matchMovementTrigger(record, self, true, options({ ...scope, minSpaces: 2 }), [self]),
			).not.toBeNull();
			expect(
				matchMovementTrigger(record, self, true, options({ ...scope, minSpaces: 3 }), [self]),
			).toBeNull();
		});

		it('reads minSpaces from this turn', () => {
			const record = makeRecord(self, step, { spaces: 2, spacesThisTurn: 5 });
			const scope = { spacesScope: 'thisTurn' } as const;
			expect(
				matchMovementTrigger(record, self, true, options({ ...scope, minSpaces: 5 }), [self]),
			).not.toBeNull();
			expect(
				matchMovementTrigger(record, self, true, options({ ...scope, minSpaces: 6 }), [self]),
			).toBeNull();
		});

		it('falls back to this Movement when no turn history is recorded', () => {
			const record = makeRecord(self, step, { spaces: 2, spacesThisTurn: null });
			const scope = { spacesScope: 'thisTurn' } as const;
			expect(
				matchMovementTrigger(record, self, true, options({ ...scope, minSpaces: 2 }), [self]),
			).not.toBeNull();
			expect(
				matchMovementTrigger(record, self, true, options({ ...scope, minSpaces: 3 }), [self]),
			).toBeNull();
		});
	});
});
