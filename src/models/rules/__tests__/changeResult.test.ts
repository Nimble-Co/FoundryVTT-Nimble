import { afterEach, describe, expect, it, vi } from 'vitest';
import { Predicate } from '../../../etc/Predicate.js';
import type {
	ResultCardView,
	ResultChange,
} from '../../../utils/incomingReactions/incomingReactionEntry.js';
import { ChangeResultRule } from '../changeResult.js';

type FieldLike = {
	initial?: unknown;
	choices?: Record<string, string>;
	element?: { choices?: Record<string, string> };
	options?: { label?: string; showWhen?: (data: Record<string, unknown>) => boolean };
};

const schema = ChangeResultRule.defineSchema() as unknown as Record<string, FieldLike>;
const SAVE = { kind: 'save', key: 'will' } as const;
const roller = { getRollData: () => ({ strength: 3, intelligence: 2 }) };

function makeRule(
	config: Record<string, unknown> = {},
	itemOverrides: Record<string, unknown> = {},
) {
	const actor = {
		uuid: 'Actor.hero',
		getDomain: () => new Set<string>(),
		getFlag: () => undefined,
		system: { attributes: { wounds: { value: 0, max: 6 } } },
	};
	const item = {
		isEmbedded: true,
		actor,
		name: 'Elusive',
		uuid: 'Actor.hero.Item.elusive',
		getDomain: () => new Set<string>(),
		...itemOverrides,
	};
	const rule = new ChangeResultRule({ type: 'changeResult' } as never, {
		parent: item as unknown as foundry.abstract.DataModel.Any,
		strict: false,
	});
	Object.assign(rule, {
		id: 'rule-1',
		disabled: false,
		rolls: ['save'],
		saves: [],
		skills: [],
		abilities: [],
		usedBy: 'roller',
		otherCreature: new Predicate({}),
		predicate: new Predicate({}),
		chargePoolIdentifier: '',
		chargeCost: 1,
		manaCost: 0,
		woundCost: 0,
		heroicReaction: '',
		actionCost: 0,
		change: 'succeed',
		formula: '',
		onlyIfLower: false,
		outcome: 'failed',
		...config,
	});
	Object.defineProperty(rule, 'item', { get: () => item, configurable: true });
	return rule;
}

function card(total: number, changes: Partial<ResultChange>[] = []): ResultCardView {
	return { total, changes: changes as ResultChange[], roller };
}

function offered(rule: ChangeResultRule, view?: ResultCardView): boolean {
	return rule.offersUseOn({ side: 'roller', roll: SAVE, ...(view ? { card: view } : {}) });
}

describe('ChangeResultRule fields', () => {
	it('defines its own fields with their defaults', () => {
		expect(schema.type?.initial).toBe('changeResult');
		expect(schema.change?.initial).toBe('succeed');
		expect(schema.formula?.initial).toBe('');
		expect(schema.onlyIfLower?.initial).toBe(false);
		expect(Object.keys(schema.change?.choices ?? {})).toEqual([
			'succeed',
			'setTotal',
			'add',
			'noDamage',
			'countsAsNat20',
		]);
	});

	it('lists only the rolls it works on, and starts on a save', () => {
		expect(schema.rolls?.initial).toEqual(['save']);
		expect(Object.keys(schema.rolls?.element?.choices ?? {})).toEqual([
			'save',
			'skillCheck',
			'abilityCheck',
			'initiative',
			'attack',
		]);
		expect(schema.rolls?.element?.choices?.initiative).toBe(
			'NIMBLE.rules.changeResult.rolls.choices.initiative',
		);
	});

	it('asks for the formula only to set or add', () => {
		const showWhen = schema.formula?.options?.showWhen;
		expect(showWhen?.({ change: 'succeed' })).toBe(false);
		expect(showWhen?.({ change: 'setTotal' })).toBe(true);
		expect(showWhen?.({ change: 'add' })).toBe(true);
	});

	it('asks "only if lower" only for a set', () => {
		const showWhen = schema.onlyIfLower?.options?.showWhen;
		expect(showWhen?.({ change: 'setTotal' })).toBe(true);
		expect(showWhen?.({ change: 'add' })).toBe(false);
	});

	it('uses its own words where the Reroll words say reroll', () => {
		expect(schema.rolls?.options?.label).toBe('NIMBLE.rules.changeResult.rolls.label');
		expect(schema.usedBy?.options?.label).toBe('NIMBLE.rules.reroll.usedBy.label');
	});
});

describe('ChangeResultRule#offersUseOn', () => {
	it('offers on a roll it covers', () => {
		expect(offered(makeRule())).toBe(true);
	});

	it('does not offer on an item that is not embedded', () => {
		expect(offered(makeRule({}, { isEmbedded: false }))).toBe(false);
	});

	it('does not offer when disabled', () => {
		expect(offered(makeRule({ disabled: true }))).toBe(false);
	});

	it('does not offer when its predicate fails', () => {
		const rule = makeRule({ predicate: new Predicate({ armor: 'unarmored' }) });
		expect(offered(rule)).toBe(false);
	});

	it('does not offer on an attack, whatever is stored', () => {
		const rule = makeRule({ rolls: ['attack', 'save'] });
		expect(rule.offersUseOn({ side: 'roller', roll: { kind: 'attack', delivery: 'melee' } })).toBe(
			false,
		);
		expect(offered(rule)).toBe(true);
	});

	it('honours the save keys', () => {
		expect(offered(makeRule({ saves: ['strength'] }))).toBe(false);
		expect(offered(makeRule({ saves: ['will'] }))).toBe(true);
	});

	it('hides a succeed while its own stands, and only its own', () => {
		const own = {
			change: 'succeed' as const,
			ruleId: 'rule-1',
			itemUuid: 'Actor.hero.Item.elusive',
		};
		const rule = makeRule();
		expect(offered(rule, card(7))).toBe(true);
		expect(offered(rule, card(7, [{ ...own, retired: false }]))).toBe(false);
		expect(offered(rule, card(7, [{ ...own, retired: true }]))).toBe(true);
		expect(offered(rule, card(7, [{ ...own, retired: false, ruleId: 'other' }]))).toBe(true);
	});

	it('shows a set with "only if lower" only below the value', () => {
		const rule = makeRule({ change: 'setTotal', formula: '10', onlyIfLower: true });
		expect(offered(rule, card(9))).toBe(true);
		expect(offered(rule, card(10))).toBe(false);
		expect(offered(rule, card(11))).toBe(false);
	});

	it('shows a set with no "only if lower" above or below the value, not at it', () => {
		const rule = makeRule({ change: 'setTotal', formula: '10' });
		expect(offered(rule, card(15))).toBe(true);
		expect(offered(rule, card(7))).toBe(true);
		expect(offered(rule, card(10))).toBe(false);
	});

	it('keeps an add at any total', () => {
		const rule = makeRule({ change: 'add', formula: '@strength' });
		expect(offered(rule, card(30, [{ change: 'add', ruleId: 'rule-1' }]))).toBe(true);
	});

	it('shows no row for a set or an add with no formula', () => {
		expect(offered(makeRule({ change: 'add' }), card(7))).toBe(false);
		expect(offered(makeRule({ change: 'setTotal', formula: '  ' }), card(7))).toBe(false);
	});

	it('stamps an entry with no card to read, so a row can come back later', () => {
		const rule = makeRule({ change: 'setTotal', formula: '10', onlyIfLower: true });
		expect(offered(rule)).toBe(true);
	});

	it('does not offer a Wound the actor has no room for, and offers the last one', () => {
		const rule = makeRule({ change: 'add', formula: '@strength', woundCost: 1 });
		const { wounds } = (
			rule.item.actor as unknown as { system: { attributes: { wounds: { value: number } } } }
		).system.attributes;
		wounds.value = 5;
		expect(offered(rule, card(7))).toBe(true);
		wounds.value = 6;
		expect(offered(rule, card(7))).toBe(false);
	});
});

describe('ChangeResultRule#resultUseFor', () => {
	it('reads the formula against the one who rolled', () => {
		const rule = makeRule({ change: 'setTotal', formula: '10+@intelligence' });
		expect(rule.resultUseFor(roller)).toEqual({ change: 'setTotal', value: 12, stat: '' });
	});

	it('names the stat when the formula is one stat', () => {
		const rule = makeRule({ change: 'add', formula: '@strength' });
		expect(rule.resultUseFor(roller)).toEqual({ change: 'add', value: 3, stat: 'strength' });
	});

	it('names no stat for a formula that is more than one stat, or for another key', () => {
		expect(makeRule({ change: 'add', formula: '@strength+1' }).resultUseFor(roller)?.stat).toBe('');
		expect(makeRule({ change: 'add', formula: '@level' }).resultUseFor(roller)?.stat).toBe('');
	});

	it('keeps a negative value', () => {
		const rule = makeRule({ change: 'add', formula: '@strength' });
		expect(rule.resultUseFor({ getRollData: () => ({ strength: -1 }) })?.value).toBe(-1);
	});

	it('gives no use, and draws on, when a formula cannot be worked out', () => {
		const rule = makeRule({ change: 'add', formula: '@strength' });
		const evaluate = vi.spyOn(Roll.prototype, 'evaluateSync').mockImplementation(() => {
			throw new Error('Unresolved term');
		});
		expect(rule.resultUseFor(roller)).toBeNull();
		expect(offered(rule, card(7))).toBe(false);
		evaluate.mockRestore();
	});

	it('needs no formula for a succeed', () => {
		expect(makeRule().resultUseFor(null)).toEqual({ change: 'succeed', value: 0, stat: '' });
	});

	it('lets two rules of one item stack, each with its own value', () => {
		const add = makeRule({ id: 'a', change: 'add', formula: '@strength' });
		const more = makeRule({ id: 'b', change: 'add', formula: '2' });
		expect(add.resultUseFor(roller)?.value).toBe(3);
		expect(more.resultUseFor(roller)?.value).toBe(2);
	});
});

describe('ChangeResultRule on Initiative', () => {
	const INITIATIVE = { kind: 'initiative', key: '' } as const;
	const offers = (config: Record<string, unknown>, total?: number) =>
		makeRule({ rolls: ['initiative'], ...config }).offersUseOn({
			side: 'roller',
			roll: INITIATIVE,
			...(total === undefined ? {} : { card: card(total) }),
		});
	const setTen = { change: 'setTotal', formula: '10', onlyIfLower: true };

	it('shows a set total only below its value when it has onlyIfLower', () => {
		expect(offers(setTen)).toBe(true);
		expect(offers(setTen, 7)).toBe(true);
		expect(offers(setTen, 10)).toBe(false);
		expect(offers(setTen, 14)).toBe(false);
	});

	it('does not show on Initiative unless the rule names it', () => {
		expect(
			makeRule({ ...setTen, rolls: ['save'] }).offersUseOn({ side: 'roller', roll: INITIATIVE }),
		).toBe(false);
	});

	it('does not offer a succeed, since Initiative has no result', () => {
		expect(offers({ change: 'succeed' })).toBe(false);
		expect(offers({ change: 'succeed' }, 7)).toBe(false);
	});
});

describe('ChangeResultRule outcome', () => {
	const said = (result: 'failed' | 'succeeded' | null): ResultCardView => ({
		...card(7),
		result,
	});

	it('defaults to a failed roll, and asks only for a succeed or an add', () => {
		expect(schema.outcome?.initial).toBe('failed');
		expect(Object.keys(schema.outcome?.choices ?? {})).toEqual(['failed', 'always']);
		const shows = schema.outcome?.options?.showWhen;
		expect(shows?.({ change: 'succeed' })).toBe(true);
		expect(shows?.({ change: 'add' })).toBe(true);
		expect(shows?.({ change: 'setTotal' })).toBe(false);
	});

	it.each(['succeed', 'add'])(
		'%s hides on a card that says Succeeded, and shows else',
		(change) => {
			const rule = makeRule({ change, formula: '@strength' });
			expect(offered(rule, said('succeeded'))).toBe(false);
			expect(offered(rule, said('failed'))).toBe(true);
			expect(offered(rule, said(null))).toBe(true);
		},
	);

	it('a rule set to any result shows on a card that says Succeeded', () => {
		expect(offered(makeRule({ outcome: 'always' }), said('succeeded'))).toBe(true);
	});

	it('a set total keeps showing, whatever the card says', () => {
		const rule = makeRule({
			change: 'setTotal',
			formula: '10+@intelligence',
			rolls: ['skillCheck'],
		});
		const view = said('succeeded');
		expect(
			rule.offersUseOn({ side: 'roller', roll: { kind: 'skillCheck', key: 'might' }, card: view }),
		).toBe(true);
	});
});

describe('ChangeResultRule relatedStat', () => {
	it('limits a rule to the rolls of that stat', () => {
		const rule = makeRule({ relatedStat: 'will', rolls: ['save', 'skillCheck'] });
		expect(rule.offersUseOn({ side: 'roller', roll: SAVE })).toBe(true);
		expect(rule.offersUseOn({ side: 'roller', roll: { kind: 'save', key: 'strength' } })).toBe(
			false,
		);
		expect(rule.offersUseOn({ side: 'roller', roll: { kind: 'skillCheck', key: 'insight' } })).toBe(
			true,
		);
		expect(rule.offersUseOn({ side: 'roller', roll: { kind: 'skillCheck', key: 'might' } })).toBe(
			false,
		);
	});
});

describe('ChangeResultRule noDamage', () => {
	const attack = { kind: 'attack', delivery: 'melee' } as const;
	const noDamage = (config: Record<string, unknown> = {}) =>
		makeRule({ change: 'noDamage', rolls: ['attack'], usedBy: 'target', ...config });
	const onTarget = (rule: ChangeResultRule, view?: ResultCardView) =>
		rule.offersUseOn({
			side: 'target',
			roll: attack,
			targetTokenUuid: 'Token.a',
			...(view ? { card: view } : {}),
		});

	it('is for the target, on an attack, and needs a hit', () => {
		expect(onTarget(noDamage())).toBe(true);
		expect(noDamage().attackTrigger).toBe('hit');
		expect(noDamage({ usedBy: 'roller' }).offersUseOn({ side: 'roller', roll: attack })).toBe(
			false,
		);
		expect(noDamage({ rolls: ['save'] }).offersUseOn({ side: 'target', roll: attack })).toBe(false);
	});

	it('goes away while a change covers this target, and stays for another target', () => {
		const here = { change: 'noDamage' as const, targetTokenUuid: 'Token.a', retired: false };
		const there = { change: 'noDamage' as const, targetTokenUuid: 'Token.b', retired: false };
		expect(onTarget(noDamage(), card(0, [here]))).toBe(false);
		expect(onTarget(noDamage(), card(0, [there]))).toBe(true);
	});

	it('goes away once the damage is applied', () => {
		expect(onTarget(noDamage(), { ...card(0), damageApplied: true })).toBe(false);
	});

	it('is only for an attack: other changes stay off attacks', () => {
		const rule = makeRule({ change: 'succeed', rolls: ['attack', 'save'], usedBy: 'target' });
		expect(rule.offersUseOn({ side: 'target', roll: attack })).toBe(false);
	});

	it('does no sum of its own', () => {
		expect(noDamage().resultUseFor(roller)).toEqual({ change: 'noDamage', value: 0, stat: '' });
	});
});

describe('ChangeResultRule countsAsNat20', () => {
	const nat20 = (config: Record<string, unknown> = {}) =>
		makeRule({
			change: 'countsAsNat20',
			rolls: ['save', 'skillCheck'],
			relatedStat: 'will',
			...config,
		});

	function setEffects(on: boolean) {
		(globalThis as unknown as { game: { settings: unknown } }).game.settings = {
			get: () => on,
		};
	}

	afterEach(() => setEffects(true));

	it('with Feature Effects on, it happens by itself: no row, no cost', () => {
		setEffects(true);
		const rule = nat20({ woundCost: 9 });
		expect(offered(rule)).toBe(false);
		expect(rule.countsAsNat20On(SAVE)).toBe(true);
	});

	it('is limited by its stat and to saves and skill checks', () => {
		setEffects(true);
		const rule = nat20({ rolls: ['save', 'skillCheck', 'abilityCheck', 'initiative'] });
		expect(rule.countsAsNat20On({ kind: 'save', key: 'strength' })).toBe(false);
		expect(rule.countsAsNat20On({ kind: 'skillCheck', key: 'insight' })).toBe(true);
		expect(rule.countsAsNat20On({ kind: 'abilityCheck', key: 'will' })).toBe(false);
		expect(rule.countsAsNat20On({ kind: 'initiative', key: '' })).toBe(false);
	});

	it('with Feature Effects off, it is a row while the total is 1 or less', () => {
		setEffects(false);
		const rule = nat20();
		expect(offered(rule)).toBe(true);
		expect(offered(rule, card(1))).toBe(true);
		expect(offered(rule, card(2))).toBe(false);
		const stands = { change: 'countsAsNat20' as const, retired: false };
		expect(offered(rule, card(1, [stands]))).toBe(false);
	});

	it('works out 20 plus the modifier of the roll', () => {
		setEffects(false);
		const view = { ...card(1), rollModifier: -1 };
		expect(nat20().resultUseFor(roller, view)).toEqual({
			change: 'countsAsNat20',
			value: 19,
			stat: '',
		});
	});
});
