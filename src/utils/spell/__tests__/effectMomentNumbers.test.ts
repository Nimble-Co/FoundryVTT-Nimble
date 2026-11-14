import { describe, expect, it } from 'vitest';
import type { Moment } from '#utils/lastsUntil/momentReached.js';
import { effectMomentNumbers } from '#utils/spell/effectMomentNumbers.js';

const blank: Moment = {
	kind: 'turn',
	boundary: 'end',
	clock: 'holder',
	span: 'nextTurn',
	value: null,
	units: null,
	who: null,
	event: null,
	effectName: '',
};

const asleep = {
	name: 'Asleep',
	system: {
		lastsUntil: [
			{
				...blank,
				kind: 'event',
				boundary: null,
				clock: null,
				span: null,
				who: 'holder',
				event: 'takeDamage',
			},
			{ ...blank, value: 2 },
			{
				...blank,
				kind: 'time',
				boundary: null,
				clock: null,
				span: null,
				value: 1,
				units: 'minutes',
			},
		],
	},
};
const marked = { name: 'Marked', system: { lastsUntil: [{ ...blank, span: 'currentTurn' }] } };

function itemWith(effects: Record<string, object>, recipient = 'targets') {
	return {
		system: {
			activation: {
				effects: [
					{
						id: 'save1',
						type: 'savingThrow',
						parentContext: null,
						parentNode: null,
						on: {
							failedSave: [
								{
									id: 'apply1',
									type: 'applyEffect',
									effectId: 'sleep',
									recipient,
									parentContext: 'failedSave',
									parentNode: 'save1',
								},
							],
						},
					},
					{
						id: 'apply2',
						type: 'applyEffect',
						effectId: 'mark',
						recipient: 'targets',
						parentContext: null,
						parentNode: null,
					},
					{
						id: 'apply3',
						type: 'applyEffect',
						effectId: null,
						condition: 'dazed',
						recipient: 'targets',
						parentContext: null,
						parentNode: null,
					},
				],
			},
		},
		effects: { get: (id: string) => effects[id] },
	};
}

describe('effectMomentNumbers', () => {
	it('lists each Apply Effect step whose effect has a moment with a number, with those moments', () => {
		const result = effectMomentNumbers(itemWith({ sleep: asleep, mark: marked }) as never);

		expect(result).toEqual([
			{
				nodeId: 'apply1',
				label: 'Asleep',
				moments: [
					{ index: 1, label: 'Until the end of their 2nd next turn', units: 'turns' },
					{ index: 2, label: 'For 1 minute', units: 'minutes' },
				],
			},
		]);
	});

	it('reads the moments for the user on a step that puts the effect on them', () => {
		const [target] = effectMomentNumbers(itemWith({ sleep: asleep }, 'self') as never);

		expect(target.moments[0].label).toBe('Until the end of your 2nd next turn');
	});
});
