import type { Mock } from 'vitest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ActionCostRule } from '../../models/rules/actionCost.js';
import resolveCharacterItemActionCost from './resolveCharacterItemActionCost.js';

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

interface ActivationItem {
	type?: string;
	system?: {
		identifier?: string;
		activation?: {
			cost?: { type?: string; quantity?: number };
		};
	};
}

// Type for test instances where we need to set internal properties directly.
// `itemTypes` is omitted and re-added as `string[]` because the schema infers a
// closed choice-union type that plain string literals don't satisfy.
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

function createActivationItem(
	overrides: { type?: string; identifier?: string; costType?: string; quantity?: number } = {},
): ActivationItem {
	return {
		type: overrides.type ?? 'spell',
		system: {
			identifier: overrides.identifier ?? '',
			activation: {
				cost: {
					type: overrides.costType ?? 'action',
					quantity: overrides.quantity ?? 1,
				},
			},
		},
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
		applies: config.applies ?? 'item',
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
	rule.applies = config.applies ?? 'item';
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

describe('resolveCharacterItemActionCost', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe('base cost passthrough', () => {
		it('returns the base cost when the actor has no rules', () => {
			const actor = createMockActor();
			const item = createActivationItem({ quantity: 2 });

			expect(resolveCharacterItemActionCost(actor, item)).toBe(2);
		});

		it('returns the base cost when the actor is null', () => {
			const item = createActivationItem({ quantity: 1 });

			expect(resolveCharacterItemActionCost(null, item)).toBe(1);
		});

		it('returns 0 for a null item', () => {
			const actor = createMockActor();

			expect(resolveCharacterItemActionCost(actor, null)).toBe(0);
		});

		it('ignores rules of other types', () => {
			const actor = createMockActor();
			actor.rules.push({ type: 'damageBonus' });
			const item = createActivationItem({ quantity: 1 });

			expect(resolveCharacterItemActionCost(actor, item)).toBe(1);
		});
	});

	describe('delta mode', () => {
		it('reduces a 2-action cost to 1 with a -1 delta', () => {
			const actor = createMockActor();
			addActionCostRule(actor, { mode: 'delta', value: '-1' });
			const item = createActivationItem({ quantity: 2 });

			expect(resolveCharacterItemActionCost(actor, item)).toBe(1);
		});

		it('increases the cost with a +1 delta', () => {
			const actor = createMockActor();
			addActionCostRule(actor, { mode: 'delta', value: '1' });
			const item = createActivationItem({ quantity: 1 });

			expect(resolveCharacterItemActionCost(actor, item)).toBe(2);
		});

		it('clamps the final cost at 0', () => {
			const actor = createMockActor();
			addActionCostRule(actor, { mode: 'delta', value: '-3' });
			const item = createActivationItem({ quantity: 1 });

			expect(resolveCharacterItemActionCost(actor, item)).toBe(0);
		});

		it('stacks multiple delta rules', () => {
			const actor = createMockActor();
			addActionCostRule(actor, { mode: 'delta', value: '1' });
			addActionCostRule(actor, { mode: 'delta', value: '1' });
			const item = createActivationItem({ quantity: 1 });

			expect(resolveCharacterItemActionCost(actor, item)).toBe(3);
		});

		it('resolves formula values against actor roll data', () => {
			const actor = createMockActor({ level: 2 });
			addActionCostRule(actor, { mode: 'delta', value: '@level' });
			const item = createActivationItem({ quantity: 1 });

			expect(resolveCharacterItemActionCost(actor, item)).toBe(3);
		});
	});

	describe('set mode', () => {
		it('sets the cost to 0 regardless of base cost', () => {
			const actor = createMockActor();
			addActionCostRule(actor, { mode: 'set', value: '0' });
			const item = createActivationItem({ quantity: 2 });

			expect(resolveCharacterItemActionCost(actor, item)).toBe(0);
		});

		it('overwrites the running cost with the set value', () => {
			const actor = createMockActor();
			addActionCostRule(actor, { mode: 'set', value: '3' });
			const item = createActivationItem({ quantity: 1 });

			expect(resolveCharacterItemActionCost(actor, item)).toBe(3);
		});
	});

	describe('priority ordering', () => {
		it('applies a lower-priority set before a higher-priority delta', () => {
			const actor = createMockActor();
			// Registered out of order to prove the resolver sorts by priority
			addActionCostRule(actor, { mode: 'delta', value: '1', priority: 2 });
			addActionCostRule(actor, { mode: 'set', value: '0', priority: 1 });
			const item = createActivationItem({ quantity: 2 });

			// set → 0 first, then delta +1 → 1
			expect(resolveCharacterItemActionCost(actor, item)).toBe(1);
		});

		it('lets a later set overwrite an earlier delta', () => {
			const actor = createMockActor();
			addActionCostRule(actor, { mode: 'delta', value: '1', priority: 1 });
			addActionCostRule(actor, { mode: 'set', value: '0', priority: 2 });
			const item = createActivationItem({ quantity: 2 });

			expect(resolveCharacterItemActionCost(actor, item)).toBe(0);
		});
	});

	describe('scoping', () => {
		it('does not apply a spell-scoped rule to a feature activation', () => {
			const actor = createMockActor();
			addActionCostRule(actor, { mode: 'delta', value: '1', itemTypes: ['spell'] });
			const item = createActivationItem({ type: 'feature', quantity: 1 });

			expect(resolveCharacterItemActionCost(actor, item)).toBe(1);
		});

		it('applies a spell-scoped rule to a spell activation', () => {
			const actor = createMockActor();
			addActionCostRule(actor, { mode: 'delta', value: '1', itemTypes: ['spell'] });
			const item = createActivationItem({ type: 'spell', quantity: 1 });

			expect(resolveCharacterItemActionCost(actor, item)).toBe(2);
		});

		it('applies a rule with empty scoping to every activation', () => {
			const actor = createMockActor();
			addActionCostRule(actor, { mode: 'delta', value: '1' });

			expect(resolveCharacterItemActionCost(actor, createActivationItem({ type: 'feature' }))).toBe(
				2,
			);
			expect(resolveCharacterItemActionCost(actor, createActivationItem({ type: 'object' }))).toBe(
				2,
			);
		});

		it('scopes by item identifier', () => {
			const actor = createMockActor();
			addActionCostRule(actor, { mode: 'set', value: '0', itemIdentifier: 'defend' });

			const matching = createActivationItem({ identifier: 'defend', quantity: 1 });
			const other = createActivationItem({ identifier: 'attack', quantity: 1 });

			expect(resolveCharacterItemActionCost(actor, matching)).toBe(0);
			expect(resolveCharacterItemActionCost(actor, other)).toBe(1);
		});

		it('requires both itemTypes and itemIdentifier to match when both are set', () => {
			const actor = createMockActor();
			addActionCostRule(actor, {
				mode: 'set',
				value: '0',
				itemTypes: ['spell'],
				itemIdentifier: 'fireball',
			});

			const wrongType = createActivationItem({
				type: 'feature',
				identifier: 'fireball',
				quantity: 1,
			});
			const match = createActivationItem({ type: 'spell', identifier: 'fireball', quantity: 1 });

			expect(resolveCharacterItemActionCost(actor, wrongType)).toBe(1);
			expect(resolveCharacterItemActionCost(actor, match)).toBe(0);
		});
	});

	describe('rule gating', () => {
		it('ignores disabled rules', () => {
			const actor = createMockActor();
			addActionCostRule(actor, { mode: 'delta', value: '1', disabled: true });
			const item = createActivationItem({ quantity: 1 });

			expect(resolveCharacterItemActionCost(actor, item)).toBe(1);
		});

		it('ignores rules whose predicate fails', () => {
			const actor = createMockActor();
			addActionCostRule(actor, { mode: 'delta', value: '1', predicatePasses: false });
			const item = createActivationItem({ quantity: 1 });

			expect(resolveCharacterItemActionCost(actor, item)).toBe(1);
		});

		it('does not price activations without an action cost type', () => {
			const actor = createMockActor();
			addActionCostRule(actor, { mode: 'set', value: '2' });
			const item = createActivationItem({ costType: 'minutes', quantity: 10 });

			expect(resolveCharacterItemActionCost(actor, item)).toBe(0);
		});

		it('modifies an explicit zero-cost action activation', () => {
			const actor = createMockActor();
			addActionCostRule(actor, { mode: 'delta', value: '1' });
			const item = createActivationItem({ quantity: 0 });

			expect(resolveCharacterItemActionCost(actor, item)).toBe(1);
		});

		it('ignores rules that apply to heroic reactions', () => {
			const actor = createMockActor();
			addActionCostRule(actor, { applies: 'heroicReaction', mode: 'set', value: '0' });
			const item = createActivationItem({ quantity: 2 });

			expect(resolveCharacterItemActionCost(actor, item)).toBe(2);
		});
	});
});
