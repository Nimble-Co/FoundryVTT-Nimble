import { fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { SYSTEM_ID } from '#system';
import type { EffectNode } from '#types/effectTree.js';
import { getRelevantNodes } from '../../../dataPreparationHelpers/effectTree/getRelevantNodes.js';
import ItemCardEffectsTestHarness from './ItemCardEffects.testHarness.svelte';

const node = {
	id: 'w1',
	type: 'wound',
	amount: 2,
	recipient: 'targets',
	parentNode: null,
	parentContext: null,
} as EffectNode;

const tessa = {
	uuid: 'Actor.tessa',
	name: 'Tessa',
	isOwner: true,
	system: { attributes: { wounds: { value: 1, max: 6 } } },
	update: vi.fn(async () => undefined),
};

function message(applied?: unknown) {
	const card = {
		id: 'message-1',
		author: { id: 'player' },
		flags: { [SYSTEM_ID]: applied ? { appliedWounds: applied } : {} },
		effectNodes: getRelevantNodes([node], ['hit']),
		system: { targets: ['Scene.s.Token.tessa'], activation: { effects: [node] } },
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
	tessa.update.mockClear();
	vi.stubGlobal(
		'fromUuidSync',
		vi.fn((uuid: string) => (uuid === 'Scene.s.Token.tessa' ? { actor: tessa } : null)),
	);
});

afterEach(() => {
	(globalThis as unknown as { game: { user: unknown } }).game.user = previousUser;
	vi.unstubAllGlobals();
});

describe('WoundNode on the card', () => {
	it('sits in the Effects part, and a click gives the targets the Wounds and records them', async () => {
		const card = message();
		render(ItemCardEffectsTestHarness, { props: { messageDocument: card } });

		expect(screen.getByRole('heading', { name: 'Effects' })).toBeTruthy();
		expect(screen.getByText('2 Wounds')).toBeTruthy();
		await fireEvent.click(screen.getByRole('button', { name: /Apply to Targets/ }));

		await waitFor(() =>
			expect(card.update).toHaveBeenCalledWith({
				[`flags.${SYSTEM_ID}.appliedWounds.w1.Actor_tessa`]: {
					actorName: 'Tessa',
					before: 1,
					after: 3,
				},
			}),
		);
		expect(tessa.update).toHaveBeenCalledWith({ 'system.attributes.wounds.value': 3 });
	});

	it('shows who took the Wounds and who has no track, with no button', () => {
		render(ItemCardEffectsTestHarness, {
			props: {
				messageDocument: message({
					w1: {
						Actor_tessa: { actorName: 'Tessa', before: 1, after: 3 },
						Actor_kobold: { actorName: 'Kobold', noTrack: true },
					},
				}),
			},
		});

		expect(screen.getByText('On Tessa')).toBeTruthy();
		expect(screen.getByText('Kobold has no Wounds')).toBeTruthy();
		expect(screen.queryByRole('button', { name: /Apply to Targets/ })).toBeNull();
	});
});
