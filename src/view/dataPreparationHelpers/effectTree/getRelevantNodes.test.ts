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

	it('still shows a disposition-targeted node whose only On Hit child is a condition', () => {
		const effects = attackSpellEffects({
			targetDisposition: 'hostile',
			on: {
				hit: [
					{
						id: 'grappled',
						type: 'condition',
						conditionType: 'grappled',
						parentNode: 'root-damage',
						parentContext: 'hit',
					} as unknown as EffectNode,
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

		expect(damageIds(getRelevantNodes(effects, ['hit']))).toContain('root-damage');
	});

	it('shows a deferred damage node once the roll has landed', () => {
		const effects = attackSpellEffects({ deferredRoll: true });

		expect(damageIds(getRelevantNodes(effects, ['hit']))).toEqual(['root-damage-hit']);
	});

	it('still shows a deferred damage node that has no outcome child', () => {
		const effects = attackSpellEffects({ deferredRoll: true, roll: undefined, on: undefined });

		expect(damageIds(getRelevantNodes(effects, ['hit']))).toEqual(['root-damage']);
	});
});
