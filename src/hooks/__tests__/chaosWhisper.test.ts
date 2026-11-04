import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const whisper = vi.fn(async () => undefined);
let tableOpen = false;
let activeGm = true;

function card(system: object, id = 'c1') {
	const flags: Record<string, unknown> = {};
	return {
		id,
		type: 'chaos',
		system: { actorName: 'Hero', table: 'chaos', rolls: [], kept: null, ...system },
		getFlag: (_scope: string, key: string) => flags[key],
		setFlag: async (_scope: string, key: string, value: unknown) => {
			flags[key] = value;
		},
	};
}

const roll = (value: number) => ({ value, dropped: null, name: '', text: '' });

describe('whisperFinishedChaosCard', () => {
	let whisperFinishedChaosCard: typeof import('../chaosWhisper.js').whisperFinishedChaosCard;

	beforeEach(async () => {
		whisper.mockClear();
		tableOpen = false;
		activeGm = true;
		vi.resetModules();
		vi.doMock('#utils/isActiveGM.js', () => ({ isActiveGM: () => activeGm }));
		vi.doMock('../../settings/chaosTableSettings.js', () => ({
			showsChaosTableRolls: () => tableOpen,
		}));
		vi.doMock('#utils/chaos/invokeChaos.js', () => ({ whisperChaosRollsToGm: whisper }));
		({ whisperFinishedChaosCard } = await import('../chaosWhisper.js'));
	});

	afterEach(() => {
		vi.doUnmock('#utils/isActiveGM.js');
		vi.doUnmock('../../settings/chaosTableSettings.js');
		vi.doUnmock('#utils/chaos/invokeChaos.js');
	});

	it('tells the GM all rolls of a finished card, one time', async () => {
		const done = card({ status: 'done', rolls: [roll(3), roll(9)] });

		await whisperFinishedChaosCard(done as never);
		await whisperFinishedChaosCard(done as never);

		expect(whisper).toHaveBeenCalledTimes(1);
		expect(whisper).toHaveBeenCalledWith('Hero', [roll(3), roll(9)], 'chaos');
	});

	it('tells only the kept roll after a choice', async () => {
		await whisperFinishedChaosCard(
			card({ status: 'done', rolls: [roll(3), roll(9)], kept: 1 }) as never,
		);

		expect(whisper).toHaveBeenCalledWith('Hero', [roll(9)], 'chaos');
	});

	it('waits while the player still chooses', async () => {
		await whisperFinishedChaosCard(card({ status: 'picking', rolls: [roll(3)] }) as never);

		expect(whisper).not.toHaveBeenCalled();
	});

	it('does nothing on a player client', async () => {
		activeGm = false;

		await whisperFinishedChaosCard(card({ status: 'done', rolls: [roll(3)] }) as never);

		expect(whisper).not.toHaveBeenCalled();
	});

	it('does nothing when the table text is on the card', async () => {
		tableOpen = true;

		await whisperFinishedChaosCard(card({ status: 'done', rolls: [roll(3)] }) as never);

		expect(whisper).not.toHaveBeenCalled();
	});
});
