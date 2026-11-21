import { describe, expect, it, vi } from 'vitest';
import {
	forgetSchoolChoicesAt,
	storeChosenSchools,
	storeChosenSchoolsOnSource,
} from '../chosenSchools.js';

const choice = (id: string, extra: Record<string, unknown> = {}) => ({
	type: 'grantSpells',
	id,
	mode: 'selectSchool',
	schools: ['fire', 'ice'],
	...extra,
});

describe('storeChosenSchoolsOnSource', () => {
	const stored = (rules: unknown[], choices: Map<string, string[]>) => {
		const source = { system: { rules } };
		storeChosenSchoolsOnSource(source, choices);
		return source.system.rules;
	};

	it('puts the chosen schools on the school choice rule with that id', () => {
		const rules = [choice('a'), { type: 'grantSpells', id: 'b', mode: 'auto', schools: ['wind'] }];
		expect(stored(rules, new Map([['a', ['ice']]]))).toEqual([
			choice('a', { chosenSchools: ['ice'] }),
			rules[1],
		]);
	});

	it('leaves a rule that is not a school choice, even with that id', () => {
		const rules = [{ type: 'grantSpells', id: 'a', mode: 'selectSpell', schools: ['fire'] }];
		expect(stored(rules, new Map([['a', ['fire']]]))).toBe(rules);
	});

	it('leaves the rules when no rule changes, and a source with no rules', () => {
		const rules = [choice('a', { chosenSchools: ['ice'] })];
		expect(stored(rules, new Map([['a', ['ice']]]))).toBe(rules);
		const empty = {};
		storeChosenSchoolsOnSource(empty, new Map([['a', ['ice']]]));
		expect(empty).toEqual({});
	});
});

describe('storeChosenSchools', () => {
	function item(id: string, rules: unknown[]) {
		return { id, system: { rules }, update: vi.fn(async () => undefined) };
	}

	it('writes the choice to each item of the actor that holds the rule', async () => {
		const feature = item('f1', [choice('a')]);
		const other = item('f2', [choice('z')]);
		await storeChosenSchools({ items: [feature, other] }, new Map([['a', ['fire']]]));

		expect(feature.update).toHaveBeenCalledWith({
			'system.rules': [choice('a', { chosenSchools: ['fire'] })],
		});
		expect(other.update).not.toHaveBeenCalled();
	});

	it('writes nothing when there is no choice', async () => {
		const feature = item('f1', [choice('a')]);
		await storeChosenSchools({ items: [feature] }, new Map());
		expect(feature.update).not.toHaveBeenCalled();
	});
});

describe('forgetSchoolChoicesAt', () => {
	function item(rules: unknown[]) {
		return { system: { rules }, update: vi.fn(async () => undefined) };
	}

	it('takes back the choices made at the level that is taken back', async () => {
		const atThree = choice('a', { predicate: { level: { min: 3 } }, chosenSchools: ['ice'] });
		const atOne = choice('b', { predicate: { level: { min: 1 } }, chosenSchools: ['fire'] });
		const feature = item([atThree, atOne]);

		await forgetSchoolChoicesAt({ items: [feature] }, 3);

		expect(feature.update).toHaveBeenCalledWith({
			'system.rules': [{ ...atThree, chosenSchools: [] }, atOne],
		});
	});

	it('writes nothing when no choice was made at that level', async () => {
		const feature = item([choice('a', { predicate: { level: { min: 3 } } })]);
		await forgetSchoolChoicesAt({ items: [feature] }, 3);
		expect(feature.update).not.toHaveBeenCalled();
	});
});
