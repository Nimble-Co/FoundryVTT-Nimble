import { fireEvent, render, screen } from '@testing-library/svelte';
import HealingNodeTestHarness from './HealingNode.testHarness.svelte';

/**
 * Apply Healing stays clickable with no targets stored, so the click can
 * adopt the user's current targets. The GM-or-author gate is unchanged.
 */

const node = {
	id: 'heal-1',
	healingType: 'healing',
	recipient: 'targets',
	roll: { class: 'Roll', formula: '1d8', total: 6, terms: [] },
};

function messageFor(authorId: string) {
	const message = {
		author: { id: authorId },
		system: {
			actorType: 'npc',
			permissions: 0,
			targets: [] as string[],
			appliedHealing: {},
			activation: { effects: [] },
		},
		reactive: null as unknown,
		applyHealing: vi.fn(),
	};
	message.reactive = message;
	return message;
}

type GameStub = { user: { isGM?: boolean; id?: string } };
const gameStub = () => (globalThis as unknown as { game: GameStub }).game;

let previousUser: GameStub['user'];

beforeEach(() => {
	previousUser = gameStub().user;
	vi.stubGlobal('canvas', { tokens: { controlled: [] } });
});

afterEach(() => {
	gameStub().user = previousUser;
	vi.stubGlobal('canvas', undefined);
});

function applyButton() {
	return screen.queryByRole('button', { name: 'Apply Healing' }) as HTMLButtonElement | null;
}

describe('Apply Healing with no stored targets', () => {
	it('stays clickable for the card author, and the click applies', async () => {
		gameStub().user = { isGM: false, id: 'player' };
		const message = messageFor('player');
		render(HealingNodeTestHarness, { props: { messageDocument: message, node } });

		const button = applyButton();
		expect(button).not.toBeNull();
		expect(button?.disabled).toBe(false);
		await fireEvent.click(button as HTMLButtonElement);

		expect(message.applyHealing).toHaveBeenCalledWith(6, 'healing', 'heal-1', 'targets');
	});

	it('stays clickable for the GM', () => {
		gameStub().user = { isGM: true, id: 'gm' };
		render(HealingNodeTestHarness, {
			props: { messageDocument: messageFor('someone-else'), node },
		});

		expect(applyButton()?.disabled).toBe(false);
	});

	it('is absent for a player who did not roll the card', () => {
		gameStub().user = { isGM: false, id: 'player' };
		render(HealingNodeTestHarness, {
			props: { messageDocument: messageFor('someone-else'), node },
		});

		expect(applyButton()).toBeNull();
	});
});
