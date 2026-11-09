import { beforeAll, describe, expect, it } from 'vitest';
import type { ConditionRollMode } from '#types/conditionRollMode.d.ts';
import { appliedConditionRollModes } from '../appliedConditionRollModes.js';

function line(condition: string, step: number, on = true): ConditionRollMode {
	return { key: `self:${condition}`, condition, side: 'self', step, on, name: 'Kael' };
}

describe('appliedConditionRollModes', () => {
	beforeAll(() => {
		(Math as unknown as { clamp: (n: number, min: number, max: number) => number }).clamp = (
			n,
			min,
			max,
		) => Math.min(Math.max(n, min), max);
	});

	it('adds every line that starts on to the roll mode, and lists them for the card', () => {
		const result = appliedConditionRollModes(
			[line('poisoned', -1), line('frightened', -1), line('invisible', 1)],
			1,
		);

		expect(result.rollMode).toBe(0);
		expect(result.lines.map((each) => each.condition)).toEqual([
			'poisoned',
			'frightened',
			'invisible',
		]);
	});

	it('leaves out a line that starts off, and a step the slider end takes', () => {
		const result = appliedConditionRollModes(
			[line('poisoned', -1, false), line('invisible', 1)],
			6,
		);

		expect(result.rollMode).toBe(6);
		expect(result.lines).toEqual([]);
	});
});
