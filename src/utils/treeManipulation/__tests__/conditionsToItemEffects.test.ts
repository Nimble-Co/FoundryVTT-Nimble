import { describe, expect, it } from 'vitest';
import { conditionsToItemEffects } from '../conditionsToItemEffects.js';

let counter = 0;
const makeId = () => `id${++counter}`;

describe('conditionsToItemEffects', () => {
	it('gives each condition one effect on the item and points the nodes at it', () => {
		counter = 0;
		const tree = [
			{
				id: 'd1',
				type: 'damage',
				parentNode: null,
				parentContext: null,
				on: {
					hit: [
						{
							id: 'c1',
							type: 'condition',
							condition: 'dazed',
							parentNode: 'd1',
							parentContext: 'hit',
						},
					],
					criticalHit: [
						{
							id: 'c2',
							type: 'condition',
							condition: 'dazed',
							parentNode: 'd1',
							parentContext: 'criticalHit',
						},
					],
				},
			},
			{
				id: 'a1',
				type: 'applyEffect',
				effectId: null,
				condition: 'prone',
				parentNode: null,
				parentContext: null,
			},
		];

		const effects = conditionsToItemEffects(tree as never, makeId);

		expect(effects).toEqual([
			expect.objectContaining({ _id: 'id1', statuses: ['dazed'], type: 'nimble', transfer: false }),
			expect.objectContaining({ _id: 'id2', statuses: ['prone'] }),
		]);
		expect(tree[0].on?.hit[0]).toEqual({
			id: 'c1',
			type: 'applyEffect',
			effectId: 'id1',
			recipient: 'targets',
			tempHealingNodeId: null,
			parentNode: 'd1',
			parentContext: 'hit',
		});
		expect(tree[0].on?.criticalHit[0]).toMatchObject({ effectId: 'id1' });
		expect(tree[1]).toMatchObject({ type: 'applyEffect', effectId: 'id2' });
		expect(tree[1]).not.toHaveProperty('condition');
	});

	it('walks the shared rolls and the failed save of a save', () => {
		counter = 0;
		const tree = [
			{
				id: 's1',
				type: 'savingThrow',
				parentNode: null,
				parentContext: null,
				sharedRolls: [],
				on: {
					failedSave: [
						{
							id: 'c1',
							type: 'condition',
							condition: 'grappled',
							parentNode: 's1',
							parentContext: 'failedSave',
						},
					],
				},
			},
		];

		const effects = conditionsToItemEffects(tree as never, makeId);

		expect(effects).toHaveLength(1);
		expect(tree[0].on.failedSave[0]).toMatchObject({ type: 'applyEffect', effectId: 'id1' });
	});
});
