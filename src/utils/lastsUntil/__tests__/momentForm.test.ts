import { describe, expect, it } from 'vitest';
import {
	COMBAT_COUNTS,
	eventRowSubject,
	NEW_MOMENT_KINDS,
	newMoment,
	removeAt,
	replaceAt,
	spanChoiceOf,
	spanChoices,
	spanChoiceWord,
	withClock,
	withCombatCount,
	withEffectName,
	withSpan,
	withSpanChoice,
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

	it('a time moment is "1 minute passes"', () => {
		expect(newMoment('time')).toMatchObject({ kind: 'time', value: 1, units: 'minutes' });
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

describe('"combat ends" with a count', () => {
	it('is a choice of the add list, with no subject', () => {
		expect(NEW_MOMENT_KINDS).toContain('combatEnd');
		expect(newMoment('combatEnd')).toMatchObject({
			kind: 'event',
			who: null,
			event: 'combatEnd',
			value: null,
		});
	});

	it('counts from "combat ends" to "the 5th combat ends"', () => {
		expect(COMBAT_COUNTS).toEqual([1, 2, 3, 4, 5]);
	});

	it('a count of 1 is "combat ends", with no value', () => {
		const combatEnds = newMoment('combatEnd');

		expect(withCombatCount(combatEnds, 3).value).toBe(3);
		expect(withCombatCount(withCombatCount(combatEnds, 3), 1).value).toBeNull();
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

describe('the turn list with counts', () => {
	it('puts "2nd next turn" to "5th next turn" after "next turn"', () => {
		expect(spanChoices('holder')).toEqual([
			'nextTurn',
			'nextTurn:2',
			'nextTurn:3',
			'nextTurn:4',
			'nextTurn:5',
			'currentTurn',
			'currentRound',
			'nextRound',
		]);
		expect(spanChoices('nextHero')).not.toContain('nextTurn:2');
	});

	it('a count is the value of the moment, and another span drops it', () => {
		const second = withSpanChoice(newMoment('turn'), 'nextTurn:2');

		expect(second).toMatchObject({ span: 'nextTurn', value: 2 });
		expect(spanChoiceOf(second)).toBe('nextTurn:2');
		expect(withSpanChoice(second, 'currentTurn')).toMatchObject({
			span: 'currentTurn',
			value: null,
		});
		expect(withClock(second, 'nextHero').value).toBeNull();
	});
});

describe('the turn list for a count that an upcast raised', () => {
	it('adds the count of the moment after "5th next turn", and reads it as "8th next turn"', () => {
		const eighth = withSpanChoice(newMoment('turn'), 'nextTurn:5');
		eighth.value = 8;

		expect(spanChoices('holder', eighth)).toContain('nextTurn:8');
		expect(spanChoices('holder', eighth).indexOf('nextTurn:8')).toBe(5);
		expect(spanChoices('holder', { ...eighth, value: 3 })).not.toContain('nextTurn:8');
		expect(spanChoiceOf(eighth)).toBe('nextTurn:8');
		expect(spanChoiceWord('nextTurn:8')).toEqual(['nextTurnCountMany', { count: '8' }]);
		expect(spanChoiceWord('nextTurn:2')).toEqual(['nextTurnCount.2', {}]);
		expect(spanChoiceWord('currentTurn')).toEqual(['span.currentTurn', {}]);
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
		const theyMove = { ...newMoment('event'), event: 'move' as const };

		expect(withSubject(theyMove, 'source')).toMatchObject({ who: 'source', event: 'attack' });
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
