import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { IncomingReactionEntry } from './incomingReactionEntry.js';
import { collectRerollEntries, findRerollRule, type RerollRuleLike } from './rerollEntries.js';

const testGlobals = globalThis as unknown as {
	game: { settings?: { get: (scope: string, key: string) => unknown } };
	fromUuidSync: unknown;
};

function setToggles(toggles: Record<string, boolean>): void {
	testGlobals.game.settings = { get: (_scope, key) => toggles[key] ?? true };
}

const FREE = {
	chargePoolIdentifier: '',
	chargeCost: 1,
	manaCost: 0,
	woundCost: 0,
	heroicReaction: '' as const,
};

function rerollRule(overrides: Partial<RerollRuleLike> = {}): RerollRuleLike {
	return {
		type: 'reroll',
		id: 'rule-1',
		label: '',
		item: { name: 'Pocket Sand', uuid: 'Actor.hero.Item.sand' },
		outcome: 'always',
		automatic: false,
		rerollCost: FREE,
		offersRerollOn: () => true,
		...overrides,
	};
}

const ROLLER = { side: 'roller', delivery: 'melee', targetTokenUuid: null } as const;
const TARGET = { side: 'target', delivery: 'melee', targetTokenUuid: 'Scene.s.Token.t' } as const;

describe('collectRerollEntries', () => {
	beforeEach(() => setToggles({}));
	afterEach(() => {
		delete testGlobals.game.settings;
	});

	it('builds a button entry per rule that offers on this side', () => {
		const offersRerollOn = vi.fn(() => true);
		const { manual, automatic } = collectRerollEntries(
			{ uuid: 'Actor.hero', rules: [rerollRule({ outcome: 'miss', offersRerollOn })] },
			ROLLER,
		);

		expect(automatic).toEqual([]);
		expect(manual).toEqual([
			expect.objectContaining({
				kind: 'reroll',
				source: 'rule',
				actorUuid: 'Actor.hero',
				tokenUuid: null,
				targetTokenUuid: null,
				label: 'Pocket Sand',
				ruleId: 'rule-1',
				itemUuid: 'Actor.hero.Item.sand',
				used: false,
				outcomeTrigger: 'miss',
			}),
		]);
		expect(offersRerollOn).toHaveBeenCalledWith({ side: 'roller', delivery: 'melee' });
	});

	it('ties a target entry to the attack target token', () => {
		const { manual } = collectRerollEntries({ uuid: 'Actor.t', rules: [rerollRule()] }, TARGET);
		expect(manual[0]?.targetTokenUuid).toBe('Scene.s.Token.t');
	});

	it('skips rules that do not offer, and rules of another type', () => {
		const { manual } = collectRerollEntries(
			{
				uuid: 'Actor.hero',
				rules: [rerollRule({ offersRerollOn: () => false }), { type: 'modifyIncomingAttack' }],
			},
			ROLLER,
		);
		expect(manual).toEqual([]);
	});

	it('gives two rules two entries', () => {
		const { manual } = collectRerollEntries(
			{ uuid: 'Actor.hero', rules: [rerollRule({ id: 'a' }), rerollRule({ id: 'b' })] },
			ROLLER,
		);
		expect(manual.map((entry) => entry.ruleId)).toEqual(['a', 'b']);
		expect(new Set(manual.map((entry) => entry.id)).size).toBe(2);
	});

	it('returns nothing for a missing actor or an actor without a uuid', () => {
		expect(collectRerollEntries(null, ROLLER).manual).toEqual([]);
		expect(collectRerollEntries({ rules: [rerollRule()] }, ROLLER).manual).toEqual([]);
	});

	it('rerolls by itself when the rule is automatic and Feature Effects is on', () => {
		const rule = rerollRule({ automatic: true });
		const { manual, automatic } = collectRerollEntries({ uuid: 'Actor.t', rules: [rule] }, TARGET);
		expect(manual).toEqual([]);
		expect(automatic).toHaveLength(1);
		expect(automatic[0]?.rule).toBe(rule);
	});

	it('shows an automatic rule as a button while Feature Effects is off', () => {
		setToggles({ 'automation.applyRuleEffects': false });
		const { manual, automatic } = collectRerollEntries(
			{ uuid: 'Actor.t', rules: [rerollRule({ automatic: true })] },
			TARGET,
		);
		expect(automatic).toEqual([]);
		expect(manual).toHaveLength(1);
	});

	it('shows an automatic rule with a cost as a button for a client that cannot pay it', () => {
		const rule = rerollRule({
			automatic: true,
			rerollCost: { ...FREE, chargePoolIdentifier: 'sand' },
		});
		const notOwner = collectRerollEntries(
			{ uuid: 'Actor.t', isOwner: false, rules: [rule] },
			TARGET,
		);
		const owner = collectRerollEntries({ uuid: 'Actor.t', isOwner: true, rules: [rule] }, TARGET);

		expect(notOwner.manual).toHaveLength(1);
		expect(owner.automatic).toHaveLength(1);
	});

	it('lets any client roll an automatic rule whose cost charges nothing', () => {
		setToggles({ 'automation.resourceSpending': false });
		const rule = rerollRule({ automatic: true, rerollCost: { ...FREE, woundCost: 1 } });
		const { automatic } = collectRerollEntries(
			{ uuid: 'Actor.t', isOwner: false, rules: [rule] },
			TARGET,
		);
		expect(automatic).toHaveLength(1);
	});
});

describe('findRerollRule', () => {
	const entry = {
		id: 'entry-1',
		kind: 'reroll',
		itemUuid: 'Actor.hero.Item.sand',
		ruleId: 'rule-1',
	} as IncomingReactionEntry;

	afterEach(() => {
		testGlobals.fromUuidSync = vi.fn();
	});

	function useItemRules(rules: RerollRuleLike[]): void {
		testGlobals.fromUuidSync = vi.fn(() => ({
			rules: new Map(rules.map((rule) => [rule.id ?? '', rule])),
		}));
	}

	it('finds the live rule by item and rule id', () => {
		const rule = rerollRule();
		useItemRules([rule]);
		expect(findRerollRule(entry)).toBe(rule);
	});

	it('returns null for a disabled rule, another rule type, or no item', () => {
		useItemRules([rerollRule({ disabled: true })]);
		expect(findRerollRule(entry)).toBeNull();
		useItemRules([rerollRule({ type: 'note' })]);
		expect(findRerollRule(entry)).toBeNull();
		expect(findRerollRule({ ...entry, itemUuid: '' })).toBeNull();
	});
});
