import { fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { SYSTEM_ID } from '#system';
import type { EffectNode } from '#types/effectTree.js';
import { getRelevantNodes } from '../../../dataPreparationHelpers/effectTree/getRelevantNodes.js';
import ItemCardEffectsTestHarness from './ItemCardEffects.testHarness.svelte';

const node = {
	id: 'e1',
	type: 'endConditions',
	recipient: 'targets',
	which: 'negative',
	conditions: [],
	parentNode: null,
	parentContext: null,
} as EffectNode;

const bram = { uuid: 'Actor.bram', name: 'Bram', effects: [], statuses: new Set<string>() };

function message(ended?: unknown) {
	const card = {
		id: 'message-1',
		author: { id: 'player' },
		flags: { [SYSTEM_ID]: ended ? { endedConditions: ended } : {} },
		effectNodes: getRelevantNodes([node], ['hit']),
		system: { targets: ['Scene.s.Token.bram'], activation: { effects: [node] } },
		update: vi.fn(async () => undefined),
		reactive: null as unknown,
	};
	card.reactive = card;
	return card;
}

let previousUser: unknown;

beforeEach(() => {
	const g = globalThis as unknown as { game: { user: unknown } };
	previousUser = g.game.user;
	g.game.user = { id: 'player', isGM: false };
	vi.stubGlobal(
		'fromUuidSync',
		vi.fn((uuid: string) => (uuid === 'Scene.s.Token.bram' ? { actor: bram } : null)),
	);
});

afterEach(() => {
	(globalThis as unknown as { game: { user: unknown } }).game.user = previousUser;
	vi.unstubAllGlobals();
});

describe('EndConditionsNode on the card', () => {
	it('sits in the Effects part, and a click records a target with nothing to end', async () => {
		const card = message();
		render(ItemCardEffectsTestHarness, { props: { messageDocument: card } });

		expect(screen.getByRole('heading', { name: 'Effects' })).toBeTruthy();
		expect(screen.getByText('End negative conditions')).toBeTruthy();
		await fireEvent.click(screen.getByRole('button', { name: /Apply to Targets/ }));

		await waitFor(() =>
			expect(card.update).toHaveBeenCalledWith({
				[`flags.${SYSTEM_ID}.endedConditions.e1.Actor_bram`]: { actorName: 'Bram', ended: [] },
			}),
		);
	});

	it('shows where it ended conditions, with no button', () => {
		render(ItemCardEffectsTestHarness, {
			props: {
				messageDocument: message({
					e1: {
						Actor_tessa: { actorName: 'Tessa', ended: ['Dazed'] },
						Actor_bram: { actorName: 'Bram', ended: [] },
					},
				}),
			},
		});

		expect(screen.getByText('Ended on Tessa')).toBeTruthy();
		expect(screen.getByText('Nothing to end on Bram')).toBeTruthy();
		expect(screen.queryByRole('button', { name: /Apply to Targets/ })).toBeNull();
	});
});
