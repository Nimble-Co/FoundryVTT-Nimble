import { describe, expect, it } from 'vitest';
import localize from '#utils/localize.js';
import { woundRow } from '../woundRow.js';

function row(fields: Partial<Parameters<typeof woundRow>[0]> = {}) {
	return woundRow({
		node: { recipient: 'targets', amount: 1 },
		applied: undefined,
		canApply: true,
		hasRecipient: true,
		localize,
		format: localize,
		...fields,
	});
}

describe('woundRow', () => {
	it('names the Wounds, and the recipient on the button', () => {
		expect(row()).toMatchObject({ name: '1 Wound', button: { label: 'Apply to Targets' } });
		expect(row({ node: { recipient: 'self', amount: 2 } })).toMatchObject({
			name: '2 Wounds',
			button: { label: 'Apply to You', disabled: false },
		});
	});

	it('has no button for a player who did not roll the card, and a disabled one with no targets', () => {
		expect(row({ canApply: false }).button).toBeNull();
		expect(row({ hasRecipient: false }).button).toMatchObject({
			disabled: true,
			tooltip: 'This card has no targets.',
		});
	});

	it('shows who took the Wounds in place of the button', () => {
		const view = row({
			applied: {
				Actor_tessa: { actorName: 'Tessa', before: 0, after: 1 },
				Actor_bram: { actorName: 'Bram', before: 6, after: 6 },
			},
		});

		expect(view.button).toBeNull();
		expect(view.appliedLines).toEqual(['On Tessa, Bram']);
		expect(view.noTrackLines).toEqual([]);
	});

	it('says that a creature with no Wound track took none', () => {
		const view = row({
			applied: {
				Actor_tessa: { actorName: 'Tessa', before: 0, after: 1 },
				Scene_s_Token_k_Actor_kobold: { actorName: 'Kobold', noTrack: true },
			},
		});

		expect(view.appliedLines).toEqual(['On Tessa']);
		expect(view.noTrackLines).toEqual(['Kobold has no Wounds']);
		expect(row({ applied: { k: { actorName: 'Kobold', noTrack: true } } }).appliedLines).toEqual(
			[],
		);
	});
});
