import { afterEach, describe, expect, it, vi } from 'vitest';
import { getInitiativeMessageRuleSources } from '../../documents/combat/handlers/initiativeMessageHandler.js';
import { InitiativeMessageRule } from './initiativeMessage.js';

function createMockItem() {
	const mockActor = {
		system: {},
		getDomain: () => new Set<string>(),
		getRollData: vi.fn(() => ({ dexterity: 3 })),
	};
	return {
		isEmbedded: true,
		actor: mockActor,
		name: 'Test Item',
		uuid: 'test-uuid',
		getDomain: () => new Set<string>(),
	};
}

function createRule(overrides: Record<string, unknown> = {}) {
	const item = createMockItem();
	const rule = new InitiativeMessageRule(
		{
			formula: '6',
			message: 'Move {value} spaces!',
			label: 'Test Rule',
			disabled: false,
			id: 'test-id',
			identifier: '',
			priority: 1,
			predicate: {},
			type: 'initiativeMessage',
			...overrides,
		},
		{
			parent: item as unknown as foundry.abstract.DataModel.Any,
			strict: false,
		},
	);
	Object.defineProperty(rule, 'item', { get: () => item, configurable: true });
	rule.formula = (overrides.formula as string) ?? '6';
	rule.message = (overrides.message as string) ?? 'Move {value} spaces!';
	rule.label = (overrides.label as string) ?? 'Test Rule';
	return rule;
}

describe('InitiativeMessageRule', () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe('resolveMessage', () => {
		it('substitutes a literal formula result into {value}', () => {
			const rule = createRule({ formula: '6', message: 'Move {value} spaces!' });
			expect(rule.resolveMessage()).toBe('Move 6 spaces!');
		});

		it('replaces multiple {value} tokens', () => {
			const rule = createRule({ formula: '4', message: '{value} here and {value} there' });
			expect(rule.resolveMessage()).toBe('4 here and 4 there');
		});

		it('returns empty string when message is empty', () => {
			const rule = createRule({ formula: '4', message: '' });
			expect(rule.resolveMessage()).toBe('');
		});

		it('defaults to 0 when formula is empty', () => {
			const rule = createRule({ formula: '', message: 'Move {value} spaces!' });
			expect(rule.resolveMessage()).toBe('Move 0 spaces!');
		});
	});
});

describe('getInitiativeMessageRuleSources', () => {
	afterEach(() => {
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
	});

	it('returns initiativeMessage rules from embedded item', () => {
		const item = {
			system: {
				rules: [
					{ type: 'initiativeMessage', formula: '4', message: 'test', disabled: false },
					{ type: 'speedBonus', value: '1' },
				],
			},
		};
		const result = getInitiativeMessageRuleSources(item);
		expect(result).toHaveLength(1);
		expect(result[0].type).toBe('initiativeMessage');
	});

	it('filters out disabled rules', () => {
		const item = {
			system: {
				rules: [{ type: 'initiativeMessage', formula: '4', message: 'test', disabled: true }],
			},
		};
		expect(getInitiativeMessageRuleSources(item)).toHaveLength(0);
	});

	it('falls back to compendium source when embedded item has no initiativeMessage rule', () => {
		const compendiumRules = [
			{ type: 'initiativeMessage', formula: '4', message: 'from compendium', disabled: false },
		];
		vi.stubGlobal('fromUuidSync', () => ({ system: { rules: compendiumRules } }));

		const item = {
			sourceId: 'Compendium.nimble.features.Item.abc123',
			system: { rules: [{ type: 'speedBonus', value: '1' }] },
		};

		const result = getInitiativeMessageRuleSources(item);
		expect(result).toHaveLength(1);
		expect(result[0].message).toBe('from compendium');
	});

	it('returns empty array when item has no rules and no compendium source', () => {
		const item = { system: { rules: [] } };
		expect(getInitiativeMessageRuleSources(item)).toHaveLength(0);
	});
});
