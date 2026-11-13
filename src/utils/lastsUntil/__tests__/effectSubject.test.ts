import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { effectSubject, seatOf } from '../effectSubject.js';
import type { LastsUntilCheck } from '../momentReached.js';

const COMBAT = 'combat1';

function makeActor(uuid: string, type = 'npc') {
	return new Actor({ uuid, type, inCombat: true } as never);
}

function makeCombatant(id: string, actor: object, type = 'npc') {
	return Object.assign(Object.create(Combatant.prototype), { id, actor, type, flags: {} });
}

const goblin = makeActor('Actor.goblin');
const tessa = makeActor('Actor.tessa', 'character');
const bystander = makeActor('Actor.bystander');
const goblinCombatant = makeCombatant('cGoblin', goblin);
const tessaCombatant = makeCombatant('cTessa', tessa, 'character');
const bystanderCombatant = makeCombatant('cBystander', bystander);
const combatants = [tessaCombatant, goblinCombatant, bystanderCombatant];

const combat = {
	id: COMBAT,
	combatants: {
		contents: combatants,
		get: (id: string) => combatants.find((each) => each.id === id),
	},
} as unknown as Combat;

const spell = new Item({ uuid: 'Actor.tessa.Item.sand', actor: tessa } as never);

function makeEffect() {
	return Object.assign(Object.create(ActiveEffect.prototype), {
		parent: goblin,
		origin: spell.uuid,
		start: { combat: COMBAT, combatant: 'cTessa', round: 1, turn: 0, time: 0 },
	}) as ActiveEffect;
}

const turnEnd: LastsUntilCheck = {
	type: 'turnEnd',
	combatId: COMBAT,
	seat: seatOf(tessaCombatant),
	round: 1,
};

beforeEach(() => {
	vi.stubGlobal(
		'fromUuidSync',
		vi.fn((uuid: string) => (uuid === spell.uuid ? spell : null)),
	);
});

afterEach(() => {
	vi.unstubAllGlobals();
});

describe('effectSubject isClockTurn', () => {
	it.each([
		['the holder', goblinCombatant],
		['the source', tessaCombatant],
		['a creature that is neither', bystanderCombatant],
	])('counts the turn of %s for the any clock', (_who, combatant) => {
		const subject = effectSubject(makeEffect(), turnEnd, combat);

		expect(subject.isClockTurn('any', seatOf(combatant))).toBe(true);
	});

	it('counts only the holder turn for the holder clock', () => {
		const subject = effectSubject(makeEffect(), turnEnd, combat);

		expect(subject.isClockTurn('holder', seatOf(goblinCombatant))).toBe(true);
		expect(subject.isClockTurn('holder', seatOf(bystanderCombatant))).toBe(false);
	});
});
