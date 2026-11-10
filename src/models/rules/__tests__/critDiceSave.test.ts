import { describe, expect, it } from 'vitest';
import { Predicate } from '../../../etc/Predicate.js';
import { CritDiceSaveRule } from '../critDiceSave.js';

function make(
	data: object,
	parent: object = { isEmbedded: true, name: 'Feature', uuid: 'Item.f' },
) {
	const rule = new CritDiceSaveRule(
		{ type: 'critDiceSave' } as never,
		{ parent, strict: false } as never,
	);
	Object.assign(rule, { predicate: new Predicate({}), chargePoolIdentifier: '', ...data });
	Object.defineProperty(rule, 'parent', { get: () => parent, configurable: true });
	return rule;
}

const ATTACK = { kind: 'attack' };
const TARGET = { uuid: 'Actor.t' };

describe('Crit Dice Save rule', () => {
	it('shows a row for the roller with one target', () => {
		expect(make({}).offersUseOn({ side: 'roller', roll: ATTACK, other: TARGET } as never)).toBe(
			true,
		);
	});

	it('shows no row with no sole target', () => {
		expect(make({}).offersUseOn({ side: 'roller', roll: ATTACK, other: null } as never)).toBe(
			false,
		);
	});

	it('shows no row for the target', () => {
		expect(make({}).offersUseOn({ side: 'target', roll: ATTACK, other: TARGET } as never)).toBe(
			false,
		);
	});

	it('costs one charge of its pool', () => {
		expect(make({ chargePoolIdentifier: ' twist ' }).rollUseCost).toMatchObject({
			chargePoolIdentifier: 'twist',
			chargeCost: 1,
		});
	});
});
