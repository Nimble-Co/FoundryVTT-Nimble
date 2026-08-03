import { describe, expect, it } from 'vitest';

import {
	collectMovementGrants,
	collectSpeedBonuses,
} from './CharacterMovementConfigDialog.utils.js';

/** Mirrors an embedded rule: RulesManager is a Map, so `rules` exposes `values()`. */
function item(name: string, rules: Record<string, unknown>[]) {
	return { name, rules: new Map(rules.map((r, i) => [`r${i}`, r])) as any };
}

describe('collectSpeedBonuses', () => {
	it('files a rule with a null movementType under walk', () => {
		// The schema initial for movementType is null, so an embedded rule that was never given
		// an explicit type reads as null — not undefined. This is the ancestry-bonus case.
		const items = [item('Stout', [{ type: 'speedBonus', value: '-1', movementType: null }])];

		expect(collectSpeedBonuses(items)).toEqual({
			walk: [{ itemName: 'Stout', value: -1 }],
		});
	});

	it('files a rule with an absent movementType under walk', () => {
		const items = [item('Stout', [{ type: 'speedBonus', value: '-1' }])];

		expect(collectSpeedBonuses(items).walk).toEqual([{ itemName: 'Stout', value: -1 }]);
	});

	it('honours an explicit movementType', () => {
		const items = [item('Winged', [{ type: 'speedBonus', value: '2', movementType: 'fly' }])];

		const bonuses = collectSpeedBonuses(items);
		expect(bonuses.fly).toEqual([{ itemName: 'Winged', value: 2 }]);
		expect(bonuses.walk).toBeUndefined();
	});

	it('lists each contributing item separately', () => {
		// The doubled-speed case: the ancestry and its bonus both carry the penalty.
		const items = [
			item('Dwarf', [{ type: 'speedBonus', value: '-1', movementType: null }]),
			item('Stout', [{ type: 'speedBonus', value: '-1', movementType: null }]),
		];

		expect(collectSpeedBonuses(items).walk).toEqual([
			{ itemName: 'Dwarf', value: -1 },
			{ itemName: 'Stout', value: -1 },
		]);
	});

	it('sums multiple bonuses from one item into a single entry', () => {
		const items = [
			item('Boots', [
				{ type: 'speedBonus', value: '2', movementType: null },
				{ type: 'speedBonus', value: '1', movementType: null },
			]),
		];

		expect(collectSpeedBonuses(items).walk).toEqual([{ itemName: 'Boots', value: 3 }]);
	});

	it('appends a rule label that adds information beyond the item name', () => {
		const items = [item('Barbarian', [{ type: 'speedBonus', value: '1', label: 'Fast Movement' }])];

		expect(collectSpeedBonuses(items).walk).toEqual([
			{ itemName: 'Barbarian — Fast Movement', value: 1 },
		]);
	});

	it('omits a label that merely repeats the item name', () => {
		const items = [item('Stout', [{ type: 'speedBonus', value: '-1', label: 'Stout' }])];

		expect(collectSpeedBonuses(items).walk).toEqual([{ itemName: 'Stout', value: -1 }]);
	});

	it('skips disabled rules and rules whose predicate fails', () => {
		const items = [
			item('Off', [{ type: 'speedBonus', value: '-1', disabled: true }]),
			item('Predicated', [{ type: 'speedBonus', value: '-1', test: () => false }]),
			item('On', [{ type: 'speedBonus', value: '-1', test: () => true }]),
		];

		expect(collectSpeedBonuses(items).walk).toEqual([{ itemName: 'On', value: -1 }]);
	});

	it('skips rules that resolve to zero and ignores other rule types', () => {
		const items = [
			item('Zero', [{ type: 'speedBonus', value: '0' }]),
			item('Other', [{ type: 'armorClass', value: '2' }]),
		];

		expect(collectSpeedBonuses(items)).toEqual({});
	});

	it('handles an item with no rules', () => {
		expect(collectSpeedBonuses([{ name: 'Bare' }])).toEqual({});
	});
});

describe('collectMovementGrants', () => {
	it('keeps only the highest grant per movement type', () => {
		const items = [
			item('Lesser', [{ type: 'grantMovement', speed: '4', mode: 'fly' }]),
			item('Greater', [{ type: 'grantMovement', speed: '6', mode: 'fly' }]),
		];

		expect(collectMovementGrants(items).fly).toEqual([{ itemName: 'Greater', value: 6 }]);
	});

	it('prefers the rule label over the item name', () => {
		const items = [
			item('Birdfolk', [{ type: 'grantMovement', speed: '6', mode: 'fly', label: 'Hollow Bones' }]),
		];

		expect(collectMovementGrants(items).fly).toEqual([{ itemName: 'Hollow Bones', value: 6 }]);
	});

	it('skips disabled, failing, and non-positive grants', () => {
		const items = [
			item('Off', [{ type: 'grantMovement', speed: '6', mode: 'fly', disabled: true }]),
			item('Fails', [{ type: 'grantMovement', speed: '6', mode: 'swim', test: () => false }]),
			item('Zero', [{ type: 'grantMovement', speed: '0', mode: 'climb' }]),
		];

		expect(collectMovementGrants(items)).toEqual({});
	});
});
