import { afterEach, describe, expect, it, vi } from 'vitest';
import {
	getActorCombatManaRules,
	getCombatManaGrantForCombat,
	getCombatManaGrantMap,
	getCombatManaGrantTotalForInitiative,
	getInitiativeCombatManaRules,
	hasCombatEndCombatManaRule,
	primeActorCombatManaSourceRules,
} from './combatManaRules.js';

function createRule(overrides: Record<string, unknown> = {}) {
	return {
		type: 'combatMana',
		disabled: false,
		resource: 'mana',
		trigger: 'initiativeRoll',
		clearOn: 'combatEnd',
		getGrantAmount: () => 2,
		...overrides,
	};
}

function createActor({
	rules = [],
	systemRules = [],
	type = 'character',
	flagData = {},
	sourceId,
}: {
	rules?: Record<string, unknown>[];
	systemRules?: Record<string, unknown>[];
	type?: string;
	flagData?: Record<string, unknown>;
	sourceId?: string;
} = {}) {
	const ruleMap = new Map(rules.map((rule, index) => [`rule-${index}`, rule]));
	const items = [
		{
			rules: ruleMap,
			system: { rules: systemRules },
			sourceId,
		},
	];

	return {
		type,
		items,
		getRollData: vi.fn(() => ({ intelligence: 3 })),
		getFlag: vi.fn((scope: string, key: string) => {
			if (scope === 'nimble' && key === 'combatManaGrants') return flagData;
			return undefined;
		}),
	} as unknown as Actor;
}

describe('combatManaRules utilities', () => {
	afterEach(() => {
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
	});

	it('collects combatMana rules from embedded items', () => {
		const actor = createActor({ rules: [createRule()] });
		expect(getActorCombatManaRules(actor)).toHaveLength(1);
	});

	it('filters initiative combat mana rules', () => {
		const actor = createActor({
			rules: [
				createRule(),
				createRule({ trigger: 'otherTrigger' }),
				createRule({ disabled: true }),
			],
		});
		expect(getInitiativeCombatManaRules(actor)).toHaveLength(1);
	});

	it('calculates total initiative combat mana grant', () => {
		const actor = createActor({
			rules: [createRule({ getGrantAmount: () => 2 }), createRule({ getGrantAmount: () => 3 })],
		});
		expect(getCombatManaGrantTotalForInitiative(actor)).toBe(5);
	});

	it('detects combat-end clear rules', () => {
		const actor = createActor({
			rules: [createRule({ clearOn: 'combatEnd' }), createRule({ clearOn: 'otherClear' })],
		});
		expect(hasCombatEndCombatManaRule(actor)).toBe(true);
	});

	it('reads combat mana grants from actor flags', () => {
		const actor = createActor({
			rules: [createRule()],
			flagData: { abc123: { mana: 4 } },
		});

		expect(getCombatManaGrantMap(actor)).toEqual({ abc123: { mana: 4 } });
		expect(getCombatManaGrantForCombat(actor, 'abc123')).toBe(4);
		expect(getCombatManaGrantForCombat(actor, 'missing')).toBe(0);
	});

	it('returns no rules for non-character actors', () => {
		const actor = createActor({ type: 'npc', rules: [createRule()] });
		expect(getActorCombatManaRules(actor)).toHaveLength(0);
	});

	it('collects combatMana rules from item.system.rules when runtime rule instances are unavailable', () => {
		const actor = createActor({
			rules: [],
			systemRules: [
				{
					id: 'from-source',
					type: 'combatMana',
					disabled: false,
					resource: 'mana',
					trigger: 'initiativeRoll',
					clearOn: 'combatEnd',
					formula: '3',
				},
			],
		});

		expect(getActorCombatManaRules(actor)).toHaveLength(1);
		expect(getCombatManaGrantTotalForInitiative(actor)).toBe(3);
	});

	it('does not double count same rule id between runtime rules and system.rules', () => {
		const actor = createActor({
			rules: [createRule({ id: 'shared-id', getGrantAmount: () => 2 })],
			systemRules: [
				{
					id: 'shared-id',
					type: 'combatMana',
					disabled: false,
					resource: 'mana',
					trigger: 'initiativeRoll',
					clearOn: 'combatEnd',
					formula: '99',
				},
			],
		});

		expect(getActorCombatManaRules(actor)).toHaveLength(1);
		expect(getCombatManaGrantTotalForInitiative(actor)).toBe(2);
	});

	it('falls back to compendium source rules when embedded item has no combatMana definition', () => {
		const fromUuidSync = vi.fn(() => ({
			system: {
				rules: [
					{
						id: 'from-compendium',
						type: 'combatMana',
						disabled: false,
						resource: 'mana',
						trigger: 'initiativeRoll',
						clearOn: 'combatEnd',
						formula: '4',
					},
				],
			},
		}));
		vi.stubGlobal('fromUuidSync', fromUuidSync);

		const actor = createActor({
			rules: [],
			systemRules: [],
			sourceId: 'Compendium.nimble.nimble-subclasses.Item.TESTASYNC123456',
		});

		expect(getActorCombatManaRules(actor)).toHaveLength(1);
		expect(getCombatManaGrantTotalForInitiative(actor)).toBe(4);
		expect(fromUuidSync).toHaveBeenCalledTimes(1);
	});

	it('primes source rules via async fromUuid when sync source resolution is incomplete', async () => {
		vi.stubGlobal(
			'fromUuidSync',
			vi.fn(() => ({ system: {} })),
		);
		const fromUuid = vi.fn(async () => ({
			system: {
				rules: [
					{
						id: 'from-async-source',
						type: 'combatMana',
						disabled: false,
						resource: 'mana',
						trigger: 'initiativeRoll',
						clearOn: 'combatEnd',
						formula: '5',
					},
				],
			},
		}));
		vi.stubGlobal('fromUuid', fromUuid);

		const actor = createActor({
			rules: [],
			systemRules: [],
			sourceId: 'Compendium.nimble.nimble-subclasses.Item.LBvh28XjvxIhffST',
		});

		await primeActorCombatManaSourceRules(actor);
		expect(getCombatManaGrantTotalForInitiative(actor)).toBe(5);
		expect(fromUuid).toHaveBeenCalledTimes(1);
	});
});
