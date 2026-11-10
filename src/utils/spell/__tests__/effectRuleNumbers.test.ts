import { effectRuleNumbers } from '#utils/spell/effectRuleNumbers.js';
import localize from '#utils/localize.js';

describe('effectRuleNumbers', () => {
	const effect = {
		name: 'Condemned',
		system: {
			rules: [
				{ id: 'held1', type: 'heldRoll', label: 'Condemn' },
				{ id: 'held2', type: 'heldRoll', label: '' },
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
		]);
		expect(target.rules[0].fields).toEqual([
			{ name: 'value', label: localize('NIMBLE.rules.heldRoll.value.label') },
		]);
	});
});
