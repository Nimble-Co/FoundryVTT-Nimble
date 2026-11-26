import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { DamageFormulaChoiceRule } from '../damageFormulaChoice.js';

describe('Damage Formula Choice', () => {
	const schema = DamageFormulaChoiceRule.defineSchema();

	it('is a trigger with a dice choice for one item', () => {
		expect(DamageFormulaChoiceRule.group).toBe('triggers');
		expect(DamageFormulaChoiceRule.icon).toBe('fa-solid fa-right-left');
		expect(schema.itemIdentifier.options.label).toBe(
			'NIMBLE.rules.damageFormulaChoice.itemIdentifier.label',
		);
		expect(schema.from.options).toMatchObject({
			label: 'NIMBLE.rules.damageFormulaChoice.from.label',
			widget: 'diceFormula',
		});
		expect(schema.to.options).toMatchObject({
			label: 'NIMBLE.rules.damageFormulaChoice.to.label',
			widget: 'diceFormula',
		});
	});

	it('is the two ticks on Versatile Bowmaster', () => {
		const pack = JSON.parse(
			readFileSync(
				path.resolve(
					process.cwd(),
					'packs/classFeatures/core/hunter/hunter-progression/versatile-bowmaster.json',
				),
				'utf-8',
			),
		) as { system: { rules: object[] } };

		expect(pack.system.rules).toEqual([
			expect.objectContaining({
				type: 'damageFormulaChoice',
				id: 'versatile-bowmaster-longbow',
				itemIdentifier: 'longbow',
				from: '1d8',
				to: '2d4',
			}),
			expect.objectContaining({
				type: 'damageFormulaChoice',
				id: 'versatile-bowmaster-crossbow',
				itemIdentifier: 'crossbow',
				from: '4d4',
				to: '2d8',
			}),
		]);
	});
});
