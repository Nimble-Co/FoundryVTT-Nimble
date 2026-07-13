import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SYSTEM_ID } from '#system';
import { MarkTargetRule } from './markTarget.js';

interface MockTargetActor {
	uuid: string;
	name: string;
	toggleStatusEffect: ReturnType<typeof vi.fn>;
}

function createTargetToken(uuid: string, name: string) {
	const actor: MockTargetActor = {
		uuid: `Actor.${uuid}`,
		name,
		toggleStatusEffect: vi.fn(async () => true),
	};
	return { uuid: `Token.${uuid}`, actor };
}

interface MarkOwner {
	getFlag: ReturnType<typeof vi.fn>;
	setFlag: ReturnType<typeof vi.fn>;
	rules: MarkTargetRule[];
	getRollData: ReturnType<typeof vi.fn>;
}

function createOwner(): MarkOwner {
	return {
		getFlag: vi.fn(() => ({})),
		setFlag: vi.fn(async () => undefined),
		rules: [],
		getRollData: vi.fn(() => ({})),
	};
}

function createRule(
	config: { flagKey?: string; statusCondition?: string; maxTargets?: number },
	owner: MarkOwner,
	itemUuid = 'item-uuid',
): { rule: MarkTargetRule; item: { uuid: string } } {
	const item = { isEmbedded: true, actor: owner, name: "Hunter's Mark", uuid: itemUuid };
	const sourceData = {
		type: 'markTarget',
		flagKey: config.flagKey ?? 'quarry',
		statusCondition: config.statusCondition ?? 'marked',
		maxTargets: config.maxTargets ?? 1,
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

	Object.defineProperty(rule, 'item', { get: () => item, configurable: true });
	Object.defineProperty(rule, '_predicate', { get: () => ({ size: 0 }), configurable: true });

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

describe('MarkTargetRule', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		// Eviction resolves token actors via the global fromUuid; reset per test so a
		// test that reassigns it can't leak into the next.
		(globalThis as { fromUuid?: unknown }).fromUuid = vi.fn(async () => null);
	});

	it('marks a target: stores the flag entry and applies the status condition', async () => {
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
		expect(token.actor.toggleStatusEffect).toHaveBeenCalledWith('marked', { active: true });
	});

	it('ignores activation of a different item', async () => {
		const owner = createOwner();
		const { rule } = createRule({}, owner);
		owner.rules = [rule];
		const token = createTargetToken('goblin', 'Goblin');

		await rule.onItemActivated(activation({ uuid: 'some-other-item' }, [token]));

		expect(owner.setFlag).not.toHaveBeenCalled();
		expect(token.actor.toggleStatusEffect).not.toHaveBeenCalled();
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

	it('clears the status condition off an evicted quarry that has a token', async () => {
		const owner = createOwner();
		owner.getFlag = vi.fn(() => ({
			quarry: [{ actorUuid: 'Actor.old', tokenUuid: 'Token.old', name: 'Old' }],
		}));
		const evictedActor = { toggleStatusEffect: vi.fn(async () => true) };
		(globalThis as { fromUuid?: unknown }).fromUuid = vi.fn(async () => ({ actor: evictedActor }));

		const { rule, item } = createRule({ maxTargets: 1 }, owner);
		owner.rules = [rule];
		const token = createTargetToken('new', 'New');

		await rule.onItemActivated(activation(item, [token]));

		expect(token.actor.toggleStatusEffect).toHaveBeenCalledWith('marked', { active: true });
		expect(evictedActor.toggleStatusEffect).toHaveBeenCalledWith('marked', { active: false });
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
		Object.defineProperty(rule, 'item', {
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
		expect(token.actor.toggleStatusEffect).not.toHaveBeenCalled();
	});

	it('exposes the picker group and description key', () => {
		expect(MarkTargetRule.group).toBe('triggers');
		expect(MarkTargetRule.description).toBe('NIMBLE.rules.markTarget.description');
	});
});
