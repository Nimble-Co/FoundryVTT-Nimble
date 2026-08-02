import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import initiativeMessageHandler, {
	getInitiativeMessageRuleSources,
} from '../../documents/combat/handlers/initiativeMessageHandler.js';
import { AUTOMATION_SETTING_KEYS } from '../../settings/automationSettings.js';
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

describe('InitiativeMessageRule.schema', () => {
	it('defines the expected fields', () => {
		const schema = InitiativeMessageRule.defineSchema();
		expect(schema).toHaveProperty('type');
		expect(schema).toHaveProperty('formula');
		expect(schema).toHaveProperty('message');
	});
});

describe('InitiativeMessageRule class metadata', () => {
	it('exposes the picker group and i18n description key', () => {
		expect(InitiativeMessageRule.group).toBe('notes');
		expect(InitiativeMessageRule.description).toBe('NIMBLE.rules.initiativeMessage.description');
	});
});

describe('initiativeMessageHandler', () => {
	const gameGlobal = globalThis as unknown as {
		game: { settings?: { get: ReturnType<typeof vi.fn> } };
	};
	const foundryGlobal = globalThis as unknown as {
		foundry: { utils: { escapeHTML?: (value: string) => string } };
	};
	let chatCreate: ReturnType<typeof vi.fn>;
	let hadEscapeHTML: boolean;

	function createCombatant() {
		const item = {
			system: {
				rules: [
					{
						type: 'initiativeMessage',
						formula: '6',
						message: 'Move {value} spaces!',
						label: 'Test Reminder',
						disabled: false,
					},
				],
			},
		};
		const actor = { isOwner: true, items: [item] };
		return {
			type: 'character',
			initiative: null,
			actor,
			token: {},
		} as unknown as Combatant.Implementation;
	}

	beforeEach(() => {
		chatCreate = vi.fn().mockResolvedValue(undefined);
		vi.stubGlobal('ChatMessage', { create: chatCreate, getSpeaker: vi.fn(() => ({})) });
		hadEscapeHTML = 'escapeHTML' in foundryGlobal.foundry.utils;
		foundryGlobal.foundry.utils.escapeHTML = (value: string) => String(value);
		// The mock DataModel does not hydrate rule fields from source data,
		// so resolve the message via a prototype spy instead.
		vi.spyOn(InitiativeMessageRule.prototype, 'resolveMessage').mockReturnValue('Move 6 spaces!');
	});

	afterEach(() => {
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
		if (!hadEscapeHTML) delete foundryGlobal.foundry.utils.escapeHTML;
		gameGlobal.game.settings = undefined;
	});

	it('posts the reminder chat message by default (fail-open, no stored setting)', async () => {
		await initiativeMessageHandler(createCombatant());

		expect(chatCreate).toHaveBeenCalledTimes(1);
	});

	it('posts no reminder when the chat notifications automation toggle is off', async () => {
		gameGlobal.game.settings = {
			get: vi.fn(
				(_namespace: string, key: string) => key !== AUTOMATION_SETTING_KEYS.chatNotifications,
			),
		};

		await initiativeMessageHandler(createCombatant());

		expect(chatCreate).not.toHaveBeenCalled();
	});
});
