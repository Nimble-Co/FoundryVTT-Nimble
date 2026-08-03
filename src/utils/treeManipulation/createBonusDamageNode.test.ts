import { describe, expect, it } from 'vitest';
import { processNodes } from '../../view/dataPreparationHelpers/effectTree/processNodes.js';
import { createBonusDamageNode } from './createBonusDamageNode.js';
import { findNodesByContexts } from './findNodesByContexts.js';

function bonusNode() {
	return createBonusDamageNode({
		damageType: 'radiant',
		formula: '12',
		roll: { class: 'Roll', total: 12 },
	});
}

describe('createBonusDamageNode', () => {
	it('builds a root damage node carrying the requested type and roll', () => {
		const node = bonusNode();

		expect(node.type).toBe('damage');
		expect(node.damageType).toBe('radiant');
		expect(node.formula).toBe('12');
		expect(node.roll).toEqual({ class: 'Roll', total: 12 });
		expect(node.parentNode).toBeNull();
		expect(node.parentContext).toBeNull();
	});

	it('hangs a single hit outcome child off itself', () => {
		const node = bonusNode();

		expect(Object.keys(node.on ?? {})).toEqual(['hit']);
		expect(node.on?.hit).toHaveLength(1);
		expect(node.on?.hit?.[0]).toMatchObject({
			type: 'damageOutcome',
			outcome: 'fullDamage',
			parentContext: 'hit',
			parentNode: node.id,
		});
	});

	it('cannot crit or miss, because the amount already accounts for the outcome', () => {
		const node = bonusNode();

		expect(node.canCrit).toBe(false);
		expect(node.canMiss).toBe(false);
	});

	it('surfaces on a hit card, which a node without an outcome child does not', () => {
		const node = bonusNode();

		const surfaced = findNodesByContexts([node], ['hit']);

		expect(surfaced).toHaveLength(1);
		expect(surfaced[0].id).toBe(node.on?.hit?.[0].id);

		const withoutOutcome = { ...node, on: undefined };
		expect(findNodesByContexts([withoutOutcome], ['hit'])).toEqual([]);
	});

	it('also surfaces on a crit card, which asks for the hit context too', () => {
		const node = bonusNode();

		expect(findNodesByContexts([node], ['criticalHit', 'hit'])).toHaveLength(1);
	});

	it('lets processNodes copy the type and roll onto the outcome child', () => {
		const node = bonusNode();

		const [outcome] = processNodes([node], findNodesByContexts([node], ['hit']));

		expect(outcome).toMatchObject({
			type: 'damageOutcome',
			damageType: 'radiant',
			roll: { class: 'Roll', total: 12 },
		});
	});
});
