import { render, screen } from '@testing-library/svelte';
import TargetsTestHarness from './Targets.testHarness.svelte';

type Globals = { game: { settings: unknown }; fromUuid: unknown };

const g = globalThis as unknown as Globals;

const GOBLIN_TOKEN = 'Scene.s1.Token.tok1';
const ARCHER_TOKEN = 'Scene.s1.Token.tok2';

function createToken(uuid: string, name: string) {
	return {
		uuid,
		name,
		texture: { src: `${name}.webp` },
		actor: { name, type: 'character', system: { attributes: { armor: null } } },
		object: null,
	};
}

const TOKENS: Record<string, ReturnType<typeof createToken>> = {
	[GOBLIN_TOKEN]: createToken(GOBLIN_TOKEN, 'Goblin Cutthroat'),
	[ARCHER_TOKEN]: createToken(ARCHER_TOKEN, 'Goblin Archer'),
};

function createMessage() {
	const system = {
		actorName: 'Sir Brannon',
		targets: [GOBLIN_TOKEN, ARCHER_TOKEN],
		activation: {
			effects: [
				{
					id: 'node1',
					type: 'move',
					kind: 'forced',
					recipient: 'targets',
					distance: '2',
					distanceBySize: {},
					ignoreDifficultTerrain: true,
					direction: 'away',
					parentContext: null,
					parentNode: null,
				},
			],
		},
		movementOffers: [
			{
				id: 'node1.tok1',
				nodeId: 'node1',
				tokenUuid: GOBLIN_TOKEN,
				name: 'Goblin Cutthroat',
				kind: 'forced',
				spaces: 2,
				ignoreDifficultTerrain: true,
				state: 'taken',
				usedBy: 'player',
				movedSpaces: 2,
				stopped: false,
				conditional: false,
			},
		],
	};
	const message = {
		id: 'msg1',
		speaker: { scene: 's1', token: 'hero', actor: 'a1' },
		system,
		getDamageBreakdownForTarget: () => null,
	};
	return { ...message, reactive: message };
}

let previousSettings: unknown;
let previousFromUuid: unknown;

beforeEach(() => {
	previousSettings = g.game.settings;
	previousFromUuid = g.fromUuid;
	g.game.settings = { get: vi.fn(() => true) };
	g.fromUuid = vi.fn(async (uuid: string) => TOKENS[uuid] ?? null);
});

afterEach(() => {
	g.game.settings = previousSettings;
	g.fromUuid = previousFromUuid;
});

describe('Targets', () => {
	it('shows the movement chip on the row of the creature that moved', async () => {
		const { container } = render(TargetsTestHarness, {
			props: { messageDocument: createMessage() },
		});

		const chip = await screen.findByRole('img', { name: 'Pushed the full 2 spaces.' });
		expect(chip.textContent?.trim()).toBe('2/2');
		expect(chip.dataset.status).toBe('taken');

		const rows = [...container.querySelectorAll<HTMLElement>('.nimble-target-list > li')];
		const goblinRow = rows.find((row) => row.textContent?.includes('Goblin Cutthroat'));
		const archerRow = rows.find((row) => row.textContent?.includes('Goblin Archer'));
		expect(goblinRow?.contains(chip)).toBe(true);
		expect(goblinRow?.classList.contains('nimble-target--moves')).toBe(true);
		expect(archerRow?.querySelector('.nimble-movement-chip')).toBeNull();
		expect(archerRow?.classList.contains('nimble-target--moves')).toBe(false);
	});
});
