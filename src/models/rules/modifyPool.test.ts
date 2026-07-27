import { describe, expect, it } from 'vitest';
import { ModifyPoolRule } from './modifyPool.js';

type WidgetResolver = (data: Record<string, unknown>) => string;

function poolIdentifierWidget(): WidgetResolver {
	const schema = ModifyPoolRule.defineSchema();
	const widget = (schema.poolIdentifier as unknown as { options: { widget: unknown } }).options
		.widget;

	expect(typeof widget).toBe('function');
	return widget as WidgetResolver;
}

describe('ModifyPoolRule schema', () => {
	it('picks the charge pool picker when poolType is charge', () => {
		expect(poolIdentifierWidget()({ poolType: 'charge' })).toBe('chargePoolPicker');
	});

	it('picks the dice pool picker when poolType is dice', () => {
		expect(poolIdentifierWidget()({ poolType: 'dice' })).toBe('dicePoolPicker');
	});

	it('falls back to the dice pool picker when poolType is absent', () => {
		// The reference-docs generator resolves widgets against schema initials,
		// and a partially-typed rule can reach the renderer without poolType.
		expect(poolIdentifierWidget()({})).toBe('dicePoolPicker');
	});

	it('defaults poolType to dice, matching the widget fallback', () => {
		const schema = ModifyPoolRule.defineSchema();
		const poolType = schema.poolType as unknown as { initial: string };

		expect(poolType.initial).toBe('dice');
	});
});
