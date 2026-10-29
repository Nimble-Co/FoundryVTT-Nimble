import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MonsterDocument } from '../monsterAdapter.ts';
import type { MonsterIntent } from '../monsterIntent.ts';

const endToggleEffectFromAE = vi.fn();

let createMonsterPerform: typeof import('../monsterPerform.ts').createMonsterPerform;

beforeAll(async () => {
	vi.resetModules();
	vi.doMock('#utils/actor/toggleEffectControl.js', () => ({ endToggleEffectFromAE }));
	({ createMonsterPerform } = await import('../monsterPerform.ts'));
});

const ACTOR_METHODS = [
	'setCurrentHP',
	'setTempHP',
	'update',
	'rollSavingThrowToChat',
	'activateItem',
	'setFlag',
	'toggleStatusEffect',
	'deleteEmbeddedDocuments',
	'updateEmbeddedDocuments',
] as const;

const featureEffect = { id: 'featureEffect', delete: vi.fn() };
const stab = {
	id: 'stab',
	sheet: { render: vi.fn() },
	effects: new Map([[featureEffect.id, featureEffect]]),
};
const bless = { id: 'bless', statuses: new Set<string>(), delete: vi.fn() };
const actorEffects = new Map([[bless.id, bless]]);

function mockActor() {
	const actor: Record<string, unknown> = {
		id: 'goblin',
		items: { get: (id: string) => (id === stab.id ? stab : undefined) },
		effects: Object.assign([...actorEffects.values()], {
			get: (id: string) => actorEffects.get(id),
		}),
		allApplicableEffects: () => [...actorEffects.values(), featureEffect],
	};
	for (const method of ACTOR_METHODS) actor[method] = vi.fn();
	return actor as Record<(typeof ACTOR_METHODS)[number], ReturnType<typeof vi.fn>>;
}

let actor: ReturnType<typeof mockActor>;
const sheet = { dropItem: vi.fn() };
const perform = (intent: MonsterIntent) =>
	createMonsterPerform(actor as unknown as MonsterDocument, sheet)(intent);

beforeEach(() => {
	actor = mockActor();
	vi.clearAllMocks();
});

describe('createMonsterPerform', () => {
	it.each([
		[{ kind: 'setHp', value: 7 }, 'setCurrentHP', [7]],
		[{ kind: 'setTempHp', value: 3 }, 'setTempHP', [3]],
		[{ kind: 'rollSave', save: 'dexterity' }, 'rollSavingThrowToChat', ['dexterity']],
		[{ kind: 'activate', itemId: 'stab' }, 'activateItem', ['stab']],
		[{ kind: 'setCurrency', coin: 'gp', value: 15 }, 'update', [{ 'system.currency.gp': 15 }]],
		[
			{ kind: 'setFlag', flag: 'actorImageScale', value: 120 },
			'setFlag',
			['nimble', 'actorImageScale', 120],
		],
		[
			{ kind: 'setFlag', flag: 'automaticallyExecuteAvailableMacros', value: false },
			'setFlag',
			['nimble', 'automaticallyExecuteAvailableMacros', false],
		],
	] as [MonsterIntent, (typeof ACTOR_METHODS)[number], unknown[]][])(
		'%o calls %s',
		async (intent, method, args) => {
			await perform(intent);

			expect(actor[method]).toHaveBeenCalledWith(...args);
		},
	);

	it('opens the window of an item', async () => {
		await perform({ kind: 'openItem', itemId: 'stab' });

		expect(stab.sheet.render).toHaveBeenCalledWith(true);
	});

	it('saves the new order in one update, and moves only the dragged action to its sequence', async () => {
		await perform({
			kind: 'reorder',
			updates: [
				{ itemId: 'sequence', sort: 0 },
				{ itemId: 'stab', sort: 10000, parentItemId: 'sequence' },
				{ itemId: 'shoot', sort: 20000 },
			],
		});

		expect(actor.updateEmbeddedDocuments).toHaveBeenCalledOnce();
		expect(actor.updateEmbeddedDocuments).toHaveBeenCalledWith('Item', [
			{ _id: 'sequence', sort: 0 },
			{ _id: 'stab', sort: 10000, 'system.parentItemId': 'sequence' },
			{ _id: 'shoot', sort: 20000 },
		]);
	});

	it('takes an action out of its sequence with a null parent', async () => {
		await perform({
			kind: 'reorder',
			updates: [{ itemId: 'stab', sort: 0, parentItemId: null }],
		});

		expect(actor.updateEmbeddedDocuments).toHaveBeenCalledWith('Item', [
			{ _id: 'stab', sort: 0, 'system.parentItemId': null },
		]);
	});

	it('sends a dropped item to the drop route of the sheet', async () => {
		const data = { type: 'Item', uuid: 'Compendium.nimble.monsterFeatures.Item.bite' };
		await perform({ kind: 'dropItem', data });

		expect(sheet.dropItem).toHaveBeenCalledWith(data);
	});

	it('ends a toggle effect through the toggle lifecycle', async () => {
		await perform({ kind: 'endEffect', effectId: 'bless' });

		expect(endToggleEffectFromAE).toHaveBeenCalledWith(actor, bless);
	});

	it('removes an effect of the monster, and an effect that an item holds', async () => {
		await perform({ kind: 'removeEffect', effectId: 'bless', itemId: null });
		await perform({ kind: 'removeEffect', effectId: 'featureEffect', itemId: 'stab' });

		expect(bless.delete).toHaveBeenCalledOnce();
		expect(featureEffect.delete).toHaveBeenCalledOnce();
	});

	it('turns a condition on and off through toggleStatusEffect', async () => {
		await perform({ kind: 'setCondition', conditionId: 'dazed', active: true });
		await perform({ kind: 'setCondition', conditionId: 'dazed', active: false });

		expect(actor.toggleStatusEffect).toHaveBeenNthCalledWith(1, 'dazed', { active: true });
		expect(actor.toggleStatusEffect).toHaveBeenNthCalledWith(2, 'dazed', { active: false });
	});
});
