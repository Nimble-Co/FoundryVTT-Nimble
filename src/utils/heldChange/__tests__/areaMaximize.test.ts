import { afterEach, describe, expect, it, vi } from 'vitest';
import { maximizedPackets, maxTotalOf } from '../areaMaximize.js';

interface Die {
	faces: number;
	results: { result: number; active?: boolean; discarded?: boolean }[];
}

function stubRoll(total: number, dice: Die[]) {
	vi.stubGlobal('Roll', { fromData: () => ({ total, dice }) });
}

const packet = (value: number, options: Record<string, unknown> = {}) => ({
	value,
	options: { roll: { formula: '2d6+2' }, ...options },
});

afterEach(() => {
	vi.unstubAllGlobals();
});

describe('maxTotalOf', () => {
	it('raises each die the roll kept to its highest face', () => {
		stubRoll(7, [{ faces: 6, results: [{ result: 2 }, { result: 3 }] }]);
		expect(maxTotalOf({ formula: '2d6+2' })).toBe(14);
	});

	it('leaves the dice that the roll dropped out, as damage advantage drops them', () => {
		stubRoll(9, [
			{
				faces: 6,
				results: [{ result: 1, active: false, discarded: true }, { result: 4 }, { result: 5 }],
			},
		]);
		expect(maxTotalOf({ formula: '3d6kh2' })).toBe(12);
	});

	it('is null with no roll, or a roll that cannot be read', () => {
		vi.stubGlobal('Roll', {
			fromData: () => {
				throw new Error('bad data');
			},
		});
		expect(maxTotalOf(null)).toBeNull();
		expect(maxTotalOf({ formula: '2d6+2' })).toBeNull();
	});
});

describe('maximizedPackets', () => {
	it('gives each packet its highest total', () => {
		stubRoll(7, [{ faces: 6, results: [{ result: 2 }, { result: 3 }] }]);
		expect(maximizedPackets([packet(7)]).map((each) => each.value)).toEqual([14]);
	});

	it('keeps half damage and the multiplier of the packet, rounded up', () => {
		stubRoll(7, [{ faces: 6, results: [{ result: 1 }, { result: 1 }] }]);
		const values = maximizedPackets([
			packet(4, { outcome: 'halfDamage' }),
			packet(10, { damageMultiplier: 2 }),
		]).map((each) => each.value);
		expect(values).toEqual([9, 34]);
	});

	it('keeps the rolled value when the roll cannot be read', () => {
		vi.stubGlobal('Roll', {
			fromData: () => {
				throw new Error('bad data');
			},
		});
		expect(maximizedPackets([packet(7)]).map((each) => each.value)).toEqual([7]);
	});
});
