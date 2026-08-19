import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ConditionItemUsage, ConditionUsage } from './findConditionUsage.js';
import removeConditionReferences from './removeConditionReferences.js';

function itemUsage(
	system: Record<string, unknown>,
	overrides: Partial<ConditionItemUsage> = {},
): ConditionItemUsage & { item: { update: ReturnType<typeof vi.fn> } } {
	const item = { name: 'Hex Bolt', system, update: vi.fn().mockResolvedValue(undefined) };

	return {
		uuid: 'Item.HexBolt',
		name: 'Hex Bolt',
		img: 'icons/hex.svg',
		ownerName: null,
		item,
		referenceLabels: [],
		ruleIds: [],
		immunityRuleIds: [],
		markTargetRuleIds: [],
		nodeIds: [],
		...overrides,
	} as ConditionItemUsage & { item: { update: ReturnType<typeof vi.fn> } };
}

function usageOf(
	items: ConditionItemUsage[],
	actors: ConditionUsage['actors'] = [],
): ConditionUsage {
	return { actors, items, total: actors.length + items.length };
}

describe('removeConditionReferences', () => {
	beforeEach(() => {
		vi.spyOn(console, 'error').mockImplementation(() => undefined);
	});

	it('drops an applyCondition rule, whose whole purpose was the condition', async () => {
		const usage = itemUsage(
			{
				rules: [
					{ id: 'r1', type: 'applyCondition', condition: 'hexed' },
					{ id: 'r2', type: 'abilityBonus', value: 1 },
				],
			},
			{ ruleIds: ['r1'] },
		);

		await removeConditionReferences(usageOf([usage]), 'hexed');

		expect(usage.item.update).toHaveBeenCalledWith({
			'system.rules': [{ id: 'r2', type: 'abilityBonus', value: 1 }],
		});
	});

	it('keeps an immunity rule that still lists other conditions', async () => {
		const usage = itemUsage(
			{ rules: [{ id: 'r1', type: 'conditionImmunity', conditions: ['hexed', 'prone'] }] },
			{ immunityRuleIds: ['r1'] },
		);

		await removeConditionReferences(usageOf([usage]), 'hexed');

		expect(usage.item.update).toHaveBeenCalledWith({
			'system.rules': [{ id: 'r1', type: 'conditionImmunity', conditions: ['prone'] }],
		});
	});

	it('drops an immunity rule left with nothing to be immune to', async () => {
		const usage = itemUsage(
			{ rules: [{ id: 'r1', type: 'conditionImmunity', conditions: ['hexed'] }] },
			{ immunityRuleIds: ['r1'] },
		);

		await removeConditionReferences(usageOf([usage]), 'hexed');

		expect(usage.item.update).toHaveBeenCalledWith({ 'system.rules': [] });
	});

	it('clears the status on a markTarget rule but keeps its flag behaviour', async () => {
		const usage = itemUsage(
			{ rules: [{ id: 'r1', type: 'markTarget', flagKey: 'quarry', statusCondition: 'hexed' }] },
			{ markTargetRuleIds: ['r1'] },
		);

		await removeConditionReferences(usageOf([usage]), 'hexed');

		expect(usage.item.update).toHaveBeenCalledWith({
			'system.rules': [{ id: 'r1', type: 'markTarget', flagKey: 'quarry', statusCondition: '' }],
		});
	});

	it('removes the condition node and leaves its siblings in the tree', async () => {
		const usage = itemUsage(
			{
				activation: {
					effects: [
						{
							id: 'd1',
							type: 'damage',
							on: {
								hit: [
									{ id: 'c1', type: 'condition', condition: 'hexed' },
									{ id: 'c2', type: 'condition', condition: 'prone' },
								],
							},
						},
					],
				},
			},
			{ nodeIds: ['c1'] },
		);

		await removeConditionReferences(usageOf([usage]), 'hexed');

		const written = usage.item.update.mock.calls[0][0] as {
			'system.activation.effects': { on: { hit: { id: string }[] } }[];
		};
		expect(written['system.activation.effects'][0].on.hit.map(({ id }) => id)).toEqual(['c2']);
	});

	it('deletes the carrying effects from whichever document owns them', async () => {
		const actorParent = { uuid: 'Actor.Goblin', deleteEmbeddedDocuments: vi.fn() };
		const itemParent = { uuid: 'Item.Amulet', deleteEmbeddedDocuments: vi.fn() };
		const usage = usageOf(
			[],
			[
				{
					uuid: 'Actor.Goblin',
					name: 'Goblin',
					img: '',
					effects: [
						{ effectId: 'e1', parent: actorParent, parentName: 'Goblin' },
						{ effectId: 'e2', parent: actorParent, parentName: 'Goblin' },
						{ effectId: 'e3', parent: itemParent, parentName: 'Amulet' },
					],
				},
			],
		);

		await removeConditionReferences(usage, 'hexed');

		// Item-granted effects live on the item, so the actor cannot delete them.
		expect(actorParent.deleteEmbeddedDocuments).toHaveBeenCalledWith('ActiveEffect', ['e1', 'e2']);
		expect(itemParent.deleteEmbeddedDocuments).toHaveBeenCalledWith('ActiveEffect', ['e3']);
	});

	it('keeps going when one document refuses the update', async () => {
		const refused = itemUsage(
			{ rules: [{ id: 'r1', type: 'applyCondition', condition: 'hexed' }] },
			{ uuid: 'Item.Locked', ruleIds: ['r1'] },
		);
		refused.item.update.mockRejectedValue(new Error('locked pack'));
		const healthy = itemUsage(
			{ rules: [{ id: 'r2', type: 'applyCondition', condition: 'hexed' }] },
			{ uuid: 'Item.Healthy', ruleIds: ['r2'] },
		);

		await removeConditionReferences(usageOf([refused, healthy]), 'hexed');

		expect(console.error).toHaveBeenCalled();
		expect(healthy.item.update).toHaveBeenCalledWith({ 'system.rules': [] });
	});
});
