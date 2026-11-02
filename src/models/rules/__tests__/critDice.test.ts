import { afterEach, describe, expect, it, vi } from 'vitest';
import { Predicate } from '../../../etc/Predicate.js';
import { CritDiceRule } from '../critDice.js';

function make(
	data: object,
	parent: object = { isEmbedded: true, name: 'Feature', uuid: 'Item.f' },
) {
	const rule = new CritDiceRule({ type: 'critDice' } as never, { parent, strict: false } as never);
	Object.assign(rule, {
		predicate: new Predicate({}),
		id: 'r1',
		formula: '@level d6',
		dieRole: 'none',
		attackDelivery: 'any',
		oncePerTurn: false,
		...data,
	});
	Object.defineProperty(rule, 'item', { get: () => parent, configurable: true });
	Object.defineProperty(rule, 'actor', {
		get: () => ({ getRollData: () => ({}) }),
		configurable: true,
	});
	return rule;
}

describe('Crit Dice rule', () => {
	afterEach(() => vi.unstubAllGlobals());

	it('gives its dice with the formula read from the hero', () => {
		vi.stubGlobal('Roll', { replaceFormulaData: () => '2d6' });

		expect(make({}).specFor(null)).toEqual({
			key: 'Item.f:r1',
			label: 'Feature',
			role: 'none',
			formula: '2d6',
		});
	});

	it('gives nothing on an attack of another delivery', () => {
		expect(make({ attackDelivery: 'melee' }).specFor('ranged' as never)).toBeNull();
	});

	it('gives nothing when its condition does not hold', () => {
		expect(make({ test: () => false }).specFor(null)).toBeNull();
	});

	it('shows a row only for the roller on an attack', () => {
		vi.stubGlobal('Roll', { replaceFormulaData: () => '2d6' });
		const rule = make({});
		const attack = { kind: 'attack', delivery: null };

		expect(rule.offersUseOn({ side: 'roller', roll: attack } as never)).toBe(true);
		expect(rule.offersUseOn({ side: 'target', roll: attack } as never)).toBe(false);
		expect(rule.offersUseOn({ side: 'roller', roll: { kind: 'save' } } as never)).toBe(false);
	});
});
