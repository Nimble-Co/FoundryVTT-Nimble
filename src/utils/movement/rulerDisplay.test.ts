import { describe, expect, it } from 'vitest';
import { budgetText, endsReach, moveColor, moveDie, readMoveColors } from './rulerDisplay.js';

const colors = { 2: 0x222222, 3: 0x333333, over: 0xff0000 };
const styleOf = (values: Record<string, string>) => ({
	getPropertyValue: (name: string) => values[name] ?? '',
});

describe('readMoveColors', () => {
	it('reads each colour from its variable', () => {
		const style = styleOf({
			'--nimble-ruler-move-2-color': ' #f2c94c ',
			'--nimble-ruler-move-3-color': '#F2994A',
			'--nimble-ruler-move-over-color': '#eb5757',
		});
		expect(readMoveColors(style)).toEqual({ 2: 0xf2c94c, 3: 0xf2994a, over: 0xeb5757 });
	});

	it('leaves out a colour that is missing or not a 6-digit hex colour', () => {
		const style = styleOf({
			'--nimble-ruler-move-2-color': 'hsl(40, 80%, 60%)',
			'--nimble-ruler-move-over-color': '#e55',
		});
		expect(readMoveColors(style)).toEqual({});
	});
});

describe('moveColor', () => {
	const band = (moveBand?: number, unreachable = false) => ({ moveBand, unreachable });

	it('keeps the user colour for the first Move and for a waypoint in no Move', () => {
		expect(moveColor(band(1), colors)).toBeUndefined();
		expect(moveColor(band(), colors)).toBeUndefined();
	});

	it('gives the second and third Move a colour each, and every Move past the third one colour', () => {
		expect(moveColor(band(2), colors)).toBe(0x222222);
		expect(moveColor(band(3), colors)).toBe(0x333333);
		expect(moveColor(band(4), colors)).toBe(0xff0000);
		expect(moveColor(band(9), colors)).toBe(0xff0000);
	});

	it('keeps the user colour for a waypoint out of reach', () => {
		expect(moveColor(band(2, true), colors)).toBeUndefined();
	});

	it('keeps the user colour when the style sheet gave none', () => {
		expect(moveColor(band(2), {})).toBeUndefined();
		expect(moveColor(band(4), {})).toBeUndefined();
	});
});

describe('moveDie', () => {
	it('shows the die of the Move', () => {
		expect(moveDie({ moveBand: 1 })).toEqual({ icon: 'fa-dice-one', over: false });
		expect(moveDie({ moveBand: 3 })).toEqual({ icon: 'fa-dice-three', over: false });
	});

	it('keeps the third die past the third Move and says it is over', () => {
		expect(moveDie({ moveBand: 5 })).toEqual({ icon: 'fa-dice-three', over: true });
	});

	it('shows no die for a waypoint in no Move', () => {
		expect(moveDie({})).toBeNull();
	});
});

describe('endsReach', () => {
	it('is true only for the last waypoint in reach before one out of reach', () => {
		expect(endsReach({ unreachable: false, next: { unreachable: true } })).toBe(true);
		expect(endsReach({ unreachable: false, next: { unreachable: false } })).toBe(false);
		expect(endsReach({ unreachable: true, next: { unreachable: true } })).toBe(false);
		expect(endsReach({ unreachable: false, next: null })).toBe(false);
		expect(endsReach({ unreachable: false })).toBe(false);
	});
});

describe('budgetText', () => {
	it('is empty for a waypoint under no offered movement', () => {
		expect(budgetText({})).toBe('');
	});

	it.each(['free', 'forced'] as const)(
		'names the %s movement with its spaces and limit',
		(kind) => {
			const text = budgetText({ offerBand: { kind, spaces: 7, limit: 9 } });
			expect(text).toContain('7');
			expect(text).toContain('9');
			expect(text).not.toContain('NIMBLE.');
		},
	);

	it('gives the two kinds different text', () => {
		const band = { spaces: 1, limit: 2 };
		expect(budgetText({ offerBand: { kind: 'free', ...band } })).not.toBe(
			budgetText({ offerBand: { kind: 'forced', ...band } }),
		);
	});
});
