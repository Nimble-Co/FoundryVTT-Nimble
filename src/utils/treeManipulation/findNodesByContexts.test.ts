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

/** A damage node under another damage node's On Hit bucket. */
function nestedTree(overrides: Partial<DamageNode> = {}): EffectNode[] {
	return [
		damageNode({
			on: {
				hit: [
					damageNode({
						id: 'nested-damage',
						parentNode: 'root-damage',
						parentContext: 'hit',
						roll: { class: 'DamageRoll', total: 3 },
						on: {
							hit: [
								{
									id: 'nested-damage-hit',
									type: 'damageOutcome',
									outcome: 'fullDamage',
									parentNode: 'nested-damage',
									parentContext: 'hit',
								},
							],
						},
						...overrides,
					}),
				],
			},
		}),
	];
}

function outcomeChild(context: string, parent = 'root-damage'): EffectNode {
	return {
		id: `${parent}-${context}`,
		type: 'damageOutcome',
		outcome: 'fullDamage',
		parentNode: parent,
		parentContext: context,
	};
}

function critNote(): EffectNode {
	return {
		id: 'crit-note',
		type: 'note',
		noteType: 'warning',
		text: 'CRIT',
		parentNode: 'root-damage',
		parentContext: 'criticalHit',
	} as unknown as EffectNode;
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
		// Deferred damage posts unrolled and the node carries the Roll
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

	it('surfaces a nested damage node through its outcome child, not on its own', () => {
		// Damage -> On Hit -> Damage -> On Hit -> Damage Outcome. The nested node
		// and its outcome child carry the same roll, so surfacing both draws the
		// roll twice on the card and applies it twice.
		const found = findNodesByContexts(nestedTree(), ['hit']);

		expect(found.map((node) => node.id)).toEqual(['nested-damage-hit']);
	});

	it('surfaces a nested damage node itself when it has no outcome child', () => {
		// The shape the shipped Shatter uses for its critical-hit bonus damage.
		const found = findNodesByContexts(nestedTree({ on: {} }), ['hit']);

		expect(found.map((node) => node.id)).toEqual(['nested-damage']);
	});

	it('surfaces an unrolled deferred nested damage node, which owns the Roll Damage button', () => {
		const found = findNodesByContexts(nestedTree({ deferredRoll: true, roll: undefined }), ['hit']);

		expect(found.map((node) => node.id)).toEqual(['nested-damage', 'nested-damage-hit']);
	});

	it('lets a Damage Outcome under On Critical Hit override the one under On Hit', () => {
		// A crit card reads both buckets, and both outcome children carry the same
		// parent roll. Only the crit bucket's outcome may reach the card.
		const tree = [
			damageNode({
				on: { criticalHit: [outcomeChild('criticalHit')], hit: [outcomeChild('hit')] },
			}),
		];

		const found = findNodesByContexts(tree, ['criticalHit', 'hit']);

		expect(found.map((node) => node.id)).toEqual(['root-damage-criticalHit']);
	});

	it('keeps the other On Hit children when the crit bucket overrides the outcome', () => {
		const tree = [
			damageNode({
				on: {
					criticalHit: [outcomeChild('criticalHit'), critNote()],
					hit: [
						outcomeChild('hit'),
						{
							id: 'grappled',
							type: 'condition',
							condition: 'grappled',
							parentNode: 'root-damage',
							parentContext: 'hit',
						} as unknown as EffectNode,
						damageNode({ id: 'cold-rider', parentNode: 'root-damage', parentContext: 'hit' }),
					],
				},
			}),
		];

		const found = findNodesByContexts(tree, ['criticalHit', 'hit']);

		expect(found.map((node) => node.id)).toEqual([
			'root-damage-criticalHit',
			'crit-note',
			'grappled',
			'cold-rider',
		]);
	});

	it('still shows the On Hit outcome on a crit when the crit bucket has no outcome', () => {
		const tree = [damageNode({ on: { criticalHit: [critNote()], hit: [outcomeChild('hit')] } })];

		const found = findNodesByContexts(tree, ['criticalHit', 'hit']);

		expect(found.map((node) => node.id)).toEqual(['crit-note', 'root-damage-hit']);
	});

	it('keeps one outcome per parent when two damage nodes each fill both buckets', () => {
		const both = (parent: string) => ({
			criticalHit: [outcomeChild('criticalHit', parent)],
			hit: [outcomeChild('hit', parent)],
		});
		const tree = [
			damageNode({ id: 'first', on: both('first') }),
			damageNode({ id: 'second', on: both('second') }),
		];

		const found = findNodesByContexts(tree, ['criticalHit', 'hit']);

		expect(found.map((node) => node.id)).toEqual(['first-criticalHit', 'second-criticalHit']);
	});

	it('leaves two outcomes in the same bucket alone', () => {
		// Only the cross-bucket double is a card-building artefact. What one
		// bucket holds is the homebrewer's own layout.
		const tree = [
			damageNode({
				on: { hit: [outcomeChild('hit'), { ...outcomeChild('hit'), id: 'second-hit' }] },
			}),
		];

		const found = findNodesByContexts(tree, ['hit']);

		expect(found.map((node) => node.id)).toEqual(['root-damage-hit', 'second-hit']);
	});
});
