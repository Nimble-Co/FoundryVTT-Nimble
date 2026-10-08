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

	it('still shows a bare damage node whose Target Disposition is Any', () => {
		// The dropdown stores "Any" as a value, and a stored value is a choice
		// the card must honour when nothing else surfaces the roll.
		const effects = attackSpellEffects({ targetDisposition: 'any', on: undefined });

		expect(damageIds(getRelevantNodes(effects, ['hit']))).toEqual(['root-damage']);
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

	it('still shows a disposition-targeted node whose only On Hit child is a condition', () => {
		const effects = attackSpellEffects({
			targetDisposition: 'hostile',
			on: {
				hit: [
					{
						id: 'grappled',
						type: 'condition',
						condition: 'grappled',
						parentNode: 'root-damage',
						parentContext: 'hit',
					},
				],
			},
		});

		expect(damageIds(getRelevantNodes(effects, ['hit']))).toEqual(['root-damage']);
	});

	it('still shows the base damage node on a miss whose only On Miss child is a note', () => {
		const effects = attackSpellEffects({
			on: {
				hit: [outcomeChild('hit')],
				miss: [
					{
						id: 'glancing',
						type: 'note',
						noteType: 'flavor',
						text: 'The blade skids off the armour.',
						parentNode: 'root-damage',
						parentContext: 'miss',
					} as unknown as EffectNode,
				],
			},
		});

		const groups = getRelevantNodes(effects, ['miss'], { includeBaseDamageNodes: true });

		expect(damageIds(groups)).toEqual(['root-damage']);
	});

	it('still shows a deferred damage node, which carries its own Roll Damage button', () => {
		// The shape the effects builder makes: Roll Damage From Card ticked on a
		// node that already has its default On Hit outcome child. The child has no
		// roll to stand in with yet, so the node itself must reach the card.
		const effects = attackSpellEffects({ deferredRoll: true, roll: undefined });

		// Both reach the card: the node draws the Roll Damage button, and the
		// child draws a "0" box beside it. That placeholder is a known defect, not
		// the intent — see the note on DamageNode.svelte.
		expect(damageIds(getRelevantNodes(effects, ['hit']))).toEqual([
			'root-damage',
			'root-damage-hit',
		]);
	});

	it('shows a deferred damage node once the roll has landed', () => {
		const effects = attackSpellEffects({ deferredRoll: true });

		expect(damageIds(getRelevantNodes(effects, ['hit']))).toEqual(['root-damage-hit']);
	});

	it('still shows a deferred damage node that has no outcome child', () => {
		const effects = attackSpellEffects({ deferredRoll: true, roll: undefined, on: undefined });

		expect(damageIds(getRelevantNodes(effects, ['hit']))).toEqual(['root-damage']);
	});

	it('shows one damage roll on a crit when both crit and hit buckets hold an outcome', () => {
		const effects = attackSpellEffects({
			on: { criticalHit: [outcomeChild('criticalHit')], hit: [outcomeChild('hit')] },
		});

		expect(damageIds(getRelevantNodes(effects, ['criticalHit', 'hit']))).toEqual([
			'root-damage-criticalHit',
		]);
	});

	it('falls back to the On Hit outcome on a crit when the crit bucket has none', () => {
		expect(damageIds(getRelevantNodes(attackSpellEffects(), ['criticalHit', 'hit']))).toEqual([
			'root-damage-hit',
		]);
	});
});
