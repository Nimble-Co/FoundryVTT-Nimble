import type { Mock } from 'vitest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ActionCostRule } from '../models/rules/actionCost.js';
import resolveHeroicReactionActionCost from './resolveHeroicReactionActionCost.js';

interface MockRollData {
	level?: number;
	[key: string]: unknown;
}

interface MockActor {
	rules: unknown[];
	getRollData: Mock<() => MockRollData>;
	getDomain: Mock<() => Set<string>>;
}

interface MockOwnerItem {
	isEmbedded: boolean;
	actor: MockActor;
	name: string;
	uuid: string;
	getDomain: Mock<() => Set<string>>;
}

// Type for test instances where we need to set internal properties directly.
// `itemTypes` / `reactions` are omitted and re-added as `string[]` because the
// schema infers closed choice-union types that plain string literals don't
// satisfy.
type ActionCostRuleTestInstance = Omit<ActionCostRule, 'itemTypes' | 'reactions'> & {
	applies: 'item' | 'heroicReaction';
	mode: 'delta' | 'set';
	value: string;
	itemTypes: string[];
	itemIdentifier: string;
	reactions: string[];
	disabled: boolean;
	priority: number;
	type: string;
};

function createMockActor(rollData: MockRollData = {}): MockActor {
	return {
		rules: [],
		getRollData: vi.fn(() => rollData),
		getDomain: vi.fn(() => new Set<string>()),
	};
}

/**
 * Creates an ActionCostRule instance owned by a mock item on the given actor,
 * and registers it in the actor's rules array.
 */
function addActionCostRule(
	actor: MockActor,
	config: {
		applies?: 'item' | 'heroicReaction';
		mode?: 'delta' | 'set';
		value?: string;
		itemTypes?: string[];
		itemIdentifier?: string;
		reactions?: string[];
		disabled?: boolean;
		priority?: number;
		predicatePasses?: boolean;
	} = {},
): ActionCostRuleTestInstance {
	const ownerItem: MockOwnerItem = {
		isEmbedded: true,
		actor,
		name: 'Test Feature',
		uuid: 'test-owner-item-uuid',
		getDomain: vi.fn(() => new Set<string>()),
	};

	const sourceData = {
		applies: config.applies ?? 'heroicReaction',
		mode: config.mode ?? 'delta',
		value: config.value ?? '1',
		itemTypes: config.itemTypes ?? [],
		itemIdentifier: config.itemIdentifier ?? '',
		reactions: config.reactions ?? [],
		disabled: config.disabled ?? false,
		label: 'Test Rule',
		id: 'test-rule-id',
		identifier: '',
		priority: config.priority ?? 1,
		predicate: {},
		type: 'actionCost',
	};

	const rule = new ActionCostRule(
		sourceData as foundry.data.fields.SchemaField.CreateData<ActionCostRule['schema']['fields']>,
		{ parent: ownerItem as unknown as foundry.abstract.DataModel.Any, strict: false },
	) as ActionCostRuleTestInstance;

	// Manually set properties since the mock DataModel doesn't do this automatically
	rule.applies = config.applies ?? 'heroicReaction';
	rule.mode = config.mode ?? 'delta';
	rule.value = config.value ?? '1';
	rule.itemTypes = config.itemTypes ?? [];
	rule.itemIdentifier = config.itemIdentifier ?? '';
	rule.reactions = config.reactions ?? [];
	rule.disabled = config.disabled ?? false;
	rule.priority = config.priority ?? 1;
	rule.type = 'actionCost';

	Object.defineProperty(rule, 'item', {
		get: () => ownerItem,
		configurable: true,
	});

	const predicatePasses = config.predicatePasses ?? true;
	Object.defineProperty(rule, 'predicate', {
		get: () => ({ size: predicatePasses ? 0 : 1, test: () => predicatePasses }),
		configurable: true,
	});

	actor.rules.push(rule);

	return rule;
}

describe('resolveHeroicReactionActionCost', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe('base cost', () => {
		it('costs 1 action per reaction key when the actor has no rules', () => {
			const actor = createMockActor();

			expect(resolveHeroicReactionActionCost(actor, ['defend'])).toBe(1);
			expect(resolveHeroicReactionActionCost(actor, ['interpose', 'defend'])).toBe(2);
		});

		it('returns the key count when the actor is null', () => {
			expect(resolveHeroicReactionActionCost(null, ['defend'])).toBe(1);
		});

		it('deduplicates repeated reaction keys', () => {
			const actor = createMockActor();

			expect(resolveHeroicReactionActionCost(actor, ['defend', 'defend'])).toBe(1);
		});

		it('returns 0 for an empty key list', () => {
			expect(resolveHeroicReactionActionCost(createMockActor(), [])).toBe(0);
		});
	});

	describe('reaction scoping', () => {
		it('discounts only the scoped reaction', () => {
			const actor = createMockActor();
			addActionCostRule(actor, { mode: 'delta', value: '-1', reactions: ['defend'] });

			expect(resolveHeroicReactionActionCost(actor, ['defend'])).toBe(0);
			expect(resolveHeroicReactionActionCost(actor, ['opportunityAttack'])).toBe(1);
		});

		it('applies a rule with an empty reactions list to every reaction', () => {
			const actor = createMockActor();
			addActionCostRule(actor, { mode: 'set', value: '0' });

			expect(resolveHeroicReactionActionCost(actor, ['defend'])).toBe(0);
			expect(resolveHeroicReactionActionCost(actor, ['interpose'])).toBe(0);
			expect(resolveHeroicReactionActionCost(actor, ['help'])).toBe(0);
			expect(resolveHeroicReactionActionCost(actor, ['opportunityAttack'])).toBe(0);
		});

		it('prices each reaction of a combined use independently', () => {
			const actor = createMockActor();
			addActionCostRule(actor, { mode: 'delta', value: '-1', reactions: ['defend'] });

			// Interpose keeps its full cost; the discount on Defend never
			// subsidizes it.
			expect(resolveHeroicReactionActionCost(actor, ['interpose', 'defend'])).toBe(1);
		});
	});

	describe('fold semantics', () => {
		it('clamps each reaction cost at 0', () => {
			const actor = createMockActor();
			addActionCostRule(actor, { mode: 'delta', value: '-3' });

			expect(resolveHeroicReactionActionCost(actor, ['interpose', 'defend'])).toBe(0);
		});

		it('increases the cost with a positive delta', () => {
			const actor = createMockActor();
			addActionCostRule(actor, { mode: 'delta', value: '1' });

			expect(resolveHeroicReactionActionCost(actor, ['defend'])).toBe(2);
		});

		it('resolves formula values against actor roll data', () => {
			const actor = createMockActor({ level: 2 });
			addActionCostRule(actor, { mode: 'delta', value: '@level' });

			expect(resolveHeroicReactionActionCost(actor, ['defend'])).toBe(3);
		});

		it('applies rules in priority order', () => {
			const actor = createMockActor();
			// Registered out of order to prove the resolver sorts by priority
			addActionCostRule(actor, { mode: 'delta', value: '1', priority: 2 });
			addActionCostRule(actor, { mode: 'set', value: '0', priority: 1 });

			// set → 0 first, then delta +1 → 1
			expect(resolveHeroicReactionActionCost(actor, ['defend'])).toBe(1);
		});
	});

	describe('rule gating', () => {
		it('ignores rules that apply to item activations', () => {
			const actor = createMockActor();
			addActionCostRule(actor, { applies: 'item', mode: 'set', value: '0' });

			expect(resolveHeroicReactionActionCost(actor, ['defend'])).toBe(1);
		});

		it('ignores disabled rules', () => {
			const actor = createMockActor();
			addActionCostRule(actor, { mode: 'set', value: '0', disabled: true });

			expect(resolveHeroicReactionActionCost(actor, ['defend'])).toBe(1);
		});

		it('ignores rules whose predicate fails', () => {
			const actor = createMockActor();
			addActionCostRule(actor, { mode: 'set', value: '0', predicatePasses: false });

			expect(resolveHeroicReactionActionCost(actor, ['defend'])).toBe(1);
		});

		it('ignores rules of other types', () => {
			const actor = createMockActor();
			actor.rules.push({ type: 'damageBonus' });

			expect(resolveHeroicReactionActionCost(actor, ['defend'])).toBe(1);
		});
	});
});
