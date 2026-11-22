import { describe, expect, it } from 'vitest';
import type { MovementOffer, MovementOfferState } from '#types/movement.js';
import { afterMoveLineShown, afterMoveWarning } from '../afterMoveLine.js';

const SPEAKER = { scene: 's', token: 'hero', actor: 'hero-actor' };
const HERO_TOKEN = 'Scene.s.Token.hero';

function offer(state: MovementOfferState, overrides: Partial<MovementOffer> = {}): MovementOffer {
	return {
		id: `move-1.hero`,
		nodeId: 'move-1',
		tokenUuid: HERO_TOKEN,
		name: 'Hero',
		kind: 'free',
		spaces: 6,
		ignoreDifficultTerrain: false,
		state,
		usedBy: null,
		movedSpaces: null,
		stopped: false,
		conditional: false,
		...overrides,
	};
}

function card(offers: MovementOffer[]) {
	return {
		speaker: SPEAKER,
		system: {
			activation: {
				effects: [
					{
						id: 'move-1',
						type: 'move',
						kind: 'free',
						recipient: 'self',
						distance: '@speed',
						distanceBySize: {},
						ignoreDifficultTerrain: false,
						direction: 'any',
						parentContext: null,
						parentNode: null,
					},
				],
			},
			movementOffers: offers,
		},
	} as never;
}

describe('afterMoveLineShown', () => {
	it('hides the line while the move from the card is still waiting', () => {
		expect(afterMoveLineShown(card([offer('open')]), true)).toBe(false);
	});

	it('shows the line once the move ended, made or not', () => {
		expect(afterMoveLineShown(card([offer('taken')]), true)).toBe(true);
		expect(afterMoveLineShown(card([offer('unused')]), true)).toBe(true);
		expect(afterMoveLineShown(card([offer('untracked')]), true)).toBe(true);
	});

	it('keeps the line hidden when the turn ended before the move', () => {
		expect(afterMoveLineShown(card([offer('lapsed')]), true)).toBe(false);
	});

	it('shows the line at once when nothing tracks the move', () => {
		expect(afterMoveLineShown(card([offer('open')]), false)).toBe(true);
		expect(afterMoveLineShown(card([]), true)).toBe(true);
	});

	it('does not wait for a move of another creature or of another line on the card', () => {
		expect(
			afterMoveLineShown(card([offer('open', { tokenUuid: 'Scene.s.Token.ally' })]), true),
		).toBe(true);
		expect(afterMoveLineShown(card([offer('open', { nodeId: 'event-move' })]), true)).toBe(true);
	});
});

interface GridToken {
	id: string;
	uuid: string;
	x: number;
	y: number;
	width: number;
	height: number;
	disposition: number;
	hidden: boolean;
	actor: { uuid: string; statuses: Set<string>; getFlag?: (scope: string, key: string) => unknown };
	parent: { grid: unknown; tokens: GridToken[] };
	getOccupiedGridSpaceOffsets: (position: { x: number; y: number }) => { i: number; j: number }[];
}

const SIZE = 100;

function makeScene() {
	const grid = {
		isGridless: false,
		isSquare: true,
		size: SIZE,
		distance: 5,
		measurePath: ([a, b]: { i: number; j: number }[]) => ({
			distance: Math.max(Math.abs(a.i - b.i), Math.abs(a.j - b.j)) * 5,
		}),
	};
	const scene = { grid, tokens: [] as GridToken[] };
	const add = (
		id: string,
		col: number,
		row: number,
		options: { disposition?: number; statuses?: string[]; flags?: unknown; hidden?: boolean } = {},
	): GridToken => {
		const token: GridToken = {
			id,
			uuid: `Scene.s.Token.${id}`,
			x: col * SIZE,
			y: row * SIZE,
			width: 1,
			height: 1,
			disposition: options.disposition ?? -1,
			hidden: options.hidden ?? false,
			actor: {
				uuid: `Actor.${id}`,
				statuses: new Set(options.statuses ?? []),
				getFlag: () => options.flags,
			},
			parent: scene,
			getOccupiedGridSpaceOffsets: (position) => [
				{ i: Math.round(position.y / SIZE), j: Math.round(position.x / SIZE) },
			],
		};
		scene.tokens.push(token);
		return token;
	};
	return { add };
}

const line = (check: string, extra: Record<string, unknown> = {}) => ({
	afterMoveCheck: check,
	afterMoveFlagKey: 'quarry',
	afterMoveMinEnemies: 1,
	afterMoveStatus: '',
	...extra,
});

describe('afterMoveWarning', () => {
	it('says nothing for a line with no check', () => {
		const { add } = makeScene();
		const hero = add('hero', 0, 0, { disposition: 1 });

		expect(afterMoveWarning(line('none') as never, hero as never, 'Hero')).toBeNull();
	});

	it('warns when the user did not stop adjacent to a creature they marked', () => {
		const { add } = makeScene();
		const quarry = { quarry: [{ actorUuid: 'Actor.wolf', tokenUuid: null, name: 'Wolf' }] };
		const hero = add('hero', 0, 0, { disposition: 1, flags: quarry });
		add('wolf', 3, 0);
		add('goblin', 1, 0);

		expect(afterMoveWarning(line('adjacentToMarked') as never, hero as never, 'Hero')).toBe(
			'Hero is not next to their quarry.',
		);
	});

	it('says nothing when the user stopped adjacent to a creature they marked', () => {
		const { add } = makeScene();
		const quarry = { quarry: [{ actorUuid: 'Actor.wolf', tokenUuid: null, name: 'Wolf' }] };
		const hero = add('hero', 0, 0, { disposition: 1, flags: quarry });
		add('wolf', 1, 1);

		expect(afterMoveWarning(line('adjacentToMarked') as never, hero as never, 'Hero')).toBeNull();
	});

	it('reads the mark the line names', () => {
		const { add } = makeScene();
		const marks = {
			quarry: [{ actorUuid: 'Actor.goblin', tokenUuid: null, name: 'Goblin' }],
			hex: [{ actorUuid: 'Actor.wolf', tokenUuid: null, name: 'Wolf' }],
		};
		const hero = add('hero', 0, 0, { disposition: 1, flags: marks });
		add('goblin', 1, 0);
		const check = line('adjacentToMarked', { afterMoveFlagKey: 'hex' });

		expect(afterMoveWarning(check as never, hero as never, 'Hero')).toBe(
			'Hero is not adjacent to a creature with their hex mark.',
		);

		add('wolf', 0, 1);
		expect(afterMoveWarning(check as never, hero as never, 'Hero')).toBeNull();
	});

	it('counts the adjacent enemies against the number the line needs', () => {
		const { add } = makeScene();
		const hero = add('hero', 5, 5, { disposition: 1 });
		add('goblin', 6, 5);
		add('ally', 4, 5, { disposition: 1 });
		add('far-goblin', 8, 5);
		add('hidden-goblin', 5, 6, { hidden: true });
		const check = line('adjacentEnemies', { afterMoveMinEnemies: 2 });

		expect(afterMoveWarning(check as never, hero as never, 'Hero')).toBe(
			'Hero is not next to 2 enemies.',
		);

		add('orc', 4, 4);
		expect(afterMoveWarning(check as never, hero as never, 'Hero')).toBeNull();
	});

	it('warns when no adjacent creature has the condition', () => {
		const { add } = makeScene();
		const hero = add('hero', 5, 5, { disposition: 1 });
		add('guard', 6, 5);
		add('distracted-far', 9, 5, { statuses: ['distracted'] });
		const check = line('adjacentToCondition', { afterMoveStatus: 'distracted' });

		expect(afterMoveWarning(check as never, hero as never, 'Hero')).toBe(
			'Hero is not next to a Distracted creature.',
		);

		add('distracted-guard', 5, 4, { statuses: ['distracted'] });
		expect(afterMoveWarning(check as never, hero as never, 'Hero')).toBeNull();
	});

	it('says nothing when there is no token to check from', () => {
		expect(afterMoveWarning(line('adjacentEnemies') as never, null, 'Hero')).toBeNull();
	});
});
