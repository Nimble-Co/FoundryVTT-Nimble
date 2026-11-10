import { describe, expect, it } from 'vitest';
import {
	eventRowSubject,
	newMoment,
	removeAt,
	replaceAt,
	withEffectName,
	withSpan,
	withSubject,
	withValue,
} from '../momentForm.js';

describe('newMoment', () => {
	it('a turn moment is "the end of their next turn"', () => {
		expect(newMoment('turn')).toMatchObject({
			kind: 'turn',
			boundary: 'end',
			clock: 'holder',
			span: 'nextTurn',
		});
	});

	it('a time moment is "1 round passes"', () => {
		expect(newMoment('time')).toMatchObject({ kind: 'time', value: 1, units: 'rounds' });
	});

	it('an event is "they attack"', () => {
		expect(newMoment('event')).toMatchObject({ kind: 'event', who: 'holder', event: 'attack' });
	});

	it('"an effect ends" has no subject and a blank name', () => {
		expect(newMoment('effectEnds')).toMatchObject({
			kind: 'event',
			who: null,
			event: 'effectEnds',
			effectName: '',
		});
	});
});

describe('withSpan', () => {
	it('a round has no Clock', () => {
		expect(withSpan(newMoment('turn'), 'nextRound')).toMatchObject({
			span: 'nextRound',
			clock: null,
		});
	});

	it('a turn after a round gets the holder Clock back', () => {
		const round = withSpan(newMoment('turn'), 'currentRound');

		expect(withSpan(round, 'currentTurn')).toMatchObject({ span: 'currentTurn', clock: 'holder' });
	});

	it('a turn keeps its Clock', () => {
		const yours = { ...newMoment('turn'), clock: 'source' as const };

		expect(withSpan(yours, 'currentTurn').clock).toBe('source');
	});
});

describe('withValue', () => {
	it('keeps a whole number of 1 or more', () => {
		expect(withValue(newMoment('time'), 3.7).value).toBe(3);
		expect(withValue(newMoment('time'), 0).value).toBe(1);
		expect(withValue(newMoment('time'), Number.NaN).value).toBe(1);
	});
});

describe('withSubject', () => {
	it('keeps an event that the new subject allows', () => {
		const theyDrop = { ...newMoment('event'), event: 'zeroHp' as const };

		expect(withSubject(theyDrop, 'source')).toMatchObject({ who: 'source', event: 'zeroHp' });
	});

	it('takes the first event of the new subject when the old one is not allowed', () => {
		expect(withSubject(newMoment('event'), 'source')).toMatchObject({
			who: 'source',
			event: 'zeroHp',
		});
	});

	it('another effect ends has no subject', () => {
		const moment = withSubject(newMoment('event'), 'effect');

		expect(moment).toMatchObject({ who: null, event: 'effectEnds' });
		expect(eventRowSubject(moment)).toBe('effect');
	});

	it('back from another effect, the name goes', () => {
		const rage = withEffectName(newMoment('effectEnds'), '  Rage ');
		expect(rage.effectName).toBe('Rage');

		expect(withSubject(rage, 'holder')).toMatchObject({
			who: 'holder',
			event: 'attack',
			effectName: '',
		});
	});
});

describe('replaceAt and removeAt', () => {
	it('change one moment and leave the others', () => {
		const moments = [newMoment('turn'), newMoment('time')];
		const event = newMoment('event');

		expect(replaceAt(moments, 1, event)).toEqual([moments[0], event]);
		expect(removeAt(moments, 0)).toEqual([moments[1]]);
	});
});
