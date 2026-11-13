import { describe, expect, it, vi } from 'vitest';
import { getCombatantBaseActionMax } from '../../../documents/combat/combatantSystem.js';
import { MaxActionBonusRule } from '../maxActionBonus.js';

function makeActor(maxActionBonus?: number) {
	return {
		system: { attributes: maxActionBonus === undefined ? {} : { maxActionBonus } },
		getRollData: vi.fn(() => ({})),
		getDomain: vi.fn(() => new Set<string>()),
	};
}

function makeRule(
	value: string,
	actor: ReturnType<typeof makeActor>,
	{ passes = true, isEmbedded = true } = {},
) {
	const item = {
		isEmbedded,
		actor,
		name: 'Haste',
		uuid: 'Item.haste',
		getDomain: () => new Set(),
	};
	const rule = new MaxActionBonusRule(
		{
			value,
			id: 'r',
			label: '',
			identifier: '',
			priority: 1,
			predicate: {},
			type: 'maxActionBonus',
		} as never,
		{ parent: item as never, strict: false },
	);
	(rule as { value: string }).value = value;
	Object.defineProperty(rule, 'parent', { get: () => item, configurable: true });
	Object.defineProperty(rule, 'predicate', {
		get: () => ({ size: passes ? 0 : 1, test: () => passes }),
		configurable: true,
	});
	return rule;
}

describe('MaxActionBonusRule', () => {
	it('adds its actions to what other rules add', () => {
		const actor = makeActor(1);
		makeRule('1', actor).afterPrepareData();
		expect(actor.system.attributes.maxActionBonus).toBe(2);
	});

	it('adds nothing when the rule is off, its predicate fails, or it is not on a creature', () => {
		const actor = makeActor(1);
		const off = makeRule('1', actor);
		off.disabled = true;
		off.afterPrepareData();
		makeRule('1', actor, { passes: false }).afterPrepareData();
		makeRule('1', actor, { isEmbedded: false }).afterPrepareData();
		expect(actor.system.attributes.maxActionBonus).toBe(1);
	});

	it('the combatant action max has the bonus of its creature', () => {
		const combatant = {
			system: { actions: { base: { current: 3, max: 3 } } },
			actor: makeActor(1),
		};
		expect(getCombatantBaseActionMax(combatant as never)).toBe(4);
		expect(getCombatantBaseActionMax({ ...combatant, actor: makeActor() } as never)).toBe(3);
	});
});
