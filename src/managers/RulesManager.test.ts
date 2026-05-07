import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RulesManager } from './RulesManager.js';

interface RuleSource {
	id: string;
	type: string;
	label: string;
	disabled: boolean;
}

interface MockItem {
	name: string;
	uuid: string;
	system: {
		rules: RuleSource[];
	};
	update: ReturnType<typeof vi.fn>;
}

class MockRuleDataModel {
	id: string;
	type: string;
	disabled: boolean;

	constructor(source: RuleSource, _options?: unknown) {
		this.id = source.id;
		this.type = source.type;
		this.disabled = source.disabled;
	}
}

function createMockItem(rules: RuleSource[]): MockItem {
	return {
		name: 'Test Item',
		uuid: 'Item.test',
		system: {
			rules,
		},
		update: vi.fn().mockResolvedValue(undefined),
	};
}

beforeEach(() => {
	const config = CONFIG as unknown as {
		NIMBLE: { ruleDataModels: Record<string, unknown> };
	};

	config.NIMBLE.ruleDataModels = {
		...config.NIMBLE.ruleDataModels,
		armorClass: MockRuleDataModel,
	};
});

describe('RulesManager all-rules toggles', () => {
	it('disableAllRules sets disabled=true for every rule on the item', async () => {
		const item = createMockItem([
			{ id: 'rule-1', type: 'armorClass', label: 'Rule One', disabled: false },
			{ id: 'rule-2', type: 'armorClass', label: 'Rule Two', disabled: false },
		]);

		const manager = new RulesManager(
			item as unknown as ConstructorParameters<typeof RulesManager>[0],
		);

		const updated = await manager.disableAllRules();

		expect(updated).toBe(true);
		expect(item.update).toHaveBeenCalledWith({
			'system.rules': [
				{ id: 'rule-1', type: 'armorClass', label: 'Rule One', disabled: true },
				{ id: 'rule-2', type: 'armorClass', label: 'Rule Two', disabled: true },
			],
		});
	});

	it('enableAllRules sets disabled=false for every rule on the item', async () => {
		const item = createMockItem([
			{ id: 'rule-1', type: 'armorClass', label: 'Rule One', disabled: true },
			{ id: 'rule-2', type: 'armorClass', label: 'Rule Two', disabled: true },
		]);

		const manager = new RulesManager(
			item as unknown as ConstructorParameters<typeof RulesManager>[0],
		);

		const updated = await manager.enableAllRules();

		expect(updated).toBe(true);
		expect(item.update).toHaveBeenCalledWith({
			'system.rules': [
				{ id: 'rule-1', type: 'armorClass', label: 'Rule One', disabled: false },
				{ id: 'rule-2', type: 'armorClass', label: 'Rule Two', disabled: false },
			],
		});
	});
});

describe('RulesManager.reorderRules', () => {
	it('reorders system.rules to match the provided id order', async () => {
		const item = createMockItem([
			{ id: 'a', type: 'armorClass', label: 'A', disabled: false },
			{ id: 'b', type: 'armorClass', label: 'B', disabled: false },
			{ id: 'c', type: 'armorClass', label: 'C', disabled: false },
		]);

		const manager = new RulesManager(
			item as unknown as ConstructorParameters<typeof RulesManager>[0],
		);

		const ok = await manager.reorderRules(['c', 'a', 'b']);

		expect(ok).toBe(true);
		expect(item.update).toHaveBeenCalledWith({
			'system.rules': [
				{ id: 'c', type: 'armorClass', label: 'C', disabled: false },
				{ id: 'a', type: 'armorClass', label: 'A', disabled: false },
				{ id: 'b', type: 'armorClass', label: 'B', disabled: false },
			],
		});
	});

	it('appends rules whose ids are missing from the requested order', async () => {
		const item = createMockItem([
			{ id: 'a', type: 'armorClass', label: 'A', disabled: false },
			{ id: 'b', type: 'armorClass', label: 'B', disabled: false },
			{ id: 'c', type: 'armorClass', label: 'C', disabled: false },
		]);

		const manager = new RulesManager(
			item as unknown as ConstructorParameters<typeof RulesManager>[0],
		);

		await manager.reorderRules(['c']);

		expect(item.update).toHaveBeenCalledWith({
			'system.rules': [
				{ id: 'c', type: 'armorClass', label: 'C', disabled: false },
				{ id: 'a', type: 'armorClass', label: 'A', disabled: false },
				{ id: 'b', type: 'armorClass', label: 'B', disabled: false },
			],
		});
	});

	it('ignores unknown ids in the requested order', async () => {
		const item = createMockItem([
			{ id: 'a', type: 'armorClass', label: 'A', disabled: false },
			{ id: 'b', type: 'armorClass', label: 'B', disabled: false },
		]);

		const manager = new RulesManager(
			item as unknown as ConstructorParameters<typeof RulesManager>[0],
		);

		await manager.reorderRules(['ghost', 'b', 'a']);

		expect(item.update).toHaveBeenCalledWith({
			'system.rules': [
				{ id: 'b', type: 'armorClass', label: 'B', disabled: false },
				{ id: 'a', type: 'armorClass', label: 'A', disabled: false },
			],
		});
	});

	it('round-trips: reordering twice returns to the original order', async () => {
		const original = [
			{ id: 'a', type: 'armorClass', label: 'A', disabled: false },
			{ id: 'b', type: 'armorClass', label: 'B', disabled: false },
			{ id: 'c', type: 'armorClass', label: 'C', disabled: false },
		];
		const item = createMockItem([...original]);

		const manager = new RulesManager(
			item as unknown as ConstructorParameters<typeof RulesManager>[0],
		);

		await manager.reorderRules(['c', 'a', 'b']);
		const firstWrite = item.update.mock.calls[0][0]['system.rules'] as RuleSource[];
		// Simulate persistence by writing the new order back to the mock item.
		item.system.rules = firstWrite;

		await manager.reorderRules(['a', 'b', 'c']);
		const secondWrite = item.update.mock.calls[1][0]['system.rules'] as RuleSource[];

		expect(secondWrite).toEqual(original);
	});
});

/**
 * Integration test for the manager's add → persist → reload flow. Per-rule
 * schema shape is covered by `src/models/rules/*.test.ts`; this covers the
 * manager wiring (writing through `item.update`, reconstructing rule
 * instances on next load).
 *
 * Uses `MockRuleDataModel` rather than a real rule class because the shared
 * mocked `foundry.abstract.DataModel` has an empty constructor and would
 * drop the source data on reconstruction. Real-Foundry round-trip is
 * exercised by manual smoke testing once the builder is wired into the
 * sheet.
 */
describe('RulesManager add + reload round-trip', () => {
	it('persists a new rule via item.update and reconstructs it on next load', async () => {
		const item = createMockItem([]);

		const payload = {
			id: 'new-rule-id',
			type: 'armorClass',
			label: 'Round-trip',
			disabled: false,
		};

		await RulesManager.addRule(
			item as unknown as ConstructorParameters<typeof RulesManager>[0],
			payload,
		);

		// The mock's `update` doesn't mutate `system.rules` — it just records
		// the call args. Apply that write manually so the next manager
		// construction sees the new state.
		const written = item.update.mock.calls[0][0]['system.rules'] as RuleSource[];
		item.system.rules = written;

		const reloaded = new RulesManager(
			item as unknown as ConstructorParameters<typeof RulesManager>[0],
		);

		const rule = reloaded.get('new-rule-id');
		expect(rule).toBeDefined();
		expect(rule).toMatchObject({
			id: 'new-rule-id',
			type: 'armorClass',
			disabled: false,
		});
	});
});
