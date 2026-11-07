import { render } from '@testing-library/svelte';
import AssessActionCard from '../AssessActionCard.svelte';

type Globals = Record<string, any>;
const globals = globalThis as Globals;

function createMessage(system: Record<string, unknown> = {}) {
	const message = {
		id: 'assess-1',
		type: 'assessAction',
		timestamp: 0,
		author: { color: '#336699' },
		system: {
			actorName: 'Pip',
			actorType: 'character',
			permissions: 0,
			rollMode: 0,
			skillKey: 'insight',
			dc: 12,
			isSuccess: true,
			optionTitle: 'Assess',
			resultMessage: '',
			target: null,
			targetName: null,
			primaryDieChange: null,
			...system,
		},
		rolls: [{ total: 1, dice: [], terms: [{ faces: 20, results: [{ result: 3, active: true }] }] }],
		reactive: null as unknown,
		delete: vi.fn(),
	};
	message.reactive = message;
	return message;
}

const resultLine = () =>
	document.querySelector('.nimble-result-line__text')?.textContent?.replace(/\s+/g, ' ').trim();

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

describe('the Assess card', () => {
	it('names the feature whose natural 20 made the Assess succeed', () => {
		render(AssessActionCard, {
			props: { messageDocument: createMessage({ countsAsNat20Feature: 'Bumblewise' }) as never },
		});

		expect(resultLine()).toBe('Counts as a Natural 20 with Bumblewise');
	});

	it('shows no such line on a card posted before the field', () => {
		render(AssessActionCard, { props: { messageDocument: createMessage() as never } });

		expect(resultLine()).toBeUndefined();
	});
});
