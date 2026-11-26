import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SYSTEM_ID } from '#system';
import { NIMBLE_EFFECT_TYPE } from '../../activeEffect/nimbleEffectChoices.js';
import { AdditionalMarkRule } from '../additionalMark.js';
import { MarkTargetRule } from '../markTarget.js';

interface MockMarkEffect {
	id: string;
	getFlag: (scope: string, key: string) => unknown;
}

interface MockTargetActor {
	uuid: string;
	name: string;
	// The relay writes directly when this client owns the target; owning it keeps these
	// tests on the direct path (the GM-relay path is covered in markTargetEffects.test.ts).
	isOwner: boolean;
	effects: MockMarkEffect[];
	createEmbeddedDocuments: ReturnType<typeof vi.fn>;
	deleteEmbeddedDocuments: ReturnType<typeof vi.fn>;
	updateEmbeddedDocuments: ReturnType<typeof vi.fn>;
}

function createTargetToken(uuid: string, name: string) {
	const effects: MockMarkEffect[] = [];
	const actor: MockTargetActor = {
		uuid: `Actor.${uuid}`,
		name,
		isOwner: true,
		effects,
		// Mirror Foundry: creating a marker effect adds it to the actor's effects,
		// stamped with the marking item's uuid so eviction/dedup can find it.
		createEmbeddedDocuments: vi.fn(async (_type: string, data: Array<Record<string, unknown>>) => {
			for (const entry of data) {
				const itemUuid = (entry.flags as Record<string, Record<string, unknown>>)?.[SYSTEM_ID]
					?.markTargetItemUuid;
				effects.push({
					id: `Effect.${effects.length}`,
					getFlag: (_scope: string, key: string) =>
						key === 'markTargetItemUuid' ? itemUuid : undefined,
				});
			}
			return data;
		}),
		deleteEmbeddedDocuments: vi.fn(async (_type: string, ids: string[]) => {
			for (const id of ids) {
				const index = effects.findIndex((e) => e.id === id);
				if (index >= 0) effects.splice(index, 1);
			}
			return ids;
		}),
		updateEmbeddedDocuments: vi.fn(async () => []),
	};
	return { uuid: `Token.${uuid}`, actor };
}

interface MarkOwner {
	name?: string;
	type?: string;
	uuid?: string;
	getFlag: ReturnType<typeof vi.fn>;
	setFlag: ReturnType<typeof vi.fn>;
	activateItem: ReturnType<typeof vi.fn>;
	rules: Array<MarkTargetRule | AdditionalMarkRule>;
	getRollData: ReturnType<typeof vi.fn>;
}

function createOwner(): MarkOwner {
	return {
		uuid: 'Actor.hunter',
		getFlag: vi.fn(() => ({})),
		setFlag: vi.fn(async () => undefined),
		activateItem: vi.fn(async () => undefined),
		rules: [],
		getRollData: vi.fn(() => ({})),
	};
}

interface MockItemEffect {
	transfer: boolean;
	toObject(): Record<string, unknown>;
}

function createRule(
	config: {
		flagKey?: string;
		statusCondition?: string;
		maxTargets?: number;
		endEarlier?: boolean;
		effectId?: string;
		effects?: Record<string, MockItemEffect>;
	},
	owner: MarkOwner,
	itemUuid = 'item-uuid',
): { rule: MarkTargetRule; item: { uuid: string } } {
	const effects = config.effects ?? {};
	const item = {
		isEmbedded: true,
		actor: owner,
		name: "Hunter's Mark",
		uuid: itemUuid,
		effects: { get: (id: string) => effects[id] },
	};
	const sourceData = {
		type: 'markTarget',
		flagKey: config.flagKey ?? 'quarry',
		statusCondition: config.statusCondition ?? 'marked',
		maxTargets: config.maxTargets ?? 1,
		endEarlier: config.endEarlier ?? false,
		disabled: false,
		label: 'Mark Quarry',
		id: 'rule-id',
		identifier: '',
		priority: 1,
		predicate: {},
	};

	const rule = new MarkTargetRule(sourceData as never, {
		parent: item as never,
		strict: false,
	});

	rule.type = 'markTarget';
	rule.flagKey = config.flagKey ?? 'quarry';
	(rule as unknown as { statusCondition: string }).statusCondition =
		config.statusCondition ?? 'marked';
	rule.maxTargets = config.maxTargets ?? 1;
	rule.endEarlier = config.endEarlier ?? false;
	rule.effectId = config.effectId ?? '';

	Object.defineProperty(rule, 'parent', { get: () => item, configurable: true });
	Object.defineProperty(rule, 'predicate', { get: () => ({ size: 0 }), configurable: true });

	return { rule, item };
}

function activation(sourceItem: { uuid: string }, tokens: ReturnType<typeof createTargetToken>[]) {
	return {
		sourceItem,
		sourceActor: {},
		targetActors: tokens.map((t) => t.actor),
		targetTokens: tokens,
		card: null,
	} as never;
}

function createAdditionalMark(owner: MarkOwner, within = 6): AdditionalMarkRule {
	const item = {
		isEmbedded: true,
		actor: owner,
		name: 'Pack Hunter',
		uuid: 'pack-hunter',
		getDomain: () => new Set<string>(),
	};
	const rule = new AdditionalMarkRule(
		{
			type: 'additionalMark',
			flagKey: 'quarry',
			within,
			disabled: false,
			label: 'Pack Hunter',
			id: 'pack-hunter-mark',
			identifier: '',
			priority: 1,
			predicate: {},
		} as never,
		{ parent: item as never, strict: false },
	);
	rule.type = 'additionalMark';
	rule.flagKey = 'quarry';
	rule.within = within;
	Object.defineProperty(rule, 'parent', { get: () => item, configurable: true });
	Object.defineProperty(rule, 'predicate', { get: () => ({ size: 0 }), configurable: true });
	return rule;
}

const GRID_SIZE = 100;

interface MarkScene {
	tokens: Array<ReturnType<typeof createTargetToken> & { hidden: boolean; uuid: string }>;
	grid: {
		isSquare: boolean;
		isGridless: boolean;
		size: number;
		distance: number;
		measurePath(points: { i: number; j: number }[]): { distance: number };
	};
}

function makeScene(): MarkScene {
	return {
		tokens: [],
		grid: {
			isSquare: true,
			isGridless: false,
			size: GRID_SIZE,
			distance: 5,
			measurePath([from, to]: { i: number; j: number }[]) {
				const spaces = Math.max(Math.abs(from.i - to.i), Math.abs(from.j - to.j));
				return { distance: spaces * 5 };
			},
		},
	};
}

function placeToken<T extends ReturnType<typeof createTargetToken>>(
	token: T,
	scene: MarkScene,
	spaces: number,
) {
	const placed = Object.assign(token, {
		x: spaces * GRID_SIZE,
		y: 0,
		width: 1,
		height: 1,
		hidden: false,
		parent: scene,
		getOccupiedGridSpaceOffsets(data?: {
			x?: number;
			y?: number;
			width?: number;
			height?: number;
		}) {
			const x = data?.x ?? placed.x;
			const y = data?.y ?? placed.y;
			const width = data?.width ?? placed.width;
			const height = data?.height ?? placed.height;
			const left = Math.floor(x / GRID_SIZE);
			const top = Math.floor(y / GRID_SIZE);
			const offsets: { i: number; j: number }[] = [];
			for (let row = 0; row < height; row++) {
				for (let column = 0; column < width; column++) {
					offsets.push({ i: top + row, j: left + column });
				}
			}
			return offsets;
		},
	});
	scene.tokens.push(placed);
	return placed;
}

function dialogWait(): ReturnType<typeof vi.fn> {
	return (foundry.applications.api.DialogV2 as unknown as { wait: ReturnType<typeof vi.fn> }).wait;
}

function quarryActors(owner: MarkOwner): string[] {
	const value = owner.setFlag.mock.calls.at(-1)?.[2] as { quarry: { actorUuid: string }[] };
	return value.quarry.map((entry) => entry.actorUuid);
}

function effectStartStub() {
	return CONFIG.ActiveEffect.documentClass as unknown as Record<string, unknown>;
}

describe('MarkTargetRule', () => {
	afterEach(() => {
		delete effectStartStub().getEffectStart;
	});

	beforeEach(() => {
		vi.clearAllMocks();
		// Eviction resolves token actors via the global fromUuid; reset per test so a
		// test that reassigns it can't leak into the next.
		(globalThis as { fromUuid?: unknown }).fromUuid = vi.fn(async () => null);
	});

	it('marks a target: stores the flag entry and creates a per-marker Nimble status effect', async () => {
		const owner = createOwner();
		const { rule, item } = createRule({}, owner);
		owner.rules = [rule];
		const token = createTargetToken('goblin', 'Goblin');

		await rule.onItemActivated(activation(item, [token]));

		expect(owner.setFlag).toHaveBeenCalledTimes(1);
		const [scope, key, value] = owner.setFlag.mock.calls[0];
		expect(scope).toBe(SYSTEM_ID);
		expect(key).toBe('toggledEffects');
		expect((value as { quarry: { actorUuid: string }[] }).quarry.map((e) => e.actorUuid)).toEqual([
			'Actor.goblin',
		]);
		expect(token.actor.createEmbeddedDocuments).toHaveBeenCalledTimes(1);
		const [aeType, aeData] = token.actor.createEmbeddedDocuments.mock.calls[0];
		expect(aeType).toBe('ActiveEffect');
		expect(aeData[0]).toMatchObject({
			type: NIMBLE_EFFECT_TYPE,
			statuses: ['marked'],
			origin: 'item-uuid',
			flags: { [SYSTEM_ID]: { markTargetItemUuid: 'item-uuid' } },
		});
	});

	it('ignores activation of a different item', async () => {
		const owner = createOwner();
		const { rule } = createRule({}, owner);
		owner.rules = [rule];
		const token = createTargetToken('goblin', 'Goblin');

		await rule.onItemActivated(activation({ uuid: 'some-other-item' }, [token]));

		expect(owner.setFlag).not.toHaveBeenCalled();
		expect(token.actor.createEmbeddedDocuments).not.toHaveBeenCalled();
	});

	it('replaces the prior quarry at capacity 1 (until you mark another creature)', async () => {
		const owner = createOwner();
		owner.getFlag = vi.fn(() => ({
			quarry: [{ actorUuid: 'Actor.old', tokenUuid: null, name: 'Old' }],
		}));
		const { rule, item } = createRule({ maxTargets: 1 }, owner);
		owner.rules = [rule];
		const token = createTargetToken('new', 'New');

		await rule.onItemActivated(activation(item, [token]));

		const value = owner.setFlag.mock.calls[0][2] as { quarry: { actorUuid: string }[] };
		expect(value.quarry.map((e) => e.actorUuid)).toEqual(['Actor.new']);
	});

	it('deletes only this item’s marker effect off an evicted quarry that has a token', async () => {
		const owner = createOwner();
		owner.getFlag = vi.fn(() => ({
			quarry: [{ actorUuid: 'Actor.old', tokenUuid: 'Token.old', name: 'Old' }],
		}));
		// The evicted target already carries this item's marker plus another hunter's.
		const evicted = createTargetToken('old', 'Old');
		evicted.actor.effects.push(
			{
				id: 'Effect.mine',
				getFlag: (_s, k) => (k === 'markTargetItemUuid' ? 'item-uuid' : undefined),
			},
			{
				id: 'Effect.other',
				getFlag: (_s, k) => (k === 'markTargetItemUuid' ? 'other-item' : undefined),
			},
		);
		(globalThis as { fromUuid?: unknown }).fromUuid = vi.fn(async () => ({ actor: evicted.actor }));

		const { rule, item } = createRule({ maxTargets: 1 }, owner);
		owner.rules = [rule];
		const token = createTargetToken('new', 'New');

		await rule.onItemActivated(activation(item, [token]));

		expect(token.actor.createEmbeddedDocuments).toHaveBeenCalledTimes(1);
		// Only this item's marker is removed; the other hunter's stays.
		expect(evicted.actor.deleteEmbeddedDocuments).toHaveBeenCalledWith('ActiveEffect', [
			'Effect.mine',
		]);
	});

	it('does not stack a second marker when this item already marks the target', async () => {
		const owner = createOwner();
		const { rule, item } = createRule({}, owner);
		owner.rules = [rule];
		const token = createTargetToken('goblin', 'Goblin');
		token.actor.effects.push({
			id: 'Effect.existing',
			getFlag: (_s, k) => (k === 'markTargetItemUuid' ? 'item-uuid' : undefined),
		});

		effectStartStub().getEffectStart = () => ({ time: 60 });

		await rule.onItemActivated(activation(item, [token]));

		expect(token.actor.createEmbeddedDocuments).not.toHaveBeenCalled();
		expect(token.actor.updateEmbeddedDocuments).toHaveBeenCalledWith('ActiveEffect', [
			{ _id: 'Effect.existing', start: { time: 60 } },
		]);
	});

	it('raises capacity to the largest sibling maxTargets (finite Nemesis upgrade)', async () => {
		const owner = createOwner();
		const base = createRule({ maxTargets: 1 }, owner, 'hunters-mark');
		const upgrade = createRule({ maxTargets: 3 }, owner, 'nemesis');
		owner.rules = [base.rule, upgrade.rule];

		const tokens = [
			createTargetToken('a', 'A'),
			createTargetToken('b', 'B'),
			createTargetToken('c', 'C'),
			createTargetToken('d', 'D'),
		];

		await base.rule.onItemActivated(activation(base.item, tokens));

		const value = owner.setFlag.mock.calls[0][2] as { quarry: { actorUuid: string }[] };
		expect(value.quarry.map((e) => e.actorUuid)).toEqual(['Actor.b', 'Actor.c', 'Actor.d']);
	});

	it('allows unlimited marks when a sibling rule sets maxTargets to 0 (Nemesis)', async () => {
		const owner = createOwner();
		const huntersMark = createRule({ maxTargets: 1 }, owner, 'hunters-mark');
		const nemesis = createRule({ maxTargets: 0 }, owner, 'nemesis');
		owner.rules = [huntersMark.rule, nemesis.rule];

		const tokenA = createTargetToken('a', 'A');
		const tokenB = createTargetToken('b', 'B');

		await huntersMark.rule.onItemActivated(activation(huntersMark.item, [tokenA, tokenB]));

		const value = owner.setFlag.mock.calls[0][2] as { quarry: { actorUuid: string }[] };
		expect(value.quarry.map((e) => e.actorUuid).sort()).toEqual(['Actor.a', 'Actor.b']);
	});

	it('does nothing when the item is not embedded', async () => {
		const owner = createOwner();
		const { rule } = createRule({}, owner);
		owner.rules = [rule];
		Object.defineProperty(rule, 'parent', {
			get: () => ({ isEmbedded: false, uuid: 'item-uuid', actor: owner }),
			configurable: true,
		});
		const token = createTargetToken('goblin', 'Goblin');

		await rule.onItemActivated(activation({ uuid: 'item-uuid' }, [token]));

		expect(owner.setFlag).not.toHaveBeenCalled();
	});

	it('writes the flag but applies no status when statusCondition is empty', async () => {
		const owner = createOwner();
		const { rule, item } = createRule({ statusCondition: '' }, owner);
		owner.rules = [rule];
		const token = createTargetToken('goblin', 'Goblin');

		await rule.onItemActivated(activation(item, [token]));

		expect(owner.setFlag).toHaveBeenCalledTimes(1);
		expect(token.actor.createEmbeddedDocuments).not.toHaveBeenCalled();
	});

	describe('with an item effect', () => {
		const oneMinute = {
			kind: 'time',
			boundary: null,
			clock: null,
			span: null,
			value: 1,
			units: 'minutes',
			who: null,
			event: null,
			effectName: '',
		};

		function itemEffect(transfer = false): MockItemEffect {
			const source = {
				_id: 'exploit',
				name: 'Exploit Weakness',
				img: 'exploit.webp',
				transfer,
				disabled: false,
				origin: 'Compendium.x',
				start: { round: 4 },
				statuses: ['dazed'],
				flags: { other: { keep: 1 } },
				system: {
					changes: [{ key: 'system.x', type: 'add', value: '1' }],
					lastsUntil: [oneMinute],
					escape: { dc: '', saves: ['strength'] },
					rules: [{ type: 'heldRoll', heldKind: 'advantage' }],
					tempHp: null,
				},
			};
			return { transfer, toObject: () => structuredClone(source) };
		}

		function markedWith(effect: MockItemEffect | null, effectId = 'exploit') {
			const owner = createOwner();
			owner.name = 'Cheat';
			owner.type = 'character';
			owner.uuid = 'Actor.cheat';
			const { rule, item } = createRule(
				{ effectId, effects: effect ? { exploit: effect } : {} },
				owner,
			);
			owner.rules = [rule];
			return { owner, rule, item };
		}

		it("copies the effect's img, Lasts Until, Escape, changes and rules onto the marker", async () => {
			const { rule, item } = markedWith(itemEffect());
			const token = createTargetToken('goblin', 'Goblin');

			await rule.onItemActivated(activation(item, [token]));

			const data = token.actor.createEmbeddedDocuments.mock.calls[0][1][0];
			expect(data).toMatchObject({
				img: 'exploit.webp',
				system: {
					changes: [{ key: 'system.x', type: 'add', value: '1' }],
					lastsUntil: [oneMinute],
					escape: { dc: '', saves: ['strength'] },
					rules: [{ type: 'heldRoll', heldKind: 'advantage' }],
				},
			});
		});

		it('keeps its own name, statuses, origin and flag, and no start of the item effect', async () => {
			const { rule, item } = markedWith(itemEffect());
			const token = createTargetToken('goblin', 'Goblin');

			await rule.onItemActivated(activation(item, [token]));

			const data = token.actor.createEmbeddedDocuments.mock.calls[0][1][0];
			expect(data.type).toBe(NIMBLE_EFFECT_TYPE);
			expect(data.name).toMatch(/\(Cheat\)$/);
			expect(data.name).not.toContain('Exploit Weakness');
			expect(data.statuses).toEqual(['marked']);
			expect(data.origin).toBe('item-uuid');
			expect(data.flags).toEqual({ [SYSTEM_ID]: { markTargetItemUuid: 'item-uuid' } });
			expect(data).not.toHaveProperty('start');
			expect(data).not.toHaveProperty('changes');
		});

		it("still puts its marker on a creature that has a second hunter's marker", async () => {
			const { rule, item } = markedWith(itemEffect());
			const token = createTargetToken('goblin', 'Goblin');
			token.actor.effects.push({
				id: 'Effect.other',
				getFlag: (_s, k) => (k === 'markTargetItemUuid' ? 'other-item' : undefined),
			});

			await rule.onItemActivated(activation(item, [token]));

			expect(token.actor.createEmbeddedDocuments).toHaveBeenCalledTimes(1);
			expect(token.actor.effects.map((effect) => effect.id)).toEqual(['Effect.other', 'Effect.1']);
		});

		it("gives today's marker with no pick, or a pick that is not the item's own effect", async () => {
			for (const [effect, effectId] of [
				[itemEffect(), ''],
				[null, 'exploit'],
				[itemEffect(true), 'exploit'],
			] as const) {
				const { rule, item } = markedWith(effect, effectId);
				const token = createTargetToken('goblin', 'Goblin');

				await rule.onItemActivated(activation(item, [token]));

				const data = token.actor.createEmbeddedDocuments.mock.calls[0][1][0];
				expect(data.statuses).toEqual(['marked']);
				expect(data).not.toHaveProperty('system');
				expect(data).not.toHaveProperty('changes');
				expect(data.img).not.toBe('exploit.webp');
			}
		});
	});

	it('picks its effect with the item effect picker, none by default', () => {
		const fields = MarkTargetRule.defineSchema() as Record<
			string,
			{ initial?: unknown; options?: { widget?: string } }
		>;
		expect(fields.effectId?.initial).toBe('');
		expect(fields.endEarlier?.initial).toBe(false);
		expect(fields).not.toHaveProperty('endsAtEncounterEnd');
	});

	describe('ending every earlier mark', () => {
		beforeEach(() => {
			(foundry.applications.api.DialogV2 as { wait?: unknown }).wait = vi.fn();
		});

		afterEach(() => {
			delete (foundry.applications.api.DialogV2 as { wait?: unknown }).wait;
		});

		it('ends every earlier mark, not only the oldest', async () => {
			const owner = createOwner();
			const oldA = createTargetToken('old-a', 'Old A');
			const oldB = createTargetToken('old-b', 'Old B');
			for (const quarry of [oldA, oldB]) {
				quarry.actor.effects.push({
					id: `Effect.${quarry.actor.uuid}`,
					getFlag: (_scope, key) => (key === 'markTargetItemUuid' ? 'item-uuid' : undefined),
				});
			}
			owner.getFlag = vi.fn(() => ({
				quarry: [
					{ actorUuid: oldA.actor.uuid, tokenUuid: oldA.uuid, name: 'Old A' },
					{ actorUuid: oldB.actor.uuid, tokenUuid: oldB.uuid, name: 'Old B' },
				],
			}));
			(globalThis as { fromUuid?: unknown }).fromUuid = vi.fn(async (uuid: string) => {
				if (uuid === oldA.uuid) return oldA;
				if (uuid === oldB.uuid) return oldB;
				return null;
			});
			const { rule, item } = createRule({ maxTargets: 2, endEarlier: true }, owner);
			owner.rules = [rule];
			const token = createTargetToken('new', 'New');

			await rule.onItemActivated(activation(item, [token]));

			expect(quarryActors(owner)).toEqual(['Actor.new']);
			expect(oldA.actor.deleteEmbeddedDocuments).toHaveBeenCalled();
			expect(oldB.actor.deleteEmbeddedDocuments).toHaveBeenCalled();
			expect(dialogWait()).not.toHaveBeenCalled();
		});

		it('keeps earlier marks when a sibling rule makes the cap unlimited', async () => {
			const owner = createOwner();
			owner.getFlag = vi.fn(() => ({
				quarry: [{ actorUuid: 'Actor.old', tokenUuid: null, name: 'Old' }],
			}));
			const huntersMark = createRule({ maxTargets: 1, endEarlier: true }, owner, 'hunters-mark');
			const nemesis = createRule({ maxTargets: 0 }, owner, 'nemesis');
			owner.rules = [huntersMark.rule, nemesis.rule];

			await huntersMark.rule.onItemActivated(
				activation(huntersMark.item, [createTargetToken('new', 'New')]),
			);

			expect(quarryActors(owner).sort()).toEqual(['Actor.new', 'Actor.old']);
			expect(dialogWait()).not.toHaveBeenCalled();
		});

		it('marks a creature exactly 6 spaces away and then ends both quarries', async () => {
			const owner = createOwner();
			const charges = { 'thrill-of-the-hunt': { value: 2 } };
			const bags: Record<string, unknown> = {
				toggledEffects: { chargePools: charges },
				chargePools: charges,
			};
			owner.getFlag = vi.fn((_scope: string, key: string) => bags[key]);
			owner.setFlag = vi.fn(async (_scope: string, key: string, value: unknown) => {
				bags[key] = value;
			});
			const scene = makeScene();
			const marked = placeToken(createTargetToken('wolf', 'Wolf'), scene, 0);
			const second = placeToken(createTargetToken('boar', 'Boar'), scene, 6);
			const far = placeToken(createTargetToken('stag', 'Stag'), scene, 7);
			const hunter = placeToken(createTargetToken('hunter', 'Hunter'), scene, 1);
			hunter.actor.uuid = owner.uuid ?? 'Actor.hunter';
			const { rule, item } = createRule({ maxTargets: 2, endEarlier: true }, owner);
			owner.rules = [rule, createAdditionalMark(owner)];
			dialogWait().mockResolvedValue(`mark:${second.uuid}`);

			await rule.onItemActivated(activation(item, [marked]));

			const written = bags.toggledEffects as {
				quarry: { actorUuid: string }[];
				chargePools: unknown;
			};
			expect(written.quarry.map((entry) => entry.actorUuid)).toEqual(['Actor.wolf', 'Actor.boar']);
			expect(written.chargePools).toBe(charges);
			expect(bags.chargePools).toBe(charges);
			expect(owner.setFlag.mock.calls.every((call) => call[1] === 'toggledEffects')).toBe(true);
			expect(owner.activateItem).not.toHaveBeenCalled();
			expect(second.actor.createEmbeddedDocuments).toHaveBeenCalledTimes(1);
			const actions = (
				dialogWait().mock.calls[0]?.[0] as { buttons: { action: string }[] }
			).buttons.map((button) => button.action);
			expect(actions).toContain(`mark:${second.uuid}`);
			expect(actions).not.toContain(`mark:${far.uuid}`);
			expect(actions).not.toContain(`mark:${hunter.uuid}`);

			const later = makeScene();
			const next = placeToken(createTargetToken('next', 'Next'), later, 0);
			dialogWait().mockClear();

			await rule.onItemActivated(activation(item, [next]));

			const after = bags.toggledEffects as { quarry: { actorUuid: string }[] };
			expect(after.quarry.map((entry) => entry.actorUuid)).toEqual(['Actor.next']);
			expect(dialogWait()).not.toHaveBeenCalled();
		});

		it('does not restore evicted marks from a stale flag when the second creature is accepted', async () => {
			const owner = createOwner();
			const charges = { 'thrill-of-the-hunt': { value: 1 } };
			owner.getFlag = vi.fn(() => ({
				quarry: [
					{ actorUuid: 'Actor.old-a', tokenUuid: null, name: 'Old A' },
					{ actorUuid: 'Actor.old-b', tokenUuid: null, name: 'Old B' },
				],
				chargePools: charges,
			}));
			const scene = makeScene();
			const marked = placeToken(createTargetToken('wolf', 'Wolf'), scene, 0);
			const second = placeToken(createTargetToken('boar', 'Boar'), scene, 6);
			const { rule, item } = createRule({ maxTargets: 2, endEarlier: true }, owner);
			owner.rules = [rule, createAdditionalMark(owner)];
			dialogWait().mockResolvedValue(`mark:${second.uuid}`);

			await rule.onItemActivated(activation(item, [marked]));

			const last = owner.setFlag.mock.calls.at(-1)?.[2] as {
				quarry: { actorUuid: string }[];
				chargePools: unknown;
			};
			expect(last.quarry.map((entry) => entry.actorUuid)).toEqual(['Actor.wolf', 'Actor.boar']);
			expect(last.chargePools).toBe(charges);
			expect(owner.setFlag.mock.calls.every((call) => call[1] === 'toggledEffects')).toBe(true);
			expect(owner.activateItem).not.toHaveBeenCalled();
			expect(second.actor.createEmbeddedDocuments).toHaveBeenCalledTimes(1);
		});

		it.each([null, 'decline'] as const)(
			'declining (%s) leaves only the new mark',
			async (choice) => {
				const owner = createOwner();
				const scene = makeScene();
				const marked = placeToken(createTargetToken('wolf', 'Wolf'), scene, 0);
				const second = placeToken(createTargetToken('boar', 'Boar'), scene, 1);
				const { rule, item } = createRule({ maxTargets: 1, endEarlier: true }, owner);
				owner.rules = [rule, createAdditionalMark(owner)];
				dialogWait().mockResolvedValue(choice);

				await rule.onItemActivated(activation(item, [marked]));

				expect(owner.setFlag).toHaveBeenCalledTimes(1);
				expect(quarryActors(owner)).toEqual(['Actor.wolf']);
				expect(second.actor.createEmbeddedDocuments).not.toHaveBeenCalled();
				expect(owner.activateItem).not.toHaveBeenCalled();
			},
		);

		it('does not offer a creature farther than 6 spaces', async () => {
			const owner = createOwner();
			const scene = makeScene();
			const marked = placeToken(createTargetToken('wolf', 'Wolf'), scene, 0);
			const far = placeToken(createTargetToken('stag', 'Stag'), scene, 7);
			const hidden = placeToken(createTargetToken('shade', 'Shade'), scene, 1);
			hidden.hidden = true;
			placeToken(createTargetToken('hunter', 'Hunter'), scene, 1);
			const { rule, item } = createRule({ endEarlier: true }, owner);
			owner.rules = [rule, createAdditionalMark(owner)];

			await rule.onItemActivated(activation(item, [marked]));

			expect(dialogWait()).not.toHaveBeenCalled();
			expect(quarryActors(owner)).toEqual(['Actor.wolf']);
			expect(far.actor.createEmbeddedDocuments).not.toHaveBeenCalled();
		});
	});

	it('exposes the picker group and description key', () => {
		expect(MarkTargetRule.group).toBe('triggers');
		expect(MarkTargetRule.description).toBe('NIMBLE.rules.markTarget.description');
	});
});
