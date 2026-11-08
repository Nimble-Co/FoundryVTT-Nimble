import { describe, expect, it } from 'vitest';
import { ticksOfRow } from '../ticksOfRow.js';

describe('ticksOfRow', () => {
	it('keeps only the picked ticks that can go with the row, in the order they were picked', () => {
		expect(ticksOfRow({ tickIds: ['sand', 'decoy'] }, ['decoy', 'shove', 'sand'])).toEqual([
			'decoy',
			'sand',
		]);
	});

	it('keeps no tick for a row with none', () => {
		expect(ticksOfRow({ tickIds: [] }, ['sand'])).toEqual([]);
	});
});
