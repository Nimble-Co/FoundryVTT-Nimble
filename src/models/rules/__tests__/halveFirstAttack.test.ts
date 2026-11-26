import { describe, expect, it, vi } from 'vitest';
import { SYSTEM_ID } from '#system';
import {
	FIRST_ATTACK_HALVE_FLAG,
	HALVE_FIRST_ATTACK_PATH,
} from '#utils/damage/firstAttackHalve.js';
import { HalveFirstAttackRule } from '../halveFirstAttack.js';

function createRule(options: { embedded?: boolean; predicatePasses?: boolean } = {}) {
	const actor = {
		system: {} as Record<string, unknown>,
		getDomain: () => new Set<string>(),
		unsetFlag: vi.fn().mockResolvedValue(undefined),
	};
	const item = {
		isEmbedded: options.embedded ?? true,
		actor,
		name: 'Alpha Protector',
		uuid: 'Item.alpha',
		getDomain: () => new Set<string>(),
	};
	const rule = new HalveFirstAttackRule(
		{
			type: 'halveFirstAttack',
			disabled: false,
			label: 'Alpha Protector',
			id: 'alphaHalve',
			identifier: '',
			priority: 1,
			predicate: {},
		} as never,
		{ parent: item as never, strict: false },
	);
	Object.defineProperty(rule, 'parent', { get: () => item, configurable: true });
	const predicatePasses = options.predicatePasses ?? true;
	Object.defineProperty(rule, 'predicate', {
		get: () => ({ size: predicatePasses ? 0 : 1, test: () => predicatePasses }),
		configurable: true,
	});
	return { rule, actor };
}

describe('HalveFirstAttackRule', () => {
	it('marks the actor while the rule applies', () => {
		const { rule, actor } = createRule();
		rule.afterPrepareData();
		expect(actor.system[HALVE_FIRST_ATTACK_PATH]).toBe(true);
	});

	it('does not mark an item that is not on an actor', () => {
		const { rule, actor } = createRule({ embedded: false });
		rule.afterPrepareData();
		expect(actor.system[HALVE_FIRST_ATTACK_PATH]).toBeUndefined();
	});

	it('does not mark the actor when its condition fails', () => {
		const { rule, actor } = createRule({ predicatePasses: false });
		rule.afterPrepareData();
		expect(actor.system[HALVE_FIRST_ATTACK_PATH]).toBeUndefined();
	});

	it("clears the stamp when the owner's turn starts, also with rule automation off", async () => {
		const { rule, actor } = createRule();
		await rule.onActiveGmTurnStart();
		expect(actor.unsetFlag).toHaveBeenCalledWith(SYSTEM_ID, FIRST_ATTACK_HALVE_FLAG);
		expect(HalveFirstAttackRule.alwaysDispatchedEvents).toContain('onActiveGmTurnStart');
		expect(HalveFirstAttackRule.alwaysDispatchedEvents).not.toContain('onRoundChanged');
	});
});
