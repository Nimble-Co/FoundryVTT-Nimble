import { beforeEach, describe, expect, it } from 'vitest';
import findConditionUsage from './findConditionUsage.js';

function conditionNode(id: string, condition: string) {
	return { id, type: 'condition', condition, parentContext: null, parentNode: null };
}

function item(name: string, system: Record<string, unknown>) {
	return { uuid: `Item.${name}`, name, img: `icons/${name}.svg`, system, update: undefined };
}

function actor(name: string, effects: { id: string; statuses: string[] }[]) {
	const built = {
		uuid: `Actor.${name}`,
		name,
		img: `icons/${name}.svg`,
		items: [] as unknown[],
		effects: [] as unknown[],
	};

	built.effects = effects.map((effect) => ({
		id: effect.id,
		statuses: new Set(effect.statuses),
		parent: built,
	}));

	return built;
}

function setWorld(actors: unknown[], items: unknown[]): void {
	(game as unknown as { actors: unknown[] }).actors = actors;
	(game as unknown as { items: unknown[] }).items = items;
	(game as unknown as { scenes: unknown[] }).scenes = [];
}

describe('findConditionUsage', () => {
	beforeEach(() => {
		(CONFIG as unknown as { NIMBLE: Record<string, unknown> }).NIMBLE = {
			ruleTypes: {
				applyCondition: 'Apply Condition',
				conditionImmunity: 'Condition Immunity',
				markTarget: 'Mark Target',
			},
		};
		setWorld([], []);
	});

	it('reports nothing for a condition no document mentions', () => {
		setWorld(
			[actor('Goblin', [{ id: 'e1', statuses: ['prone'] }])],
			[item('Torch', { rules: [{ id: 'r1', type: 'applyCondition', condition: 'blinded' }] })],
		);

		expect(findConditionUsage('hexed')).toEqual({ actors: [], items: [], total: 0 });
	});

	it('finds the effects carrying the condition, including on unlinked token actors', () => {
		const linked = actor('Goblin', [{ id: 'e1', statuses: ['hexed'] }]);
		const unlinked = actor('Token Goblin', [{ id: 'e2', statuses: ['hexed'] }]);
		setWorld([linked], []);
		(game as unknown as { scenes: unknown[] }).scenes = [{ tokens: [{ actor: unlinked }] }];

		const usage = findConditionUsage('hexed');

		expect(usage.actors.map(({ name }) => name)).toEqual(['Goblin', 'Token Goblin']);
		expect(usage.actors[0].effects).toEqual([
			{ effectId: 'e1', parent: linked, parentName: 'Goblin' },
		]);
	});

	it('finds each rule type that can name a condition', () => {
		setWorld(
			[],
			[
				item('Hex Bolt', {
					rules: [{ id: 'r1', type: 'applyCondition', condition: 'hexed' }],
				}),
				item('Ward', {
					rules: [{ id: 'r2', type: 'conditionImmunity', conditions: ['hexed', 'prone'] }],
				}),
				item('Hunter Mark', {
					rules: [{ id: 'r3', type: 'markTarget', statusCondition: 'hexed' }],
				}),
			],
		);

		const usage = findConditionUsage('hexed');

		expect(usage.items.map(({ name }) => name)).toEqual(['Hex Bolt', 'Ward', 'Hunter Mark']);
		expect(usage.items[0].ruleIds).toEqual(['r1']);
		expect(usage.items[1].immunityRuleIds).toEqual(['r2']);
		expect(usage.items[2].markTargetRuleIds).toEqual(['r3']);
		expect(usage.items.flatMap(({ referenceLabels }) => referenceLabels)).toEqual([
			'Apply Condition',
			'Condition Immunity',
			'Mark Target',
		]);
	});

	it('finds condition nodes nested in the activation effects tree', () => {
		setWorld(
			[],
			[
				item('Hex Bolt', {
					activation: {
						effects: [
							{
								id: 'd1',
								type: 'damage',
								on: { hit: [conditionNode('c1', 'hexed'), conditionNode('c2', 'prone')] },
							},
						],
					},
				}),
			],
		);

		const usage = findConditionUsage('hexed');

		expect(usage.items).toHaveLength(1);
		expect(usage.items[0].nodeIds).toEqual(['c1']);
		expect(usage.items[0].referenceLabels).toEqual(['NIMBLE.activationEffects.condition']);
	});

	it('names the owning actor for an embedded item, and lists it only once', () => {
		const owner = actor('Wizard', []);
		const owned = item('Hex Bolt', {
			rules: [{ id: 'r1', type: 'applyCondition', condition: 'hexed' }],
		});
		owner.items = [owned];
		// The same document reachable from both collections must not be counted twice.
		setWorld([owner], [owned]);

		const usage = findConditionUsage('hexed');

		expect(usage.items).toHaveLength(1);
		expect(usage.items[0].ownerName).toBe('Wizard');
		expect(usage.total).toBe(1);
	});

	it('reads suppressed effects, which Actor#statuses omits', () => {
		const suppressed = {
			uuid: 'Actor.Cleric',
			name: 'Cleric',
			img: 'icons/cleric.svg',
			items: [],
			statuses: new Set<string>(),
			effects: [],
			allApplicableEffects: () => [
				{ id: 'e9', statuses: new Set(['hexed']), parent: { uuid: 'Item.Amulet', name: 'Amulet' } },
			],
		};
		setWorld([suppressed], []);

		const usage = findConditionUsage('hexed');

		expect(usage.actors[0].effects).toEqual([
			{ effectId: 'e9', parent: { uuid: 'Item.Amulet', name: 'Amulet' }, parentName: 'Amulet' },
		]);
	});
});
