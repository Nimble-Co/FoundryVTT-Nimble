import { describe, expect, it } from 'vitest';
import {
	anyMomentReached,
	type EffectStart,
	type LastsUntilCheck,
	type Moment,
	type MomentSubject,
	momentReached,
	type TurnSeat,
	turnCountedAt,
} from '../momentReached.js';

const COMBAT = 'combat1';

const seat = (combatantId: string, isHero = false, groupId: string | null = null): TurnSeat => ({
	combatantId,
	groupId,
	isHero,
});

const holder = { name: 'Goblin' };
const caster = { name: 'Tessa' };

const GOBLIN = seat('goblin');
const TESSA = seat('tessa', true);
const BRUNO = seat('bruno', true);

function moment(fields: Partial<Moment>): Moment {
	return {
		kind: 'turn',
		boundary: null,
		clock: null,
		span: null,
		value: null,
		units: null,
		who: null,
		event: null,
		effectName: '',
		...fields,
	};
}

function subject(start: Partial<EffectStart> = {}, fields: Partial<MomentSubject> = {}) {
	const fullStart: EffectStart = {
		combat: COMBAT,
		combatant: 'tessa',
		round: 1,
		turn: 0,
		time: 0,
		...start,
	};
	const seats: Record<string, TurnSeat> = { goblin: GOBLIN, tessa: TESSA, bruno: BRUNO };
	const value: MomentSubject = {
		start: fullStart,
		startSeat: fullStart.combatant ? (seats[fullStart.combatant] ?? null) : null,
		holder,
		source: caster,
		origin: 'Actor.tessa.Item.sand',
		holderInCombat: true,
		isClockTurn: (clock, turn) => {
			if (clock === 'any') return true;
			if (clock === 'nextHero') return turn.isHero;
			return turn.combatantId === (clock === 'holder' ? 'goblin' : 'tessa');
		},
		relatesTo: (combatId) => combatId === COMBAT,
		secondsOf: (units, n) => n * ({ rounds: 6, minutes: 60, hours: 3600, days: 86400 }[units] ?? 0),
		...fields,
	};
	return value;
}

const turnStart = (turn: TurnSeat, round: number): LastsUntilCheck => ({
	type: 'turnStart',
	combatId: COMBAT,
	seat: turn,
	round,
});
const turnEnd = (turn: TurnSeat, round: number): LastsUntilCheck => ({
	type: 'turnEnd',
	combatId: COMBAT,
	seat: turn,
	round,
});
const roundStart = (round: number): LastsUntilCheck => ({
	type: 'roundStart',
	combatId: COMBAT,
	round,
});
const roundEnd = (round: number): LastsUntilCheck => ({
	type: 'roundEnd',
	combatId: COMBAT,
	round,
});

describe('turn moments', () => {
	const endOfTheirNextTurn = moment({ boundary: 'end', clock: 'holder', span: 'nextTurn' });

	it('"the end of their next turn" applied on the source turn ends at the end of the holder turn', () => {
		const applied = subject({ combatant: 'tessa', round: 1 });

		expect(momentReached(endOfTheirNextTurn, applied, turnEnd(TESSA, 1))).toBe(false);
		expect(momentReached(endOfTheirNextTurn, applied, turnEnd(GOBLIN, 1))).toBe(true);
	});

	it('"the end of their next turn" applied in their own turn skips the turn in progress', () => {
		const applied = subject({ combatant: 'goblin', round: 1 });

		expect(momentReached(endOfTheirNextTurn, applied, turnEnd(GOBLIN, 1))).toBe(false);
		expect(momentReached(endOfTheirNextTurn, applied, turnEnd(GOBLIN, 2))).toBe(true);
	});

	it('"the end of their current turn" takes the turn in progress', () => {
		const applied = subject({ combatant: 'goblin', round: 1 });
		const current = moment({ boundary: 'end', clock: 'holder', span: 'currentTurn' });

		expect(momentReached(current, applied, turnEnd(GOBLIN, 1))).toBe(true);
	});

	it.each([
		['the source', TESSA],
		['the holder', GOBLIN],
		['another hero', BRUNO],
	])(
		'"the end of the current turn" applied in the turn of %s ends at that turn end',
		(_who, turn) => {
			const endOfTheTurn = moment({ boundary: 'end', clock: 'any', span: 'currentTurn' });
			const applied = subject({ combatant: turn.combatantId, round: 1 });

			expect(momentReached(endOfTheTurn, applied, turnStart(turn, 1))).toBe(false);
			expect(momentReached(endOfTheTurn, applied, turnEnd(turn, 1))).toBe(true);
		},
	);

	it('"the start of your next turn" ends as the source turn starts', () => {
		const startOfYourNextTurn = moment({ boundary: 'start', clock: 'source', span: 'nextTurn' });
		const applied = subject({ combatant: 'tessa', round: 1 });

		expect(momentReached(startOfYourNextTurn, applied, turnStart(GOBLIN, 1))).toBe(false);
		expect(momentReached(startOfYourNextTurn, applied, turnStart(TESSA, 2))).toBe(true);
	});

	it('"the start of the next hero turn" ends at any hero turn start', () => {
		const nextHero = moment({ boundary: 'start', clock: 'nextHero', span: 'nextTurn' });
		const applied = subject();

		expect(momentReached(nextHero, applied, turnStart(GOBLIN, 1))).toBe(false);
		expect(momentReached(nextHero, applied, turnStart(BRUNO, 1))).toBe(true);
	});

	it('the end of the next hero turn skips the hero turn in progress', () => {
		const nextHero = moment({ boundary: 'end', clock: 'nextHero', span: 'nextTurn' });
		const applied = subject({ combatant: 'tessa', round: 1 });

		expect(momentReached(nextHero, applied, turnEnd(TESSA, 1))).toBe(false);
		expect(momentReached(nextHero, applied, turnEnd(BRUNO, 1))).toBe(true);
	});

	it('a minion group turn is the turn of each member', () => {
		const member = seat('minion2', false, 'group1');
		const leader = seat('minion1', false, 'group1');
		const applied = subject(
			{ combatant: 'minion2', round: 1 },
			{ startSeat: member, isClockTurn: (_clock, turn) => turn.groupId === 'group1' },
		);

		expect(momentReached(endOfTheirNextTurn, applied, turnEnd(leader, 1))).toBe(false);
		expect(momentReached(endOfTheirNextTurn, applied, turnEnd(leader, 2))).toBe(true);
	});

	it('"the end of their 2nd next turn" ends at the second turn end that counts', () => {
		const second = moment({ boundary: 'end', clock: 'holder', span: 'nextTurn', value: 2 });
		const applied = subject({ combatant: 'goblin', round: 1 });

		expect(momentReached(second, applied, turnEnd(GOBLIN, 1))).toBe(false);
		expect(turnCountedAt(second, applied, turnEnd(GOBLIN, 1), 0)).toBe(false);
		expect(momentReached(second, applied, turnEnd(GOBLIN, 2))).toBe(false);
		expect(turnCountedAt(second, applied, turnEnd(GOBLIN, 2), 0)).toBe(true);

		const once = subject({ combatant: 'goblin', round: 1 }, { turnsSeen: [1] });
		expect(momentReached(second, once, turnEnd(GOBLIN, 3))).toBe(true);
		expect(turnCountedAt(second, once, turnEnd(GOBLIN, 3), 0)).toBe(false);
	});

	it('a solo monster turn later in the same round is its next turn', () => {
		const applied = subject({ combatant: 'goblin', round: 1, turn: 0 });
		const turnEndAt = (turn: number): LastsUntilCheck => ({
			type: 'turnEnd',
			combatId: COMBAT,
			seat: GOBLIN,
			round: 1,
			turn,
		});

		expect(momentReached(endOfTheirNextTurn, applied, turnEndAt(0))).toBe(false);
		expect(momentReached(endOfTheirNextTurn, applied, turnEndAt(2))).toBe(true);
	});

	it('does not end as combat starts', () => {
		expect(
			momentReached(endOfTheirNextTurn, subject(), { type: 'combatStart', combatId: COMBAT }),
		).toBe(false);
	});

	it('an effect applied before combat ends at the first matching turn', () => {
		const applied = subject({ combat: null, combatant: null, round: null, turn: null });

		expect(momentReached(endOfTheirNextTurn, applied, turnEnd(GOBLIN, 1))).toBe(true);
	});

	it('ends at combat end, and out of combat at a world time change', () => {
		expect(
			momentReached(endOfTheirNextTurn, subject(), { type: 'combatEnd', combatId: COMBAT }),
		).toBe(true);
		expect(
			momentReached(endOfTheirNextTurn, subject(), { type: 'combatEnd', combatId: 'other' }),
		).toBe(false);
		const time: LastsUntilCheck = { type: 'worldTime', worldTime: 10 };
		expect(momentReached(endOfTheirNextTurn, subject(), time)).toBe(false);
		expect(momentReached(endOfTheirNextTurn, subject({}, { holderInCombat: false }), time)).toBe(
			true,
		);
	});

	it('does not end on an event', () => {
		const check: LastsUntilCheck = { type: 'event', event: 'attack', actor: holder };
		expect(momentReached(endOfTheirNextTurn, subject(), check)).toBe(false);
	});
});

describe('round moments', () => {
	it('"the end of the current round" ends at the end of the round it was applied in', () => {
		const current = moment({ boundary: 'end', span: 'currentRound' });

		expect(momentReached(current, subject({ round: 2 }), roundEnd(2))).toBe(true);
		expect(momentReached(current, subject({ round: 2 }), roundStart(3))).toBe(false);
	});

	it('"the end of the next round" waits one more round', () => {
		const next = moment({ boundary: 'end', span: 'nextRound' });

		expect(momentReached(next, subject({ round: 2 }), roundEnd(2))).toBe(false);
		expect(momentReached(next, subject({ round: 2 }), roundEnd(3))).toBe(true);
	});

	it('"the start of the next round" ends as the round after it starts', () => {
		const next = moment({ boundary: 'start', span: 'nextRound' });

		expect(momentReached(next, subject({ round: 2 }), roundStart(3))).toBe(true);
	});

	it('before round 1 counts as round 1', () => {
		const next = moment({ boundary: 'start', span: 'nextRound' });
		const precombat = subject({ combat: null, combatant: null, round: null });

		expect(momentReached(next, precombat, roundStart(1))).toBe(false);
		expect(momentReached(next, precombat, roundStart(2))).toBe(true);
	});
});

describe('time moments', () => {
	it('"for 1 round" lasts until the same place in the turn order one round later', () => {
		const oneRound = moment({ kind: 'time', value: 1, units: 'rounds' });
		const applied = subject({ combatant: 'goblin', round: 1 });

		expect(momentReached(oneRound, applied, turnStart(TESSA, 2))).toBe(false);
		expect(momentReached(oneRound, applied, turnStart(GOBLIN, 2))).toBe(true);
	});

	it('"for 1 round" applied at Initiative lasts all of round 1', () => {
		const oneRound = moment({ kind: 'time', value: 1, units: 'rounds' });
		const atInitiative = subject({ combat: null, combatant: null, round: null, turn: null });

		expect(momentReached(oneRound, atInitiative, roundStart(1))).toBe(false);
		expect(momentReached(oneRound, atInitiative, turnStart(GOBLIN, 1))).toBe(false);
		expect(momentReached(oneRound, atInitiative, roundStart(2))).toBe(true);
	});

	it('"for 1 round" from a later turn of a solo monster waits for that turn', () => {
		const oneRound = moment({ kind: 'time', value: 1, units: 'rounds' });
		const applied = subject({ combatant: 'goblin', round: 1, turn: 2 });
		const goblinTurn = (round: number, turn: number): LastsUntilCheck => ({
			type: 'turnStart',
			combatId: COMBAT,
			seat: GOBLIN,
			round,
			turn,
		});

		expect(momentReached(oneRound, applied, goblinTurn(2, 0))).toBe(false);
		expect(momentReached(oneRound, applied, goblinTurn(2, 2))).toBe(true);
		expect(momentReached(oneRound, applied, goblinTurn(3, 0))).toBe(true);
	});

	it('"for 2 rounds" counts from the round of the start', () => {
		const twoRounds = moment({ kind: 'time', value: 2, units: 'rounds' });
		const applied = subject({ combatant: 'goblin', round: 3 });

		expect(momentReached(twoRounds, applied, turnStart(GOBLIN, 4))).toBe(false);
		expect(momentReached(twoRounds, applied, turnStart(GOBLIN, 5))).toBe(true);
	});

	it('"for 1 minute" ends when world time passes the minute', () => {
		const minute = moment({ kind: 'time', value: 1, units: 'minutes' });
		const applied = subject({ time: 100 });

		expect(momentReached(minute, applied, { type: 'worldTime', worldTime: 159 })).toBe(false);
		expect(momentReached(minute, applied, { type: 'worldTime', worldTime: 160 })).toBe(true);
		expect(momentReached(minute, applied, turnStart(GOBLIN, 9))).toBe(false);
	});
});

describe('event moments', () => {
	const event = (
		fields: Partial<Extract<LastsUntilCheck, { type: 'event' }>>,
	): LastsUntilCheck => ({
		type: 'event',
		event: 'attack',
		actor: null,
		...fields,
	});

	it('"until they attack" ends when the holder attacks, not the source', () => {
		const theyAttack = moment({ kind: 'event', who: 'holder', event: 'attack' });

		expect(momentReached(theyAttack, subject(), event({ actor: holder }))).toBe(true);
		expect(momentReached(theyAttack, subject(), event({ actor: caster }))).toBe(false);
	});

	it('"until you drop to 0 HP" ends when the source drops', () => {
		const youDrop = moment({ kind: 'event', who: 'source', event: 'zeroHp' });

		expect(momentReached(youDrop, subject(), event({ event: 'zeroHp', actor: caster }))).toBe(true);
		expect(momentReached(youDrop, subject(), event({ event: 'zeroHp', actor: holder }))).toBe(
			false,
		);
	});

	it('a different event does not end it', () => {
		const theyAttack = moment({ kind: 'event', who: 'holder', event: 'attack' });

		expect(momentReached(theyAttack, subject(), event({ event: 'move', actor: holder }))).toBe(
			false,
		);
	});

	it('"until you use this again" ends on a use of the origin item', () => {
		const again = moment({ kind: 'event', who: 'source', event: 'useAgain' });

		expect(
			momentReached(
				again,
				subject(),
				event({ event: 'useAgain', itemUuid: 'Actor.tessa.Item.sand' }),
			),
		).toBe(true);
		expect(
			momentReached(again, subject(), event({ event: 'useAgain', itemUuid: 'Actor.tessa.Item.x' })),
		).toBe(false);
	});

	it('"until Rage ends" ends when an effect of that name ends on the holder', () => {
		const rageEnds = moment({ kind: 'event', event: 'effectEnds', effectName: 'Rage' });
		const ended = (actor: object) => event({ event: 'effectEnds', actor, effectName: ' rage ' });

		expect(momentReached(rageEnds, subject(), ended(holder))).toBe(true);
		expect(momentReached(rageEnds, subject(), ended(caster))).toBe(false);
	});

	it('"until combat ends" ends at the end of its combat', () => {
		const combatEnds = moment({ kind: 'event', event: 'combatEnd' });

		expect(momentReached(combatEnds, subject(), { type: 'combatEnd', combatId: COMBAT })).toBe(
			true,
		);
	});
});

describe('the first moment wins', () => {
	it('"1 minute, or until they attack" ends at the attack before the minute passes', () => {
		const moments = [
			moment({ kind: 'time', value: 1, units: 'minutes' }),
			moment({ kind: 'event', who: 'holder', event: 'attack' }),
		];
		const check: LastsUntilCheck = { type: 'event', event: 'attack', actor: holder };

		expect(anyMomentReached(moments, subject(), check)).toBe(true);
	});

	it('no moment never ends', () => {
		expect(anyMomentReached([], subject(), roundEnd(9))).toBe(false);
	});
});
