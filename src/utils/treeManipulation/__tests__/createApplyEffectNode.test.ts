import { describe, expect, it } from 'vitest';
import { getNodeOptions } from '#view/sheets/pages/itemActivationEffectsConfigTabHelpers.js';
import { createApplyEffectNode } from '../createApplyEffectNode.js';

describe('createApplyEffectNode', () => {
	it('points at the effect and goes to the targets', () => {
		const node = createApplyEffectNode('parent', 'hit', 'effect1');

		expect(node).toMatchObject({
			type: 'applyEffect',
			effectId: 'effect1',
			recipient: 'targets',
			tempHealingNodeId: null,
			parentNode: 'parent',
			parentContext: 'hit',
		});
	});

	it('is in the add menu at the top, under damage and under a save', () => {
		for (const parent of [null, { type: 'damage' }, { type: 'savingThrow' }]) {
			expect(getNodeOptions(parent).map((option) => option.value)).toContain('applyEffect');
		}
	});
});
