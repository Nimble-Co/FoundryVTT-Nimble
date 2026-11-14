import { describe, expect, it } from 'vitest';
import localize from '#utils/localize.js';
import { endConditionsRow } from '../endConditionsRow.js';

function row(fields: Partial<Parameters<typeof endConditionsRow>[0]> = {}) {
	return endConditionsRow({
		node: { recipient: 'self', which: 'negative', conditions: [] },
		ended: undefined,
		conditionNames: { dazed: 'Dazed', poisoned: 'Poisoned' },
		canApply: true,
		hasRecipient: true,
		localize,
		format: localize,
		...fields,
	});
}

describe('endConditionsRow', () => {
	it('names what the step ends, and the recipient on the button', () => {
		expect(row()).toMatchObject({
			name: 'End negative conditions',
			button: { label: 'Apply to You' },
		});
		expect(
			row({ node: { recipient: 'targets', which: 'listed', conditions: ['dazed', 'poisoned'] } }),
		).toMatchObject({ name: 'End Dazed, Poisoned', button: { label: 'Apply to Targets' } });
	});

	it('has no button for a player who did not roll the card, and a disabled one with no targets', () => {
		expect(row({ canApply: false }).button).toBeNull();
		expect(row({ hasRecipient: false }).button).toMatchObject({ disabled: true });
	});

	it('says where it ended conditions and where there was nothing to end', () => {
		const view = row({
			ended: {
				Actor_tessa: { actorName: 'Tessa', ended: ['Dazed'] },
				Actor_bram: { actorName: 'Bram', ended: [] },
			},
		});

		expect(view.button).toBeNull();
		expect(view.appliedLines).toEqual(['Ended on Tessa']);
		expect(view.notes).toEqual(['Nothing to end on Bram']);
	});
});
