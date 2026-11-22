import { describe, expect, it } from 'vitest';
import { firstDamageNode } from '../firstDamageNode.js';
import { withWeaponEffects } from '../withWeaponEffects.js';

const outcome = (id: string, parentNode: string, parentContext: string) => ({
	id,
	type: 'damageOutcome',
	parentNode,
	parentContext,
});

const abilityTree = () => [
	{
		id: 'shot',
		type: 'damage',
		formula: '1d8',
		parentNode: null,
		parentContext: null,
		on: { hit: [outcome('shotFull', 'shot', 'hit')] },
	},
];

const weaponTree = () => [
	{
		id: 'bow',
		type: 'damage',
		formula: '1d6',
		parentNode: null,
		parentContext: null,
		on: {
			hit: [
				outcome('bowFull', 'bow', 'hit'),
				{ id: 'bowFire', type: 'text', text: 'Burns.', parentNode: 'bow', parentContext: 'hit' },
			],
		},
	},
	{ id: 'note', type: 'text', text: 'Loud.', parentNode: null, parentContext: null },
];

describe('withWeaponEffects', () => {
	it("puts the weapon's hit nodes under the ability's attack, without a second damage outcome", () => {
		const [attack] = withWeaponEffects(abilityTree(), weaponTree()) as ReturnType<
			typeof abilityTree
		>;

		expect(attack.on.hit).toEqual([
			outcome('shotFull', 'shot', 'hit'),
			{
				id: 'weapon-bowFire',
				type: 'text',
				text: 'Burns.',
				parentNode: 'shot',
				parentContext: 'hit',
			},
		]);
	});

	it("adds the weapon's other nodes after the ability's nodes, with prefixed ids", () => {
		const merged = withWeaponEffects(abilityTree(), weaponTree()) as { id: string }[];

		expect(merged.map((node) => node.id)).toEqual(['shot', 'weapon-note']);
	});

	it('leaves out a weapon node that the attack already has in that place', () => {
		const ability = abilityTree();
		ability[0].on.hit.push({
			id: 'ownFire',
			type: 'text',
			text: 'Burns.',
			parentNode: 'shot',
			parentContext: 'hit',
		} as never);

		const [attack] = withWeaponEffects(ability, weaponTree()) as ReturnType<typeof abilityTree>;

		expect(attack.on.hit.map((node) => node.id)).toEqual(['shotFull', 'ownFire']);
	});

	it('does not change the trees it is given', () => {
		const ability = abilityTree();
		const weapon = weaponTree();

		withWeaponEffects(ability, weapon);

		expect(ability).toEqual(abilityTree());
		expect(weapon).toEqual(weaponTree());
	});
});

describe('firstDamageNode', () => {
	it('finds a damage node nested under another node', () => {
		const inner = { type: 'damage', formula: '1d4' };
		const tree = [{ type: 'savingThrow', on: { failedSave: [inner] } }];

		expect(firstDamageNode(tree as never[])).toBe(inner);
		expect(firstDamageNode([{ type: 'text' }])).toBeNull();
	});
});
