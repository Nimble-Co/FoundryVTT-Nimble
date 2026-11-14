import localize from '#utils/localize.js';
import { effectRuleNumbers } from '#utils/spell/effectRuleNumbers.js';

describe('effectRuleNumbers', () => {
	const effect = {
		name: 'Condemned',
		system: {
			rules: [
				{ id: 'held1', type: 'heldRoll', label: 'Condemn' },
				{ id: 'held2', type: 'heldRoll', label: '', heldKind: 'advantage' },
				{ id: 'held3', type: 'heldRoll', label: 'Edge', heldKind: 'primaryDie' },
			],
		},
	};
	const item = {
		system: {
			activation: {
				effects: [
					{
						id: 'dmg1',
						type: 'damage',
						formula: '30',
						parentContext: null,
						parentNode: null,
						on: {
							hit: [
								{
									id: 'apply1',
									type: 'applyEffect',
									effectId: 'fx',
									recipient: 'targets',
									parentContext: 'hit',
									parentNode: 'dmg1',
								},
							],
						},
					},
					{
						id: 'apply2',
						type: 'applyEffect',
						effectId: null,
						condition: 'dazed',
						recipient: 'targets',
						parentContext: null,
						parentNode: null,
					},
				],
			},
		},
		effects: { get: (id: string) => (id === 'fx' ? effect : undefined) },
	};

	it('lists each Apply Effect node with an effect, its rules and their number fields', () => {
		const [target, ...others] = effectRuleNumbers(item as never);

		expect(others).toEqual([]);
		expect(target).toMatchObject({ nodeId: 'apply1', label: 'Condemned' });
		expect(target.rules.map((rule) => rule.label)).toEqual([
			'Condemn',
			localize('NIMBLE.ruleTypes.heldRoll'),
			'Edge',
		]);
		expect(target.rules[0].fields).toEqual([
			{ name: 'value', label: localize('NIMBLE.rules.heldRoll.value.label'), kind: 'number' },
		]);
	});

	it('names the field by what a raise adds, when the rule class says it', () => {
		const [target] = effectRuleNumbers(item as never);

		expect(target.rules[1].fields).toEqual([{ name: 'value', label: 'advantage', kind: 'number' }]);
		expect(target.rules[2].fields).toEqual([
			{ name: 'value', label: 'to the Primary Die', kind: 'number' },
		]);
	});

	it('lists a formula field of a rule with the kind formula, when the rule shows it', () => {
		const bonusEffect = {
			name: 'Enchanted',
			system: {
				rules: [
					{ id: 'bonus', type: 'damageBonus', label: 'Bonus', value: '@key' },
					{ id: 'extra', type: 'heldRoll', label: 'Extra', heldKind: 'extraDamage', value: 1 },
				],
			},
		};
		const [target] = effectRuleNumbers({
			...item,
			effects: { get: (id: string) => (id === 'fx' ? bonusEffect : undefined) },
		} as never);

		expect(target.rules[0].fields).toEqual([
			{
				name: 'value',
				label: localize('NIMBLE.rules.damageBonus.value.label'),
				kind: 'formula',
			},
		]);
		expect(target.rules[1].fields).toContainEqual({
			name: 'formula',
			label: localize('NIMBLE.rules.heldRoll.formula.label'),
			kind: 'formula',
		});
	});

	it('leaves out a formula field that the rule hides', () => {
		const [target] = effectRuleNumbers(item as never);

		expect(target.rules[1].fields.map((field) => field.name)).toEqual(['value']);
	});
});
