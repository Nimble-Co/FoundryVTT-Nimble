import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { IncomingReactionEntry, RerollSide, RerollTrigger } from './incomingReactionEntry.js';
import {
	type AutomaticReroll,
	collectRerollEntries,
	findRerollRule,
	nextAutomaticReroll,
	offerStands,
	type RerollingActor,
	type RerollRollContext,
	type RerollRuleLike,
	rerollRuleKey,
	usableRerollEntry,
	withNewRerollEntries,
} from './rerollEntries.js';

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

const TOKEN = 'Scene.s.Token.t';
const OTHER_TOKEN = 'Scene.s.Token.other';
const CRIT = { isCritical: true, isMiss: false };
const HIT = { isCritical: false, isMiss: false };
const MISS = { isCritical: false, isMiss: true };

/** A rule that offers to the side it is used by, on any delivery. */
function rerollRule(overrides: Partial<RerollRuleLike> & { usedBy?: RerollSide } = {}) {
	const { usedBy = 'target', ...rest } = overrides;
	return {
		type: 'reroll',
		id: 'rule-1',
		label: '',
		item: { name: 'Pocket Sand', uuid: 'Item.sand' },
		outcome: 'always' as RerollTrigger,
		automatic: false,
		rerollCost: FREE,
		offersRerollOn: vi.fn((context: { side: RerollSide }) => context.side === usedBy),
		...rest,
	} satisfies RerollRuleLike;
}

function actor(uuid: string, rules: RerollRuleLike[] = [], extra: Partial<RerollingActor> = {}) {
	return { uuid, rules, ...extra };
}

function context(overrides: Partial<RerollRollContext> = {}): RerollRollContext {
	return {
		attacker: actor('Actor.attacker'),
		targets: [{ tokenUuid: TOKEN, actor: actor('Actor.target') }],
		delivery: 'melee',
		outcome: null,
		forcedMiss: false,
		...overrides,
	};
}

describe('collectRerollEntries', () => {
	beforeEach(() => setToggles({}));
	afterEach(() => {
		delete testGlobals.game.settings;
	});

	it('builds a button entry per rule that offers on this side', () => {
		const rule = rerollRule({ usedBy: 'roller', outcome: 'miss' });
		const { manual, automatic } = collectRerollEntries(
			context({ attacker: actor('Actor.hero', [rule]) }),
		);

		expect(automatic).toEqual([]);
		expect(manual).toEqual([
			expect.objectContaining({
				kind: 'reroll',
				source: 'rule',
				actorUuid: 'Actor.hero',
				tokenUuid: null,
				targetTokenUuid: null,
				side: 'roller',
				label: 'Pocket Sand',
				ruleId: 'rule-1',
				itemUuid: 'Item.sand',
				used: false,
				outcomeTrigger: 'miss',
			}),
		]);
		expect(rule.offersRerollOn).toHaveBeenCalledWith({ side: 'roller', delivery: 'melee' });
	});

	it('stamps the once-per-attack flag of the rule on its entry', () => {
		const once = rerollRule({ id: 'once', usedBy: 'roller', oncePerAttack: true });
		const again = rerollRule({ id: 'again', usedBy: 'roller' });
		const { manual } = collectRerollEntries(
			context({ attacker: actor('Actor.hero', [once, again]) }),
		);
		expect(manual.map((entry) => entry.oncePerAttack)).toEqual([true, false]);
	});

	it('ties a target entry to the attack target token', () => {
		const rule = rerollRule();
		const { manual } = collectRerollEntries(
			context({ targets: [{ tokenUuid: TOKEN, actor: actor('Actor.t', [rule]) }] }),
		);
		expect(manual[0]).toMatchObject({
			side: 'target',
			targetTokenUuid: TOKEN,
			actorUuid: 'Actor.t',
		});
		expect(rule.offersRerollOn).toHaveBeenCalledWith({ side: 'target', delivery: 'melee' });
	});

	type Case = [string, Partial<RerollRollContext>, RerollTrigger, string[]];
	const rollerRule = rerollRule({ id: 'roller', usedBy: 'roller' });
	const targetRule = rerollRule({ id: 'target' });
	const both = (rules: { roller?: RerollRuleLike[]; target?: RerollRuleLike[] }) => ({
		attacker: actor('Actor.attacker', rules.roller ?? []),
		targets: [{ tokenUuid: TOKEN, actor: actor('Actor.target', rules.target ?? []) }],
	});

	it.each<Case>([
		[
			'offers each side its own rules',
			both({ roller: [rollerRule], target: [targetRule] }),
			'always',
			['roller', 'target'],
		],
		[
			'offers nothing on a forced miss',
			{ ...both({ roller: [rollerRule], target: [targetRule] }), forcedMiss: true },
			'always',
			[],
		],
		[
			'does not offer a rule to the other side',
			both({ roller: [targetRule], target: [rollerRule] }),
			'always',
			[],
		],
		[
			'offers before the roll whatever the outcome it names',
			{ ...both({ target: [targetRule] }), outcome: null },
			'criticalHit',
			['target'],
		],
		[
			'offers on a roll that matches the outcome',
			{ ...both({ target: [targetRule] }), outcome: CRIT },
			'criticalHit',
			['target'],
		],
		[
			'does not offer on a roll that does not match the outcome',
			{ ...both({ target: [targetRule] }), outcome: HIT },
			'criticalHit',
			[],
		],
		[
			'offers a miss rule on a miss',
			{ ...both({ target: [targetRule] }), outcome: MISS },
			'miss',
			['target'],
		],
		[
			'takes rules from the first target only',
			{
				targets: [
					{ tokenUuid: OTHER_TOKEN, actor: actor('Actor.other') },
					{ tokenUuid: TOKEN, actor: actor('Actor.target', [targetRule]) },
				],
			},
			'always',
			[],
		],
		[
			'offers nothing without a target',
			{ attacker: actor('Actor.attacker'), targets: [] },
			'always',
			[],
		],
	])('%s', (_name, overrides, outcome, expected) => {
		for (const rule of [rollerRule, targetRule]) rule.outcome = outcome;
		const { manual } = collectRerollEntries(context(overrides));
		expect(manual.map((entry) => entry.ruleId)).toEqual(expected);
	});

	it('skips rules that do not offer, and rules of another type', () => {
		const { manual } = collectRerollEntries(
			context({
				attacker: actor('Actor.hero', [
					rerollRule({ usedBy: 'roller', offersRerollOn: () => false }),
					{ type: 'modifyIncomingAttack' },
				]),
			}),
		);
		expect(manual).toEqual([]);
	});

	it('gives two rules two entries', () => {
		const { manual } = collectRerollEntries(
			context({
				attacker: actor('Actor.hero', [
					rerollRule({ id: 'a', usedBy: 'roller' }),
					rerollRule({ id: 'b', usedBy: 'roller' }),
				]),
			}),
		);
		expect(manual.map((entry) => entry.ruleId)).toEqual(['a', 'b']);
		expect(new Set(manual.map((entry) => entry.id)).size).toBe(2);
	});

	it('returns nothing for a missing actor or an actor without a uuid', () => {
		const rule = rerollRule({ usedBy: 'roller' });
		expect(collectRerollEntries(context({ attacker: null })).manual).toEqual([]);
		expect(collectRerollEntries(context({ attacker: { rules: [rule] } })).manual).toEqual([]);
	});

	function targetOnly(rule: RerollRuleLike, extra: Partial<RerollingActor> = {}) {
		return context({ targets: [{ tokenUuid: TOKEN, actor: actor('Actor.t', [rule], extra) }] });
	}

	it('rerolls by itself when the rule is automatic and Feature Effects is on', () => {
		const rule = rerollRule({ automatic: true });
		const { manual, automatic } = collectRerollEntries(targetOnly(rule));
		expect(manual).toEqual([]);
		expect(automatic).toHaveLength(1);
		expect(automatic[0]?.rule).toBe(rule);
	});

	it('shows an automatic rule as a button while Feature Effects is off', () => {
		setToggles({ 'automation.applyRuleEffects': false });
		const { manual, automatic } = collectRerollEntries(targetOnly(rerollRule({ automatic: true })));
		expect(automatic).toEqual([]);
		expect(manual).toHaveLength(1);
	});

	it('shows an automatic rule with a cost as a button for a client that cannot pay it', () => {
		const rule = rerollRule({
			automatic: true,
			rerollCost: { ...FREE, chargePoolIdentifier: 'sand' },
		});
		const notOwner = collectRerollEntries(targetOnly(rule, { isOwner: false }));
		const owner = collectRerollEntries(targetOnly(rule, { isOwner: true }));

		expect(notOwner.manual).toHaveLength(1);
		expect(owner.automatic).toHaveLength(1);
	});

	it('lets any client roll an automatic rule whose cost charges nothing', () => {
		setToggles({ 'automation.resourceSpending': false });
		const rule = rerollRule({ automatic: true, rerollCost: { ...FREE, woundCost: 1 } });
		const { automatic } = collectRerollEntries(targetOnly(rule, { isOwner: false }));
		expect(automatic).toHaveLength(1);
	});
});

describe('offerStands', () => {
	const entry = (outcomeTrigger: RerollTrigger | null | undefined) =>
		({ kind: 'reroll', outcomeTrigger }) as IncomingReactionEntry;

	it.each<[RerollTrigger | null | undefined, boolean, boolean, boolean]>([
		['always', true, true, true],
		[null, true, true, true],
		[undefined, true, true, true],
		['hit', true, true, false],
		['criticalHit', true, false, false],
		['nonCriticalHit', false, true, false],
		['miss', false, false, true],
	])('a %s reroll entry stands on crit %s, hit %s, miss %s', (trigger, onCrit, onHit, onMiss) => {
		const stands = (outcome: typeof HIT) =>
			offerStands(entry(trigger), { outcome, forcedMiss: false });
		expect([stands(CRIT), stands(HIT), stands(MISS)]).toEqual([onCrit, onHit, onMiss]);
	});

	it('stands before the roll is made', () => {
		expect(offerStands(entry('criticalHit'), { outcome: null, forcedMiss: false })).toBe(true);
		const spend = { kind: 'spendPoolForDamage', outcomeTrigger: 'criticalHit' };
		expect(offerStands(spend as IncomingReactionEntry, { outcome: null, forcedMiss: false })).toBe(
			true,
		);
	});

	it('never lets a reroll entry stand on a forced miss', () => {
		expect(offerStands(entry('miss'), { outcome: MISS, forcedMiss: true })).toBe(false);
		expect(offerStands(entry('always'), { outcome: null, forcedMiss: true })).toBe(false);
	});

	it('checks other kinds against the outcome only, also on a forced miss', () => {
		const spend = { kind: 'spendPoolForDamage', outcomeTrigger: 'miss' } as IncomingReactionEntry;
		expect(offerStands(spend, { outcome: MISS, forcedMiss: true })).toBe(true);
		expect(offerStands(spend, { outcome: HIT, forcedMiss: false })).toBe(false);
	});

	it('always lets an offer with no trigger stand', () => {
		const interpose = { kind: 'redirectToSelf' } as IncomingReactionEntry;
		expect(offerStands(interpose, { outcome: MISS, forcedMiss: true })).toBe(true);
	});
});

function stamped(overrides: Partial<IncomingReactionEntry> = {}): IncomingReactionEntry {
	return {
		id: foundry.utils.randomID(),
		kind: 'reroll',
		source: 'rule',
		actorUuid: 'Actor.hero',
		tokenUuid: null,
		targetTokenUuid: null,
		side: 'roller',
		label: 'Pocket Sand',
		ruleId: 'rule-1',
		itemUuid: 'Item.sand',
		used: false,
		outcomeTrigger: 'always',
		...overrides,
	};
}

describe('rerollRuleKey', () => {
	it('is the same for two entries of one rule on one actor', () => {
		expect(rerollRuleKey(stamped({ id: 'a', used: true }))).toBe(
			rerollRuleKey(stamped({ id: 'b', side: 'target' })),
		);
	});

	it('differs by actor, item and rule', () => {
		const key = rerollRuleKey(stamped());
		expect(rerollRuleKey(stamped({ actorUuid: 'Actor.other' }))).not.toBe(key);
		expect(rerollRuleKey(stamped({ itemUuid: 'Item.other' }))).not.toBe(key);
		expect(rerollRuleKey(stamped({ ruleId: 'rule-2' }))).not.toBe(key);
	});
});

describe('withNewRerollEntries', () => {
	it('does not add a rule that already has an entry waiting', () => {
		const waiting = stamped({ id: 'waiting' });
		const result = withNewRerollEntries([waiting], [stamped({ id: 'new' })]);
		expect(result.map((entry) => entry.id)).toEqual(['waiting']);
	});

	it('adds a new entry for a rule whose earlier entry was used', () => {
		const used = stamped({ id: 'used', used: true });
		const result = withNewRerollEntries([used], [stamped({ id: 'new' })]);
		expect(result.map((entry) => entry.id)).toEqual(['used', 'new']);
	});

	it('adds an entry for another rule, and ignores entries of other kinds', () => {
		const spend = stamped({ id: 'spend', kind: 'spendPoolForDamage' });
		const result = withNewRerollEntries([spend], [stamped({ id: 'new' })]);
		expect(result.map((entry) => entry.id)).toEqual(['spend', 'new']);
	});

	it('adds no new entry for a once-per-attack rule whose entry was used', () => {
		const used = stamped({ id: 'used', used: true, oncePerAttack: true });
		const result = withNewRerollEntries([used], [stamped({ id: 'new', oncePerAttack: true })]);
		expect(result.map((entry) => entry.id)).toEqual(['used']);
	});

	it('reads the flag from the new entry, so the live rule decides', () => {
		const used = stamped({ id: 'used', used: true });
		const result = withNewRerollEntries([used], [stamped({ id: 'new', oncePerAttack: true })]);
		expect(result.map((entry) => entry.id)).toEqual(['used']);
	});

	it('still adds a new entry for a used rule with once per attack off', () => {
		const used = stamped({ id: 'used', used: true, oncePerAttack: true });
		const result = withNewRerollEntries([used], [stamped({ id: 'new', oncePerAttack: false })]);
		expect(result.map((entry) => entry.id)).toEqual(['used', 'new']);
	});

	it('does not stop another rule when a once-per-attack rule was used', () => {
		const used = stamped({ id: 'used', used: true, oncePerAttack: true });
		const other = stamped({ id: 'other', ruleId: 'rule-2', oncePerAttack: true });
		const result = withNewRerollEntries([used], [other]);
		expect(result.map((entry) => entry.id)).toEqual(['used', 'other']);
	});
});

describe('nextAutomaticReroll', () => {
	const automatic = (overrides: Partial<IncomingReactionEntry>): AutomaticReroll => ({
		entry: stamped(overrides),
		rule: rerollRule({ automatic: true }),
	});
	const onMiss = automatic({ ruleId: 'on-miss', outcomeTrigger: 'miss' });
	const onCrit = automatic({ ruleId: 'on-crit', outcomeTrigger: 'criticalHit' });
	const roll = (outcome: typeof HIT, forcedMiss = false) => ({ outcome, forcedMiss });

	it('gives the first one that stands for the roll', () => {
		expect(nextAutomaticReroll([onMiss, onCrit], [], roll(CRIT))).toBe(onCrit);
		expect(nextAutomaticReroll([onMiss, onCrit], [], roll(MISS))).toBe(onMiss);
		expect(nextAutomaticReroll([onMiss, onCrit], [], roll(HIT))).toBeNull();
	});

	it('skips a rule that already has a used entry on the card', () => {
		const card = [{ ...onMiss.entry, id: 'earlier', used: true }];
		expect(nextAutomaticReroll([onMiss], card, roll(MISS))).toBeNull();
	});

	it('skips a rule that already has a waiting entry on the card', () => {
		const card = [{ ...onMiss.entry, id: 'button' }];
		expect(nextAutomaticReroll([onMiss], card, roll(MISS))).toBeNull();
	});

	it('runs nothing on a forced miss', () => {
		expect(nextAutomaticReroll([onMiss], [], roll(MISS, true))).toBeNull();
	});
});

describe('usableRerollEntry', () => {
	const attacker = actor('Actor.attacker');
	const target = actor('Actor.target');
	let rule: ReturnType<typeof rerollRule>;

	function useWorld(live: RerollRuleLike | null = rule): void {
		const byUuid: Record<string, unknown> = {
			'Actor.attacker': attacker,
			'Actor.target': target,
			'Item.sand': live ? { rules: new Map([[live.id ?? '', live]]) } : null,
		};
		testGlobals.fromUuidSync = vi.fn((uuid: string) => byUuid[uuid] ?? null);
	}

	function entry(overrides: Partial<IncomingReactionEntry> = {}): IncomingReactionEntry {
		return {
			id: 'entry-1',
			kind: 'reroll',
			source: 'rule',
			actorUuid: 'Actor.target',
			tokenUuid: null,
			targetTokenUuid: TOKEN,
			side: 'target',
			label: 'Pocket Sand',
			ruleId: 'rule-1',
			itemUuid: 'Item.sand',
			used: false,
			outcomeTrigger: 'always',
			...overrides,
		};
	}

	const roller = { actorUuid: 'Actor.attacker', targetTokenUuid: null, side: 'roller' as const };
	const card = (overrides: Partial<RerollRollContext> = {}) =>
		context({
			attacker,
			targets: [{ tokenUuid: TOKEN, actor: target }],
			outcome: HIT,
			...overrides,
		});

	beforeEach(() => {
		rule = rerollRule();
		useWorld();
	});

	afterEach(() => {
		testGlobals.fromUuidSync = vi.fn();
	});

	it('gives the live rule and actor for an entry that can be used', () => {
		expect(usableRerollEntry(entry(), card(), [])).toEqual({ ok: true, rule, actor: target });
		expect(rule.offersRerollOn).toHaveBeenCalledWith({ side: 'target', delivery: 'melee' });
	});

	it('lets the attacker use a roller entry', () => {
		rule = rerollRule({ usedBy: 'roller' });
		useWorld();
		expect(usableRerollEntry(entry(roller), card(), [])).toMatchObject({
			ok: true,
			actor: attacker,
		});
	});

	it('lets a target entry be used while its token is any of the targets', () => {
		const targets = [
			{ tokenUuid: OTHER_TOKEN, actor: actor('Actor.other') },
			{ tokenUuid: TOKEN, actor: target },
		];
		expect(usableRerollEntry(entry(), card({ targets }), [])).toMatchObject({ ok: true });
	});

	type Refusal = [string, () => IncomingReactionEntry, () => RerollRollContext, string];
	it.each<Refusal>([
		['an entry with no side', () => entry({ side: undefined }), () => card(), 'unavailable'],
		[
			'a roller entry of anyone but the attacker',
			() => entry({ ...roller, actorUuid: 'Actor.target' }),
			() => card(),
			'unavailable',
		],
		[
			'a target entry once its token is no longer a target',
			() => entry(),
			() => card({ targets: [{ tokenUuid: OTHER_TOKEN, actor: target }] }),
			'unavailable',
		],
		[
			'a target entry whose token now holds another actor',
			() => entry(),
			() => card({ targets: [{ tokenUuid: TOKEN, actor: attacker }] }),
			'unavailable',
		],
		[
			'an entry the rule no longer offers, such as an empty pool',
			() => {
				vi.mocked(rule.offersRerollOn).mockReturnValue(false);
				return entry();
			},
			() => card(),
			'unavailable',
		],
		[
			'an entry for another side than the rule is used by',
			() => entry({ side: 'roller', actorUuid: 'Actor.attacker', targetTokenUuid: null }),
			() => card(),
			'unavailable',
		],
		[
			'an entry whose rule outcome the card no longer matches',
			() => {
				rule.outcome = 'criticalHit';
				return entry();
			},
			() => card({ outcome: HIT }),
			'unavailable',
		],
		[
			'an outcome mismatch on a forced miss',
			() => {
				rule.outcome = 'criticalHit';
				return entry();
			},
			() => card({ outcome: MISS, forcedMiss: true }),
			'unavailable',
		],
		[
			'an entry on a forced miss',
			() => entry(),
			() => card({ outcome: MISS, forcedMiss: true }),
			'forcedMiss',
		],
		[
			'an entry whose rule is gone',
			() => {
				useWorld(null);
				return entry();
			},
			() => card(),
			'unavailable',
		],
		[
			'an entry whose rule is disabled',
			() => {
				useWorld({ ...rule, disabled: true });
				return entry();
			},
			() => card(),
			'unavailable',
		],
		[
			'an entry whose actor is gone',
			() => entry({ actorUuid: 'Actor.gone' }),
			() => card(),
			'unavailable',
		],
	])('refuses %s', (_name, makeEntry, makeContext, reason) => {
		const stamped = makeEntry();
		expect(usableRerollEntry(stamped, makeContext(), [stamped])).toEqual({ ok: false, reason });
	});

	describe('once per attack', () => {
		const usedBefore = () => entry({ id: 'entry-0', used: true });

		it('refuses a waiting entry when its live rule is once per attack and was used', () => {
			rule = rerollRule({ oncePerAttack: true });
			useWorld();
			const waiting = entry({ oncePerAttack: false });
			expect(usableRerollEntry(waiting, card(), [usedBefore(), waiting])).toEqual({
				ok: false,
				reason: 'unavailable',
			});
		});

		it('lets the entry be used when the live rule is no longer once per attack', () => {
			const waiting = entry({ oncePerAttack: true });
			expect(usableRerollEntry(waiting, card(), [usedBefore(), waiting])).toMatchObject({
				ok: true,
			});
		});

		it('lets the entry be used when no entry of the same rule was used', () => {
			rule = rerollRule({ oncePerAttack: true });
			useWorld();
			const waiting = entry();
			const otherRule = entry({ id: 'entry-0', used: true, ruleId: 'rule-2' });
			const otherActor = entry({ id: 'entry-x', used: true, actorUuid: 'Actor.other' });
			expect(usableRerollEntry(waiting, card(), [otherRule, otherActor, waiting])).toMatchObject({
				ok: true,
			});
		});

		it('lets the first entry of a once per attack rule be used', () => {
			rule = rerollRule({ oncePerAttack: true });
			useWorld();
			const waiting = entry();
			expect(usableRerollEntry(waiting, card(), [waiting])).toMatchObject({ ok: true });
		});
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
