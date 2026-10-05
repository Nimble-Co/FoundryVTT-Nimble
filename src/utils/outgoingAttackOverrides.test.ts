import { describe, expect, it } from 'vitest';
import getOutgoingAttackOverrides from './outgoingAttackOverrides.js';

function rule(
	modifier: string,
	options: { disabled?: boolean; passes?: boolean; type?: string } = {},
) {
	return {
		type: options.type ?? 'modifyOutgoingAttack',
		modifier,
		disabled: options.disabled ?? false,
		test: () => options.passes ?? true,
	};
}

describe('getOutgoingAttackOverrides', () => {
	it('grants nothing for an actor with no rules', () => {
		expect(getOutgoingAttackOverrides({ rules: [] })).toEqual({
			cannotMiss: false,
			ignoreArmor: false,
		});
	});

	it('grants nothing when there is no actor', () => {
		expect(getOutgoingAttackOverrides(null)).toEqual({ cannotMiss: false, ignoreArmor: false });
	});

	it('collects cannotMiss and ignoreArmor from separate rules', () => {
		const overrides = getOutgoingAttackOverrides({
			rules: [rule('cannotMiss'), rule('ignoreArmor')],
		});

		expect(overrides).toEqual({ cannotMiss: true, ignoreArmor: true });
	});

	it('ignores rules of other types', () => {
		const overrides = getOutgoingAttackOverrides({
			rules: [rule('cannotMiss', { type: 'modifyIncomingAttack' })],
		});

		expect(overrides.cannotMiss).toBe(false);
	});

	it('ignores disabled rules', () => {
		const overrides = getOutgoingAttackOverrides({
			rules: [rule('cannotMiss', { disabled: true })],
		});

		expect(overrides.cannotMiss).toBe(false);
	});

	it('ignores rules whose predicate does not pass', () => {
		const overrides = getOutgoingAttackOverrides({
			rules: [rule('cannotMiss', { passes: false }), rule('ignoreArmor', { passes: true })],
		});

		expect(overrides).toEqual({ cannotMiss: false, ignoreArmor: true });
	});

	it('treats a rule with no test method as passing', () => {
		const overrides = getOutgoingAttackOverrides({
			rules: [{ type: 'modifyOutgoingAttack', modifier: 'cannotMiss' }],
		});

		expect(overrides.cannotMiss).toBe(true);
	});
});
