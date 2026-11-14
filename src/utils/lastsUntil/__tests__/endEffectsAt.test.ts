import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SYSTEM_ID } from '#system';
import { seatOf } from '../effectSubject.js';
import { endEffectsAt } from '../endEffectsAt.js';
import type { LastsUntilCheck, Moment } from '../momentReached.js';

const COMBAT = 'combat1';
const goblin = new Actor({ uuid: 'Actor.goblin', type: 'npc', inCombat: true } as never);
const goblinCombatant = Object.assign(Object.create(Combatant.prototype), {
	id: 'cGoblin',
	actor: goblin,
	type: 'npc',
	flags: {},
});
const combat = {
	id: COMBAT,
	combatants: {
		contents: [goblinCombatant],
		get: (id: string) => (id === 'cGoblin' ? goblinCombatant : undefined),
	},
} as unknown as Combat;

const thirdNextTurnEnd: Moment = {
	kind: 'turn',
	boundary: 'end',
	clock: 'holder',
	span: 'nextTurn',
	value: 3,
	units: null,
	who: null,
	event: null,
	effectName: '',
};

const turnEnd = (round: number): LastsUntilCheck => ({
	type: 'turnEnd',
	combatId: COMBAT,
	seat: seatOf(goblinCombatant),
	round,
});

function makeEffect(lastsUntil: Moment[] = [thirdNextTurnEnd]) {
	const effect = Object.assign(Object.create(ActiveEffect.prototype), {
		id: 'slow',
		parent: goblin,
		active: true,
		origin: null,
		statuses: new Set<string>(),
		isTemporary: false,
		isMinor: false,
		lastsUntil,
		start: { combat: COMBAT, combatant: 'cGoblin', round: 1, turn: 0, time: 0 },
		flags: {} as Record<string, { turnsSeen?: number[] }>,
		update: vi.fn(async (changes: Record<string, number[]>) => {
			await new Promise((resolve) => setTimeout(resolve, 5));
			effect.flags = { [SYSTEM_ID]: { turnsSeen: changes[`flags.${SYSTEM_ID}.turnsSeen`] } };
		}),
	});
	return effect;
}

describe('endEffectsAt', () => {
	let effect: ReturnType<typeof makeEffect>;
	let saved: Record<string, unknown>;
	beforeEach(() => {
		effect = makeEffect();
		Object.assign(goblin, {
			effects: { get: () => effect, [Symbol.iterator]: () => [effect][Symbol.iterator]() },
		});
		const g = globalThis as unknown as { game: Record<string, unknown> };
		saved = { user: g.game.user, actors: g.game.actors, scenes: g.game.scenes };
		Object.assign(g.game, {
			user: { id: 'gm', isGM: true, isActiveGM: true },
			actors: [goblin],
			scenes: [],
		});
		vi.stubGlobal(
			'fromUuidSync',
			vi.fn(() => null),
		);
	});
	afterEach(() => {
		vi.unstubAllGlobals();
		Object.assign((globalThis as unknown as { game: object }).game, saved);
	});

	it('two turns close together count 2, each from the count of the one before', async () => {
		const moment = { heading: { key: 'turn' } };
		await Promise.all([
			endEffectsAt(turnEnd(2), moment, combat),
			endEffectsAt(turnEnd(3), moment, combat),
		]);

		expect(effect.flags[SYSTEM_ID]?.turnsSeen).toEqual([2]);
	});

	it('a combat end that "the 2nd combat ends" counts goes on the count of the effect', async () => {
		effect = makeEffect([
			{
				...thirdNextTurnEnd,
				kind: 'event',
				boundary: null,
				clock: null,
				span: null,
				event: 'combatEnd',
				value: 2,
			},
		]);
		const end: LastsUntilCheck = { type: 'combatEnd', combatId: COMBAT, started: true };

		await endEffectsAt(end, { heading: { key: 'combatEnd' } }, combat);

		expect(effect.flags[SYSTEM_ID]?.turnsSeen).toEqual([1]);
	});
});
