import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Predicate } from '../../../etc/Predicate.js';
import { ChangeResultRule } from '../../../models/rules/changeResult.js';
import { assessSucceeds } from '../assessResult.js';

const gameGlobal = globalThis as unknown as { game: { settings?: unknown } };

function d20Roll(total: number, d20: number) {
	return { total, terms: [{ faces: 20, results: [{ result: d20, active: true }] }] };
}

function bumblewiseRule() {
	const actor = {
		uuid: 'Actor.hero',
		getDomain: () => new Set<string>(),
		getFlag: () => undefined,
		system: { attributes: { wounds: { value: 0, max: 6 } } },
	};
	const item = {
		isEmbedded: true,
		actor,
		name: 'Bumblewise',
		uuid: 'Actor.hero.Item.bumblewise',
		getDomain: () => new Set<string>(),
	};
	const rule = new ChangeResultRule({ type: 'changeResult' } as never, {
		parent: item as unknown as foundry.abstract.DataModel.Any,
		strict: false,
	});
	Object.assign(rule, {
		id: 'rule-1',
		disabled: false,
		rolls: ['save', 'skillCheck'],
		saves: [],
		skills: [],
		abilities: [],
		usedBy: 'roller',
		relatedStat: 'will',
		otherCreature: new Predicate({}),
		predicate: new Predicate({}),
		change: 'countsAsNat20',
		formula: '',
		onlyIfLower: false,
		outcome: 'always',
	});
	Object.defineProperty(rule, 'item', { get: () => item, configurable: true });
	return rule;
}

describe('assessSucceeds', () => {
	let settings: unknown;

	beforeEach(() => {
		settings = gameGlobal.game.settings;
		gameGlobal.game.settings = { get: () => true };
	});

	afterEach(() => {
		gameGlobal.game.settings = settings;
	});

	const bumblewiseHero = () => ({ uuid: 'Actor.hero', rules: [bumblewiseRule()] });

	it('succeeds on a natural 1 on an Insight Assess with a rule that counts it as a natural 20', () => {
		expect(assessSucceeds(d20Roll(-1, 1), bumblewiseHero(), 'insight')).toBe(true);
	});

	it('fails on a natural 1 with a total of 13 on a skill the rule does not cover', () => {
		expect(assessSucceeds(d20Roll(13, 1), bumblewiseHero(), 'might')).toBe(false);
	});

	it('fails on a natural 1 with a total of 13 with no such rule', () => {
		expect(assessSucceeds(d20Roll(13, 1), { uuid: 'Actor.hero', rules: [] }, 'insight')).toBe(
			false,
		);
	});

	it('reads the total against the Assess DC', () => {
		expect(assessSucceeds(d20Roll(12, 9), null, 'insight')).toBe(true);
		expect(assessSucceeds(d20Roll(11, 9), null, 'insight')).toBe(false);
	});

	it('succeeds on a natural 20 with a total of 11', () => {
		expect(assessSucceeds(d20Roll(11, 20), null, 'might')).toBe(true);
	});
});
