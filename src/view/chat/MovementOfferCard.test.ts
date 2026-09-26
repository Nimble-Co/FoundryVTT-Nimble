import { render, screen } from '@testing-library/svelte';
import MovementOfferCard from './MovementOfferCard.svelte';

type Globals = Record<string, any>;
const g = globalThis as Globals;

const node = {
	id: 'node1',
	type: 'move',
	kind: 'forced',
	recipient: 'targets',
	distance: '2',
	distanceBySize: {},
	ignoreDifficultTerrain: true,
	direction: 'away',
	chooser: 'source',
	parentContext: null,
	parentNode: null,
};

function createMessage() {
	const message = {
		id: 'msg1',
		timestamp: 0,
		author: { color: '#336699' },
		system: {
			actorName: 'Sir Brannon',
			image: '',
			name: 'Shove',
			reason: 'Sir Brannon hit the goblin.',
			targets: ['Scene.s1.Token.tok1'],
			activation: { effects: [node] },
			movementOffers: [
				{
					id: 'node1.tok1',
					nodeId: 'node1',
					tokenUuid: 'Scene.s1.Token.tok1',
					name: 'Goblin Cutthroat',
					kind: 'forced',
					spaces: 2,
					ignoreDifficultTerrain: true,
					state: 'open',
					usedBy: null,
					movedSpaces: null,
					stopped: false,
				},
			],
		},
		reactive: null as unknown,
		delete: vi.fn(),
	};
	message.reactive = message;
	return message;
}

let previous: Record<string, unknown>;

beforeEach(() => {
	previous = { settings: g.game.settings, timeSince: g.foundry.utils.timeSince };
	g.game.settings = { get: vi.fn(() => true) };
	g.foundry.utils.timeSince = () => 'now';
});

afterEach(() => {
	g.game.settings = previous.settings;
	g.foundry.utils.timeSince = previous.timeSince;
});

describe('MovementOfferCard', () => {
	it('shows the feature name, the reason and the offer from its move node', () => {
		const { container } = render(MovementOfferCard, {
			props: { messageDocument: createMessage() as never },
		});

		expect(screen.getByRole('heading', { name: 'Shove' })).toBeTruthy();
		expect(screen.getByText('Sir Brannon hit the goblin.')).toBeTruthy();
		expect(screen.getByText('Forced Movement')).toBeTruthy();
		expect(screen.getByText('Goblin Cutthroat')).toBeTruthy();
		expect(screen.getByText(/up to 2 spaces/)).toBeTruthy();
		expect(screen.getByText(/away from Sir Brannon/)).toBeTruthy();
		expect(container.querySelector('article')?.querySelector('button')).toBeNull();
	});
});
