import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { modifyRerollChanges } from '../modifyReroll.js';

type RuleConfig = Record<string, unknown>;

function modifier(config: RuleConfig = {}, itemName = 'Unfailing Courage') {
	return {
		id: `${itemName}-rule`,
		type: 'modifyReroll',
		disabled: false,
		rerollIdentifier: 'songweavers-inspiration',
		rollModeChange: 0,
		extraDamage: '',
		actionsForRoller: 0,
		tempHp: '',
		tempHpWithin: 0,
		appliesTo: () => true,
		item: { name: itemName, uuid: `Actor.lyra.Item.${itemName}` },
		...config,
	};
}

function songweaver(rules: ReturnType<typeof modifier>[]) {
	return {
		getRollData: () => ({ will: 3 }),
		items: {
			contents: rules.map((rule) => ({ rules: new Map([[rule.id, rule]]) })),
		},
	};
}

function inspiration(rules: ReturnType<typeof modifier>[], identifier = 'songweavers-inspiration') {
	return { identifier, actor: songweaver(rules) };
}

const rollGlobal = globalThis as unknown as { Roll: { replaceFormulaData?: unknown } };
let previousReplace: unknown;

beforeEach(() => {
	previousReplace = rollGlobal.Roll.replaceFormulaData;
	rollGlobal.Roll.replaceFormulaData = vi.fn((formula: string, data: Record<string, number>) =>
		formula.replace(/@(\w+)/g, (_match, key: string) => String(data[key] ?? 0)),
	);
});

afterEach(() => {
	rollGlobal.Roll.replaceFormulaData = previousReplace;
});

describe('modifyRerollChanges', () => {
	it('gives the roll mode change of a Modify Reroll rule for this reroll, named by its item', () => {
		const changes = modifyRerollChanges(inspiration([modifier({ rollModeChange: 1 })]), 'save');

		expect(changes).toEqual([
			{
				key: 'Actor.lyra.Item.Unfailing Courage#Unfailing Courage-rule:rollMode',
				kind: 'rollMode',
				label: 'Unfailing Courage',
				value: 1,
			},
		]);
	});

	it('gives extra damage on an attack only, resolved with the owner roll data', () => {
		const rules = [modifier({ extraDamage: '@will' }, 'Heroic Ballad')];

		expect(modifyRerollChanges(inspiration(rules), 'attack')).toEqual([
			{
				key: 'Actor.lyra.Item.Heroic Ballad#Heroic Ballad-rule:extraDamage',
				kind: 'extraDamage',
				label: 'Heroic Ballad',
				formula: '3',
			},
		]);
		expect(modifyRerollChanges(inspiration(rules), 'save')).toEqual([]);
	});

	it('leaves out rules for another reroll, turned-off rules and rules whose predicate fails', () => {
		const rules = [
			modifier({ rollModeChange: 1, rerollIdentifier: 'other' }, 'A'),
			modifier({ rollModeChange: 1, disabled: true }, 'B'),
			modifier({ rollModeChange: 1, appliesTo: () => false }, 'C'),
		];

		expect(modifyRerollChanges(inspiration(rules), 'attack')).toEqual([]);
	});

	it('gives nothing for a reroll rule with no identifier', () => {
		const rules = [modifier({ rollModeChange: 1, rerollIdentifier: '' })];

		expect(modifyRerollChanges(inspiration(rules, ''), 'attack')).toEqual([]);
	});

	it('leaves out changes the card already applied, so each counts once per attack', () => {
		const rules = [
			modifier({ rollModeChange: 1 }),
			modifier({ extraDamage: '@will' }, 'Heroic Ballad'),
		];
		const applied = ['Actor.lyra.Item.Unfailing Courage#Unfailing Courage-rule:rollMode'];

		expect(modifyRerollChanges(inspiration(rules), 'attack', applied).map((c) => c.kind)).toEqual([
			'extraDamage',
		]);
	});
});
