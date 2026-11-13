import { render, screen } from '@testing-library/svelte';
import { SYSTEM_ID } from '#system';
import MoveActionCard from '../MoveActionCard.svelte';

type Globals = Record<string, any>;
const globals = globalThis as Globals;

function createMessage(events: unknown[] = []) {
	const message = {
		id: 'move-1',
		type: 'moveAction',
		timestamp: 0,
		author: { color: '#336699' },
		system: { actorName: 'Pip', speed: 6 },
		flags: { [SYSTEM_ID]: { events } },
		reactive: null as unknown,
	};
	message.reactive = message;
	return message;
}

let previous: Record<string, unknown>;

beforeEach(() => {
	previous = { timeSince: globals.foundry.utils.timeSince, settings: globals.game.settings };
	globals.foundry.utils.timeSince = () => 'now';
	globals.game.settings = { get: () => false };
});

afterEach(() => {
	globals.foundry.utils.timeSince = previous.timeSince;
	globals.game.settings = previous.settings;
});

describe('the Move card', () => {
	it('shows the lines of its Events strip', () => {
		const message = createMessage([
			{
				id: 'used-up',
				kind: 'poolGain',
				icon: 'fa-solid fa-dice-d6',
				text: { key: 'NIMBLE.lastsUntil.chat.heading.rest', data: { name: 'Pip' } },
				at: 1,
			},
		]);
		render(MoveActionCard, { props: { messageDocument: message as never } });

		expect(screen.getByRole('region', { name: 'Events' })).toHaveTextContent('Pip rested');
	});

	it('shows no Events strip with no lines', () => {
		render(MoveActionCard, { props: { messageDocument: createMessage() as never } });

		expect(screen.queryByRole('region', { name: 'Events' })).toBeNull();
	});
});
