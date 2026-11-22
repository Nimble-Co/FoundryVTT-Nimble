import type { EffectNode } from '#types/effectTree.js';
import { groupNodes } from '../groupNodes.js';

function damage(id: string, damageType: string, forTarget?: string) {
	return {
		id,
		type: 'damage',
		damageType,
		formula: '1d6',
		parentNode: null,
		parentContext: null,
		...(forTarget ? { forTarget } : {}),
	} as unknown as EffectNode;
}

function damageGroup(nodes: EffectNode[]) {
	return groupNodes(nodes)[1]?.map((node) => node.id);
}

describe('groupNodes', () => {
	it('puts the damage of each target together, the first target first', () => {
		const nodes = [
			damage('slashing-a', 'slashing', 'Token.a'),
			damage('slashing-b', 'slashing', 'Token.b'),
			damage('necrotic-a', 'necrotic', 'Token.a'),
			damage('necrotic-b', 'necrotic', 'Token.b'),
		];

		expect(damageGroup(nodes)).toEqual(['slashing-a', 'necrotic-a', 'slashing-b', 'necrotic-b']);
	});

	it('keeps the order of damage for no one target', () => {
		const nodes = [damage('one', 'slashing'), damage('two', 'fire'), damage('three', 'cold')];

		expect(damageGroup(nodes)).toEqual(['one', 'two', 'three']);
	});
});
