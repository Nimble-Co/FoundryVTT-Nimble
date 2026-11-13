import { describe, expect, it } from 'vitest';
import { estimateRounds, newApplicationLastsLonger } from '../lastsLonger.js';
import type { Moment } from '../momentReached.js';

const context = { roundSeconds: 6, secondsOf: (_units: string, value: number) => value * 60 };

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

const rounds = (lastsUntil: Moment[], extra = {}) =>
	estimateRounds({ lastsUntil, ...extra }, context);

describe('estimateRounds', () => {
	it('ranks the turn moments', () => {
		expect(rounds([moment({ boundary: 'end', clock: 'holder', span: 'currentTurn' })])).toBe(0.5);
		expect(rounds([moment({ boundary: 'start', clock: 'source', span: 'nextTurn' })])).toBe(1);
		expect(rounds([moment({ boundary: 'end', clock: 'holder', span: 'nextTurn' })])).toBe(1.5);
		expect(rounds([moment({ boundary: 'end', span: 'nextRound' })])).toBe(2);
	});

	it('a counted next turn lasts that many turns', () => {
		const third = moment({ boundary: 'end', clock: 'holder', span: 'nextTurn', value: 3 });
		const second = moment({ boundary: 'start', clock: 'source', span: 'nextTurn', value: 2 });
		expect(rounds([third])).toBe(3.5);
		expect(rounds([second])).toBe(2);
	});

	it('counts N rounds as N, and world time by what is left', () => {
		expect(rounds([moment({ kind: 'time', value: 3, units: 'rounds' })])).toBe(3);
		expect(rounds([moment({ kind: 'time', value: 1, units: 'minutes' })])).toBe(10);
		expect(
			rounds([moment({ kind: 'time', value: 1, units: 'minutes' })], { elapsedSeconds: 30 }),
		).toBe(5);
	});

	it('the first moment wins, so the shortest counts', () => {
		const moments = [
			moment({ kind: 'time', value: 1, units: 'minutes' }),
			moment({ boundary: 'end', clock: 'holder', span: 'nextTurn' }),
		];
		expect(rounds(moments)).toBe(1.5);
	});

	it('an event, or no moment, has no end', () => {
		expect(rounds([moment({ kind: 'event', who: 'holder', event: 'attack' })])).toBe(
			Number.POSITIVE_INFINITY,
		);
		expect(rounds([])).toBe(Number.POSITIVE_INFINITY);
	});

	it('reads a core duration of an older effect', () => {
		expect(rounds([], { duration: { value: 1, units: 'rounds' } })).toBe(1);
	});
});

describe('newApplicationLastsLonger', () => {
	const short = { lastsUntil: [moment({ boundary: 'end', clock: 'holder', span: 'nextTurn' })] };
	const long = { lastsUntil: [moment({ kind: 'time', value: 1, units: 'minutes' })] };

	it('is true only when the new one lasts longer than every current one', () => {
		expect(newApplicationLastsLonger(long, [short], context)).toBe(true);
		expect(newApplicationLastsLonger(short, [long], context)).toBe(false);
		expect(newApplicationLastsLonger(long, [short, long], context)).toBe(false);
	});

	it('a later counted turn replaces the next turn', () => {
		const third = {
			lastsUntil: [moment({ boundary: 'end', clock: 'holder', span: 'nextTurn', value: 3 })],
		};
		expect(newApplicationLastsLonger(third, [short], context)).toBe(true);
		expect(newApplicationLastsLonger(short, [third], context)).toBe(false);
	});
});
