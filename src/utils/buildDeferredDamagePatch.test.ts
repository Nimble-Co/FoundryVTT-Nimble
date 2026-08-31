import { describe, expect, it } from 'vitest';
import type { DamageNode, EffectNode } from '#types/effectTree.js';
import { buildDeferredDamagePatch } from './buildDeferredDamagePatch.js';

const TRIGGERED_ROLL = {
	class: 'Roll',
	formula: '3d12',
	total: 21,
	evaluated: true,
	options: {},
	terms: [{ class: 'Die', number: 3, faces: 12, evaluated: true, results: [{ result: 7 }] }],
};

/** A concentration effect, plus damage whose trigger has not fired yet. */
function activation(damageOverrides: Partial<DamageNode> = {}) {
	return {
		effects: [
			{
				id: 'concentration-node',
				type: 'condition',
				condition: 'concentration',
				parentNode: null,
				parentContext: null,
			},
			{
				id: 'trap-damage',
				type: 'damage',
				damageType: 'necrotic',
				formula: '3d12',
				deferredRoll: true,
				canCrit: false,
				canMiss: false,
				parentNode: null,
				parentContext: null,
				...damageOverrides,
			},
		],
	} as Record<string, unknown>;
}

function damageNodeOf(activationData: Record<string, unknown>) {
	return (activationData.effects as EffectNode[]).find(
		(node) => node.id === 'trap-damage',
	) as DamageNode;
}

describe('buildDeferredDamagePatch', () => {
	it('attaches the roll to the node that asked for it', () => {
		const result = buildDeferredDamagePatch(activation(), [], 'trap-damage', TRIGGERED_ROLL);
		if (!result) throw new Error('expected a patched activation');

		expect(damageNodeOf(result.activation).roll).toMatchObject({ class: 'Roll', total: 21 });
	});

	it('leaves the rest of the tree alone', () => {
		const result = buildDeferredDamagePatch(activation(), [], 'trap-damage', TRIGGERED_ROLL);
		if (!result) throw new Error('expected a patched activation');
		const effects = result.activation.effects as EffectNode[];

		expect(effects).toHaveLength(2);
		expect(effects[0]).toMatchObject({ type: 'condition', condition: 'concentration' });
	});

	it('appends the roll to the message rolls source', () => {
		const result = buildDeferredDamagePatch(
			activation(),
			['{"class":"Roll","total":4}'],
			'trap-damage',
			TRIGGERED_ROLL,
		);
		if (!result) throw new Error('expected a patched activation');

		expect(result.rolls).toHaveLength(2);
		expect(JSON.parse(result.rolls[1])).toMatchObject({ class: 'Roll', total: 21 });
	});

	it('refuses a node that has already been rolled, so a second click cannot reroll it', () => {
		const alreadyRolled = activation({ roll: { ...TRIGGERED_ROLL, total: 9 } });

		expect(buildDeferredDamagePatch(alreadyRolled, [], 'trap-damage', TRIGGERED_ROLL)).toBeNull();
	});

	it('refuses a damage node that was never deferred', () => {
		const immediate = activation({ deferredRoll: false });

		expect(buildDeferredDamagePatch(immediate, [], 'trap-damage', TRIGGERED_ROLL)).toBeNull();
	});

	it('refuses a node id the card does not carry', () => {
		expect(buildDeferredDamagePatch(activation(), [], 'no-such-node', TRIGGERED_ROLL)).toBeNull();
	});
});
