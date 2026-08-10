import { describe, expect, it } from 'vitest';
import type { DamageNode, EffectNode } from '#types/effectTree.js';
import { findNodesByContexts } from './findNodesByContexts.js';

function damageNode(overrides: Partial<DamageNode> = {}): DamageNode {
	return {
		id: 'root-damage',
		type: 'damage',
		damageType: 'necrotic',
		formula: '3d12',
		parentNode: null,
		parentContext: null,
		...overrides,
	};
}

/** The usual shape: the root damage reaches the card through its outcome child. */
function attackTree(): EffectNode[] {
	return [
		damageNode({
			on: {
				hit: [
					{
						id: 'root-damage-hit',
						type: 'damageOutcome',
						outcome: 'fullDamage',
						parentNode: 'root-damage',
						parentContext: 'hit',
					},
				],
			},
		}),
	];
}

describe('findNodesByContexts', () => {
	it('surfaces a root damage node through its outcome child, not on its own', () => {
		const found = findNodesByContexts(attackTree(), ['hit']);

		expect(found.map((node) => node.id)).toEqual(['root-damage-hit']);
	});

	it('surfaces a disposition-targeted root damage node itself', () => {
		// The other half of the same widened condition — pinned here so adding
		// the deferred arm cannot quietly break the arm that predates it.
		const found = findNodesByContexts([damageNode({ targetDisposition: 'hostile' })], ['hit']);

		expect(found.map((node) => node.id)).toEqual(['root-damage']);
	});

	it('surfaces a deferred damage node itself, since it has no outcome child', () => {
		// Shadow Trap: the damage posts unrolled and the node carries the Roll
		// Damage button, so nothing else on the card can stand in for it.
		const found = findNodesByContexts([damageNode({ deferredRoll: true })], ['hit']);

		expect(found.map((node) => node.id)).toEqual(['root-damage']);
	});

	it('keeps surfacing a deferred damage node once it has been rolled', () => {
		const rolled = damageNode({ deferredRoll: true, roll: { class: 'Roll', total: 21 } });
		const found = findNodesByContexts([rolled], ['hit']);

		expect(found).toHaveLength(1);
		expect((found[0] as DamageNode).roll?.total).toBe(21);
	});
});
