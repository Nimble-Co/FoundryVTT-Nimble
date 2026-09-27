import { render, screen } from '@testing-library/svelte';
import MoveNodeTestHarness from './MoveNode.testHarness.svelte';

/**
 * The move node is a record, not a control: one summary line, a row with a
 * status chip for each creature the TARGETS section does not show, and the
 * damage reminder for a push that fell short. It never carries a button.
 */

type Globals = { game: { settings: unknown }; fromUuidSync: unknown };

const g = globalThis as unknown as Globals;

const SPEAKER_TOKEN = 'Scene.s1.Token.hero';
const GOBLIN_TOKEN = 'Scene.s1.Token.tok1';
const ARCHER_TOKEN = 'Scene.s1.Token.tok2';

function createNode(overrides: Record<string, unknown> = {}) {
	return {
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
		...overrides,
	};
}

function createOffer(overrides: Record<string, unknown> = {}) {
	return {
		id: 'node1.tok1',
		nodeId: 'node1',
		tokenUuid: GOBLIN_TOKEN,
		name: 'Goblin Cutthroat',
		kind: 'forced',
		spaces: 2,
		ignoreDifficultTerrain: true,
		state: 'open',
		usedBy: null,
		movedSpaces: null,
		stopped: false,
		conditional: false,
		...overrides,
	};
}

function createArcherOffer(overrides: Record<string, unknown> = {}) {
	return createOffer({
		id: 'node1.tok2',
		tokenUuid: ARCHER_TOKEN,
		name: 'Goblin Archer',
		...overrides,
	});
}

function createSelfOffer(overrides: Record<string, unknown> = {}) {
	return createOffer({
		id: 'node1.hero',
		tokenUuid: SPEAKER_TOKEN,
		name: 'Sir Brannon',
		kind: 'free',
		ignoreDifficultTerrain: false,
		...overrides,
	});
}

const selfNode = (overrides: Record<string, unknown> = {}) =>
	createNode({
		kind: 'free',
		recipient: 'self',
		direction: 'any',
		ignoreDifficultTerrain: false,
		...overrides,
	});

function createMessage(movementOffers: unknown[], targets: string[] = []) {
	return {
		id: 'msg1',
		speaker: { scene: 's1', token: 'hero', actor: 'a1' },
		system: { actorName: 'Sir Brannon', movementOffers, targets },
	};
}

interface RenderOptions {
	node?: ReturnType<typeof createNode>;
	targets?: string[];
	targetsShown?: boolean;
}

function renderNode(movementOffers: unknown[] = [createOffer()], options: RenderOptions = {}) {
	const { node = createNode(), targets = [], targetsShown = false } = options;
	return render(MoveNodeTestHarness, {
		props: { messageDocument: createMessage(movementOffers, targets), node, targetsShown },
	});
}

function summaryText(container: HTMLElement): string {
	return (container.querySelector('.nimble-move-node__line')?.textContent ?? '')
		.replace(/\s+/g, ' ')
		.trim();
}

function rowNames(container: HTMLElement): string[] {
	return [...container.querySelectorAll('.nimble-move-node__row .nimble-move-node__name')].map(
		(name) => name.textContent?.trim() ?? '',
	);
}

function chipOf(container: HTMLElement): HTMLElement {
	const chip = container.querySelector<HTMLElement>('.nimble-movement-chip');
	if (!chip) throw new Error('no chip');
	return chip;
}

function chipLabel(chip: HTMLElement): string {
	return chip.textContent?.trim() ?? '';
}

let previousSettings: unknown;
let previousFromUuidSync: unknown;

beforeEach(() => {
	previousSettings = g.game.settings;
	previousFromUuidSync = g.fromUuidSync;
	g.game.settings = { get: vi.fn(() => true) };
	g.fromUuidSync = vi.fn(() => ({}));
});

afterEach(() => {
	g.game.settings = previousSettings;
	g.fromUuidSync = previousFromUuidSync;
});

describe('MoveNode', () => {
	describe('summary line', () => {
		it('states a push', () => {
			const { container } = renderNode();
			expect(summaryText(container)).toBe('Pushed up to 2 spaces away from Sir Brannon.');
		});

		it('states a pull', () => {
			const { container } = renderNode([createOffer()], {
				node: createNode({ direction: 'toward' }),
			});
			expect(summaryText(container)).toBe('Pulled up to 2 spaces toward Sir Brannon.');
		});

		it('states a move in any direction', () => {
			const { container } = renderNode([createOffer()], {
				node: createNode({ direction: 'any' }),
			});
			expect(summaryText(container)).toBe('Moved up to 2 spaces in any direction.');
		});

		it('gives a Free Move to the user alone no direction', () => {
			const { container } = renderNode([createSelfOffer()], {
				node: selfNode({ recipient: 'targets', direction: 'away' }),
			});
			expect(summaryText(container)).toBe('Can move up to 2 spaces for free.');
		});

		it('adds the terrain to a Free Move that ignores difficult terrain', () => {
			const { container } = renderNode([createSelfOffer({ ignoreDifficultTerrain: true })], {
				node: selfNode({ ignoreDifficultTerrain: true }),
			});
			expect(summaryText(container)).toBe(
				'Can move up to 2 spaces for free, ignoring difficult terrain.',
			);
		});

		it('puts one shared distance on the line', () => {
			const { container } = renderNode([createOffer(), createArcherOffer()]);
			expect(summaryText(container)).toBe('Pushed up to 2 spaces away from Sir Brannon.');
		});

		it('sends different distances to the chips', () => {
			const { container } = renderNode([createOffer(), createArcherOffer({ spaces: 3 })]);
			expect(summaryText(container)).toBe(
				'Pushed away from Sir Brannon. Each creature shows its spaces.',
			);
		});

		it('says so when the card has no creature to move', () => {
			const { container } = renderNode([]);
			expect(summaryText(container)).toBe('Pushed away from Sir Brannon.');
			expect(screen.getByText('No creature to move.')).toBeTruthy();
		});

		it('labels the icon with the kind of movement', () => {
			const { container } = renderNode();
			const icon = container.querySelector('.nimble-move-node__line i');
			expect(icon?.getAttribute('aria-label')).toBe('Forced Movement');
			expect(icon?.getAttribute('data-tooltip')).toBe('Forced Movement');
			expect(container.querySelector('.nimble-move-node h4')).toBeNull();
		});
	});

	describe('rows', () => {
		it('lists every creature when the card shows no TARGETS section', () => {
			const { container } = renderNode([createOffer(), createArcherOffer()], {
				targets: [GOBLIN_TOKEN, ARCHER_TOKEN],
			});
			expect(rowNames(container)).toEqual(['Goblin Cutthroat', 'Goblin Archer']);
		});

		it('lists only the creatures that have no TARGETS row', () => {
			const { container } = renderNode([createOffer(), createArcherOffer()], {
				targets: [GOBLIN_TOKEN],
				targetsShown: true,
			});
			expect(rowNames(container)).toEqual(['Goblin Archer']);
		});

		it('keeps the row of a target whose token is gone, as TARGETS drops it', () => {
			g.fromUuidSync = vi.fn((uuid: string) => (uuid === GOBLIN_TOKEN ? null : {}));
			const { container } = renderNode([createOffer(), createArcherOffer()], {
				targets: [GOBLIN_TOKEN, ARCHER_TOKEN],
				targetsShown: true,
			});
			expect(rowNames(container)).toEqual(['Goblin Cutthroat']);
		});

		it('shows no row when every creature has a TARGETS row', () => {
			const { container } = renderNode([createOffer()], {
				targets: [GOBLIN_TOKEN],
				targetsShown: true,
			});
			expect(container.querySelector('.nimble-move-node__rows')).toBeNull();
			expect(summaryText(container)).toBe('Pushed up to 2 spaces away from Sir Brannon.');
		});

		it('gives the name its own tooltip', () => {
			const { container } = renderNode();
			const name = container.querySelector('.nimble-move-node__name');
			expect(name?.getAttribute('data-tooltip')).toBe('Goblin Cutthroat');
		});

		it('shows the token image, then the actor image, then the default image', () => {
			g.fromUuidSync = vi.fn((uuid: string) => {
				if (uuid === GOBLIN_TOKEN) return { texture: { src: 'goblin.webp' } };
				if (uuid === ARCHER_TOKEN) return { texture: { src: '' }, actor: { img: 'archer.webp' } };
				return null;
			});
			const { container } = renderNode([
				createOffer(),
				createArcherOffer(),
				createSelfOffer({ kind: 'forced' }),
			]);
			const images = [...container.querySelectorAll('.nimble-move-node__img')].map((img) =>
				img.getAttribute('src'),
			);
			expect(images).toEqual(['goblin.webp', 'archer.webp', 'icons/svg/mystery-man.svg']);
			expect(g.fromUuidSync).toHaveBeenCalledWith(GOBLIN_TOKEN, { strict: false });
		});
	});

	describe('chip', () => {
		it.each([
			['open', {}, '2', 'Waiting to be pushed up to 2 spaces away from Sir Brannon.'],
			['taken', { state: 'taken', movedSpaces: 2 }, '2/2', 'Pushed the full 2 spaces.'],
			[
				'short',
				{ state: 'taken', movedSpaces: 1, stopped: true },
				'1/2',
				'Pushed 1 of 2 spaces. If an obstacle stopped Goblin Cutthroat, it takes 1d6 bludgeoning damage. If it hit another creature, both creatures split the damage.',
			],
			[
				'unused',
				{ state: 'unused', usedBy: 'player' },
				'Not pushed',
				'Not pushed. It moved another way instead.',
			],
			['lapsed', { state: 'lapsed' }, 'Not pushed', 'Not pushed. The turn ended first.'],
			['untracked', { state: 'untracked' }, '2', 'Pushed up to 2 spaces away from Sir Brannon.'],
		])('shows a push that is %s', (status, overrides, label, tooltip) => {
			const { container } = renderNode([createOffer(overrides)]);
			const chip = chipOf(container);
			expect(chip.dataset.status).toBe(status);
			expect(chipLabel(chip)).toBe(label);
			expect(chip.getAttribute('data-tooltip')).toBe(tooltip);
			expect(chip.getAttribute('aria-label')).toBe(tooltip);
		});

		it.each([
			['open', {}, '2', 'Can move up to 2 spaces for free.'],
			['taken', { state: 'taken', movedSpaces: 2 }, '2/2', 'Moved the full 2 spaces for free.'],
			['partial', { state: 'taken', movedSpaces: 1 }, '1/2', 'Moved 1 of 2 spaces for free.'],
			[
				'short',
				{ state: 'taken', movedSpaces: 1, stopped: true },
				'1/2',
				'Moved 1 of 2 spaces for free before something blocked the path.',
			],
			[
				'unused',
				{ state: 'unused', usedBy: 'player' },
				'Not used',
				'Did not use the Free Move. It moved another way instead.',
			],
			[
				'lapsed',
				{ state: 'lapsed' },
				'Not used',
				'Did not use the Free Move. The turn ended first.',
			],
			['untracked', { state: 'untracked' }, '2', 'Can move up to 2 spaces for free.'],
		])('shows a Free Move that is %s', (status, overrides, label, tooltip) => {
			const { container } = renderNode([createSelfOffer(overrides)], { node: selfNode() });
			const chip = chipOf(container);
			expect(chip.dataset.status).toBe(status);
			expect(chipLabel(chip)).toBe(label);
			expect(chip.getAttribute('data-tooltip')).toBe(tooltip);
		});

		it.each([
			['failedSave', 'Pushed up to 2 spaces away from Sir Brannon if it fails the save.'],
			['passedSave', 'Pushed up to 2 spaces away from Sir Brannon if it passes the save.'],
		])('lets the save decide a push under %s', (outcome, tooltip) => {
			const { container } = renderNode([createOffer({ conditional: true })], {
				node: createNode({ parentNode: 'save1', parentContext: outcome }),
			});
			const chip = chipOf(container);
			expect(chip.dataset.status).toBe('conditional');
			expect(chipLabel(chip)).toBe('2');
			expect(chip.getAttribute('data-tooltip')).toBe(tooltip);
		});

		it('states an open push when tracking is off', () => {
			g.game.settings = { get: vi.fn(() => false) };
			const { container } = renderNode();
			const chip = chipOf(container);
			expect(chip.dataset.status).toBe('untracked');
			expect(chip.getAttribute('data-tooltip')).toBe(
				'Pushed up to 2 spaces away from Sir Brannon.',
			);
		});

		it('uses the singular for one space', () => {
			const { container } = renderNode([createOffer({ spaces: 1 })]);
			expect(summaryText(container)).toBe('Pushed up to 1 space away from Sir Brannon.');
			expect(chipOf(container).getAttribute('data-tooltip')).toBe(
				'Waiting to be pushed up to 1 space away from Sir Brannon.',
			);
		});
	});

	describe('damage line', () => {
		it('reminds the table about damage when a push fell short', () => {
			renderNode([createOffer({ state: 'taken', movedSpaces: 1, stopped: true })]);
			expect(
				screen.getByText(
					'If an obstacle stopped Goblin Cutthroat, it takes 1d6 bludgeoning damage. If it hit another creature, both creatures split the damage.',
				),
			).toBeTruthy();
		});

		it('shows the damage line for a creature with a TARGETS row too', () => {
			const { container } = renderNode(
				[createOffer({ state: 'taken', movedSpaces: 0, stopped: true })],
				{ targets: [GOBLIN_TOKEN], targetsShown: true },
			);
			expect(container.querySelector('.nimble-move-node__rows')).toBeNull();
			expect(container.querySelector('.nimble-move-node__damage')?.textContent).toMatch(
				/takes 2d6 bludgeoning damage/,
			);
		});

		it('gives no damage line when a Free Move fell short', () => {
			const { container } = renderNode(
				[createSelfOffer({ state: 'taken', spaces: 6, movedSpaces: 4, stopped: true })],
				{ node: selfNode() },
			);
			expect(chipOf(container).dataset.status).toBe('short');
			expect(container.querySelector('.nimble-move-node__damage')).toBeNull();
			expect(screen.queryByText(/bludgeoning/)).toBeNull();
		});

		it('gives no damage line for a full push', () => {
			const { container } = renderNode([createOffer({ state: 'taken', movedSpaces: 2 })]);
			expect(container.querySelector('.nimble-move-node__damage')).toBeNull();
		});
	});

	it('does not list an offer of zero spaces', () => {
		const { container } = renderNode([
			createOffer(),
			createArcherOffer({ name: 'Ogre', spaces: 0 }),
		]);
		expect(rowNames(container)).toEqual(['Goblin Cutthroat']);
		expect(screen.queryByText('Ogre')).toBeNull();
	});

	it('says so when every offer for this node is zero spaces', () => {
		renderNode([createOffer({ spaces: 0 })]);
		expect(screen.getByText('No creature to move.')).toBeTruthy();
	});

	it('shows only the offers of its own node', () => {
		const { container } = renderNode([
			createOffer(),
			createArcherOffer({ id: 'node2.tok2', nodeId: 'node2' }),
		]);
		expect(rowNames(container)).toEqual(['Goblin Cutthroat']);
		expect(screen.queryByText(/Goblin Archer/)).toBeNull();
	});

	it('carries no button in any state', () => {
		for (const offer of [
			createOffer(),
			createOffer({ state: 'taken', movedSpaces: 1, stopped: true }),
			createOffer({ state: 'unused' }),
			createOffer({ state: 'lapsed' }),
			createOffer({ conditional: true }),
		]) {
			const { unmount } = renderNode([offer]);
			expect(screen.queryByRole('button')).toBeNull();
			unmount();
		}
		renderNode([]);
		expect(screen.queryByRole('button')).toBeNull();
	});
});
