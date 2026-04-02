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
