import { describe, expect, it } from 'vitest';
import type { DamageNode, DamageOutcomeNode, EffectNode } from '#types/effectTree.js';
import { getRelevantNodes } from './getRelevantNodes.js';

function outcomeChild(context: string, outcome: 'fullDamage' | 'halfDamage' = 'fullDamage') {
	return {
		id: `root-damage-${context}`,
		type: 'damageOutcome',
		outcome,
		parentNode: 'root-damage',
		parentContext: context,
	} as DamageOutcomeNode;
}

/** The shape the effects builder creates for a homebrew attack spell. */
function attackSpellEffects(overrides: Partial<DamageNode> = {}): EffectNode[] {
	return [
		{
			id: 'root-damage',
			type: 'damage',
			damageType: 'slashing',
			formula: '1d6',
			canCrit: true,
			canMiss: true,
			parentNode: null,
			parentContext: null,
			roll: { class: 'DamageRoll', total: 5 },
			on: { hit: [outcomeChild('hit')] },
			...overrides,
		} as DamageNode,
	];
}

function damageNodes(groups: EffectNode[][]) {
	return groups.flat().filter((node) => node.type === 'damage' || node.type === 'damageOutcome');
}

function damageIds(groups: EffectNode[][]) {
	return damageNodes(groups).map((node) => node.id);
}

describe('getRelevantNodes', () => {
	it('shows one damage roll on a hit', () => {
		expect(damageIds(getRelevantNodes(attackSpellEffects(), ['hit']))).toEqual(['root-damage-hit']);
	});

	it('shows one damage roll when Target Disposition is Any', () => {
		const groups = getRelevantNodes(attackSpellEffects({ targetDisposition: 'any' }), ['hit']);

		expect(damageIds(groups)).toEqual(['root-damage-hit']);
	});

	it('shows one damage roll when Target Disposition is a real disposition', () => {
		const groups = getRelevantNodes(attackSpellEffects({ targetDisposition: 'hostile' }), ['hit']);

		expect(damageIds(groups)).toEqual(['root-damage-hit']);
	});

	it('passes the disposition to the outcome child, so the Apply Damage hint survives', () => {
		const groups = getRelevantNodes(attackSpellEffects({ targetDisposition: 'hostile' }), ['hit']);

		expect(damageNodes(groups)[0]?.targetDisposition).toBe('hostile');
	});

	it('shows one damage roll on a miss that has its own outcome child', () => {
		const effects = attackSpellEffects({
			on: { hit: [outcomeChild('hit')], miss: [outcomeChild('miss', 'halfDamage')] },
		});

		const groups = getRelevantNodes(effects, ['miss'], { includeBaseDamageNodes: true });

		expect(damageIds(groups)).toEqual(['root-damage-miss']);
	});

	it('still shows the base damage node on a miss when nothing else surfaces it', () => {
		const groups = getRelevantNodes(attackSpellEffects(), ['miss'], {
			includeBaseDamageNodes: true,
		});

		expect(damageIds(groups)).toEqual(['root-damage']);
	});

	it('still shows a disposition-targeted damage node that has no outcome child', () => {
		const effects = attackSpellEffects({ targetDisposition: 'hostile', on: undefined });

		expect(damageIds(getRelevantNodes(effects, ['hit']))).toEqual(['root-damage']);
	});

	it('still shows a deferred damage node, which carries its own Roll Damage button', () => {
		const effects = attackSpellEffects({ deferredRoll: true, on: undefined });

		expect(damageIds(getRelevantNodes(effects, ['hit']))).toEqual(['root-damage']);
	});
});
