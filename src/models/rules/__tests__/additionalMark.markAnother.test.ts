import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const tokenHoverIn = vi.fn();
const tokenHoverOut = vi.fn();
let AdditionalMarkRule: typeof import('../additionalMark.js').AdditionalMarkRule;

beforeAll(async () => {
	// The test setup already loaded the hover helper through init, so mock it on a fresh import.
	vi.resetModules();
	vi.doMock('#utils/tokens/tokenHoverHighlight.js', () => ({ tokenHoverIn, tokenHoverOut }));
	({ AdditionalMarkRule } = await import('../additionalMark.js'));
});

afterAll(() => {
	vi.doUnmock('#utils/tokens/tokenHoverHighlight.js');
	vi.resetModules();
});

const GRID_SIZE = 100;

interface SceneToken {
	uuid: string;
	name: string;
	hidden: boolean;
	x: number;
	y: number;
	width: number;
	height: number;
	object: { id: string };
	combatant?: { isDefeated?: boolean } | null;
	actor: {
		uuid: string;
		name: string;
		isOwner: boolean;
		statuses: Set<string>;
		effects: unknown[];
		createEmbeddedDocuments: ReturnType<typeof vi.fn>;
	};
	parent: Scene;
	getOccupiedGridSpaceOffsets(data?: Record<string, number>): { i: number; j: number }[];
}

interface Scene {
	tokens: SceneToken[];
	grid: Record<string, unknown>;
}

function makeScene(): Scene {
	return {
		tokens: [],
		grid: {
			isSquare: true,
			isGridless: false,
			size: GRID_SIZE,
			distance: 5,
			measurePath([from, to]: { i: number; j: number }[]) {
				return { distance: Math.max(Math.abs(from.i - to.i), Math.abs(from.j - to.j)) * 5 };
			},
		},
	};
}

function place(scene: Scene, id: string, name: string, spaces: number): SceneToken {
	const token: SceneToken = {
		uuid: `Token.${id}`,
		name,
		hidden: false,
		x: spaces * GRID_SIZE,
		y: 0,
		width: 1,
		height: 1,
		object: { id: `object-${id}` },
		actor: {
			uuid: `Actor.${id}`,
			name,
			isOwner: true,
			statuses: new Set(),
			effects: [],
			createEmbeddedDocuments: vi.fn(async () => []),
		},
		parent: scene,
		getOccupiedGridSpaceOffsets(data) {
			const left = Math.floor((data?.x ?? token.x) / GRID_SIZE);
			const top = Math.floor((data?.y ?? token.y) / GRID_SIZE);
			return [{ i: top, j: left }];
		},
	};
	scene.tokens.push(token);
	return token;
}

function createOwner() {
	const owner = {
		uuid: 'Actor.hunter',
		getFlag: vi.fn(() => ({})),
		setFlag: vi.fn(async (_scope: string, _key: string, _value: unknown) => undefined),
		rules: [] as unknown[],
	};
	const item = {
		isEmbedded: true,
		actor: owner,
		name: 'Extra Mark',
		uuid: 'extra-mark',
		getDomain: () => new Set<string>(),
	};
	const rule = new AdditionalMarkRule(
		{
			type: 'additionalMark',
			flagKey: 'quarry',
			within: 6,
			disabled: false,
			label: '',
			id: 'extra',
			identifier: '',
			priority: 1,
			predicate: {},
		} as never,
		{ parent: item as never, strict: false },
	);
	rule.type = 'additionalMark';
	rule.flagKey = 'quarry';
	rule.within = 6;
	Object.defineProperty(rule, 'parent', { get: () => item, configurable: true });
	Object.defineProperty(rule, 'predicate', { get: () => ({ size: 0 }), configurable: true });
	owner.rules = [rule];
	return owner;
}

interface DialogCall {
	content: string;
	buttons: { action: string; label: string }[];
	render?: (event: Event, dialog: { element: HTMLElement }) => void;
	close?: (event: Event, dialog: { element: HTMLElement }) => void;
}

function dialogWait(): ReturnType<typeof vi.fn> {
	return (foundry.applications.api.DialogV2 as unknown as { wait: ReturnType<typeof vi.fn> }).wait;
}

function lastDialog(): DialogCall {
	return dialogWait().mock.calls.at(-1)?.[0] as DialogCall;
}

async function markAnother(
	owner: ReturnType<typeof createOwner>,
	marked: SceneToken,
	cardId: string | null = null,
) {
	const applyMarker = vi.fn(async () => undefined);
	await AdditionalMarkRule.markAnotherAfter({
		actor: owner as never,
		flagKey: 'quarry',
		list: [{ actorUuid: marked.actor.uuid, tokenUuid: marked.uuid, name: marked.name }],
		markedActorUuid: marked.actor.uuid,
		markedToken: marked as never,
		cardId,
		applyMarker,
	});
	return applyMarker;
}

describe('AdditionalMarkRule.markAnotherAfter', () => {
	beforeEach(() => {
		(foundry.applications.api.DialogV2 as { wait?: unknown }).wait = vi.fn(async () => null);
		tokenHoverIn.mockClear();
		tokenHoverOut.mockClear();
	});

	afterEach(() => {
		delete (foundry.applications.api.DialogV2 as { wait?: unknown }).wait;
	});

	it('shows how far each creature is, so two with one name differ', async () => {
		const scene = makeScene();
		const wolf = place(scene, 'wolf', 'Wolf', 0);
		place(scene, 'near', 'Goblin', 1);
		place(scene, 'far', 'Goblin', 6);

		await markAnother(createOwner(), wolf);

		const { buttons, content } = lastDialog();
		expect(buttons.map((button) => button.label)).toEqual([
			'Goblin (1 space away)',
			'Goblin (6 spaces away)',
			"Don't mark another",
		]);
		expect(content).toContain('Wolf');
	});

	it('rings the token of the button under the pointer, and clears it on leave and close', async () => {
		const scene = makeScene();
		const wolf = place(scene, 'wolf', 'Wolf', 0);
		const boar = place(scene, 'boar', 'Boar', 2);

		await markAnother(createOwner(), wolf);

		const dialog = lastDialog();
		const element = document.createElement('div');
		for (const { action } of dialog.buttons) {
			const button = document.createElement('button');
			button.dataset.action = action;
			element.append(button);
		}
		dialog.render?.(new Event('render'), { element });
		const boarButton = element.querySelector<HTMLElement>(`[data-action="mark:${boar.uuid}"]`);
		boarButton?.dispatchEvent(new Event('mouseenter'));
		expect(tokenHoverIn).toHaveBeenCalledWith(boar.object);

		boarButton?.dispatchEvent(new Event('mouseleave'));
		expect(tokenHoverOut).toHaveBeenCalledTimes(1);

		dialog.close?.(new Event('close'), { element });
		expect(tokenHoverOut).toHaveBeenCalledTimes(2);
	});

	it('leaves out defeated and dead creatures', async () => {
		const scene = makeScene();
		const wolf = place(scene, 'wolf', 'Wolf', 0);
		const defeated = place(scene, 'defeated', 'Defeated', 1);
		defeated.combatant = { isDefeated: true };
		const dead = place(scene, 'dead', 'Dead', 1);
		dead.actor.statuses.add('dead');
		const boar = place(scene, 'boar', 'Boar', 2);

		await markAnother(createOwner(), wolf);

		expect(lastDialog().buttons.map((button) => button.action)).toEqual([
			`mark:${boar.uuid}`,
			'decline',
		]);
	});

	it('asks nothing when every creature in range is defeated', async () => {
		const scene = makeScene();
		const wolf = place(scene, 'wolf', 'Wolf', 0);
		place(scene, 'defeated', 'Defeated', 1).combatant = { isDefeated: true };

		await markAnother(createOwner(), wolf);

		expect(dialogWait()).not.toHaveBeenCalled();
	});

	it('records the card of the mark on the second creature, so that card can end it', async () => {
		const scene = makeScene();
		const wolf = place(scene, 'wolf', 'Wolf', 0);
		const boar = place(scene, 'boar', 'Boar', 2);
		dialogWait().mockResolvedValue(`mark:${boar.uuid}`);
		const owner = createOwner();

		const applyMarker = await markAnother(owner, wolf, 'card-1');

		const flag = owner.setFlag.mock.calls.at(-1)?.[2] as {
			quarry: { actorUuid: string; cardId?: string }[];
		};
		expect(flag.quarry).toEqual([
			{ actorUuid: wolf.actor.uuid, tokenUuid: wolf.uuid, name: 'Wolf' },
			{ actorUuid: boar.actor.uuid, tokenUuid: boar.uuid, name: 'Boar', cardId: 'card-1' },
		]);
		expect(applyMarker).toHaveBeenCalledWith(boar.actor);
	});
});
