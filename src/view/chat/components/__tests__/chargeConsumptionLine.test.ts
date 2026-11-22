import { describe, expect, it } from 'vitest';

import { chargeConsumptionLine } from '../chargeConsumptionLine.ts';

const spent = {
	poolId: 'combat-dice',
	poolLabel: 'Combat Dice',
	previousValue: 3,
	currentValue: 2,
	maxValue: 3,
	change: -1,
};

describe('chargeConsumptionLine', () => {
	it('says what the use spent and what is left, in one line', () => {
		expect(chargeConsumptionLine(spent)).toEqual({
			text: 'Combat Dice: spent 1, 2 of 3 left',
			tooltip: null,
		});
	});

	it('moves the note of the pool label to the tooltip', () => {
		expect(
			chargeConsumptionLine({
				...spent,
				poolLabel: 'Assist Me, My Friend! (1/round)',
				previousValue: 1,
				currentValue: 0,
				maxValue: 1,
			}),
		).toEqual({
			text: 'Assist Me, My Friend!: spent 1, 0 of 1 left',
			tooltip: 'Assist Me, My Friend! (1/round)',
		});
	});

	it('gives the count alone for a pool that hides its maximum', () => {
		expect(chargeConsumptionLine({ ...spent, hideMax: true }).text).toBe(
			'Combat Dice: spent 1, 2 left',
		);
	});

	it('says what a recovery gave back, with its trigger as the tooltip', () => {
		expect(
			chargeConsumptionLine({
				...spent,
				change: -1,
				recovery: { trigger: 'onHit', previousValue: 2, newValue: 3 },
			}),
		).toEqual({ text: 'Combat Dice: regained 1, 3 of 3 left', tooltip: 'On Hit' });
	});
});
