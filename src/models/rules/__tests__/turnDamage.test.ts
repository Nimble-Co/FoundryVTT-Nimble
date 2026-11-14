import { describe, expect, it } from 'vitest';
import { TurnDamageRule } from '../turnDamage.js';

type FieldOptions = { initial?: unknown; showWhen?: (data: object) => boolean };
const schema = () =>
	TurnDamageRule.defineSchema() as unknown as Record<
		string,
		{ initial?: unknown; options?: FieldOptions }
	>;

describe('TurnDamageRule', () => {
	it('works on an item and on an effect, in the triggers group', () => {
		expect(TurnDamageRule.worksOnItems).toBe(true);
		expect(TurnDamageRule.worksOnEffects).toBe(true);
		expect(TurnDamageRule.group).toBe('triggers');
	});

	it("hurts its holder at the start of the holder's turn by default, with no damage and no Wounds", () => {
		const fields = schema();
		expect(fields.at?.initial).toBe('turnStart');
		expect(fields.who?.initial).toBe('holder');
		expect(fields.reach?.initial).toBe(1);
		expect(fields.formula?.initial).toBe('');
		expect(fields.damageType?.initial).toBe('');
		expect(fields.wounds?.initial).toBe(0);
	});

	it('shows Reach only for the creatures near the holder', () => {
		const showReach = schema().reach?.options?.showWhen;
		expect(showReach?.({ who: 'nearby' })).toBe(true);
		expect(showReach?.({ who: 'holder' })).toBe(false);
	});
});
