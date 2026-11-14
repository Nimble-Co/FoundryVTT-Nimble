import { describe, expect, it } from 'vitest';
import { EscapeDamageRule } from '../escapeDamage.js';

type FieldOptions = { initial?: unknown; widget?: string; choices?: unknown };
const schema = () =>
	EscapeDamageRule.defineSchema() as unknown as Record<
		string,
		{ initial?: unknown; options?: FieldOptions }
	>;

describe('EscapeDamageRule', () => {
	it('works only on an effect, in the triggers group', () => {
		expect(EscapeDamageRule.worksOnItems).toBe(false);
		expect(EscapeDamageRule.worksOnEffects).toBe(true);
		expect(EscapeDamageRule.group).toBe('triggers');
	});

	it('has no damage and no damage type by default', () => {
		const fields = schema();
		expect(fields.formula?.initial).toBe('');
		expect(fields.damageType?.initial).toBe('');
		expect(fields.type?.initial).toBe('escapeDamage');
	});

	it('takes dice in its damage, so an upcast can add to it', () => {
		expect(schema().formula?.options?.widget).toBe('diceFormula');
	});
});
