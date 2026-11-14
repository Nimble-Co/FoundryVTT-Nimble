import { describe, expect, it, vi } from 'vitest';
import { deleteItemEffect } from '../deleteItemEffect.ts';

const applyNode = (id: string, effectId: string | null) => ({
	id,
	type: 'applyEffect',
	effectId,
	recipient: 'targets',
	parentContext: null,
	parentNode: null,
});

function itemWith(tree: unknown[], rules: Record<string, unknown>[], effects: unknown[] = []) {
	return {
		system: { activation: { effects: tree }, rules },
		effects: new Map(effects.map((effect) => [(effect as { id: string }).id, effect])),
		update: vi.fn(async () => undefined),
		updateEmbeddedDocuments: vi.fn(async () => []),
		deleteEmbeddedDocuments: vi.fn(async () => []),
	};
}

describe('deleteItemEffect', () => {
	it('clears the nodes and the rule fields that point at the effect, then deletes it', async () => {
		const save = {
			id: 's1',
			type: 'savingThrow',
			parentContext: null,
			parentNode: null,
			on: { failedSave: [applyNode('deep', 'fx')] },
		};
		const item = itemWith(
			[applyNode('top', 'fx'), applyNode('keep', 'other'), save],
			[
				{ id: 'r1', type: 'markTarget', effectId: 'fx', maxTargets: 1 },
				{ id: 'r2', type: 'applyCondition', effectId: 'other' },
			],
		);

		await deleteItemEffect(item, 'fx');

		expect(item.update).toHaveBeenCalledWith({
			'system.activation.effects': [
				applyNode('top', null),
				applyNode('keep', 'other'),
				{ ...save, on: { failedSave: [applyNode('deep', null)] } },
			],
			'system.rules': [
				{ id: 'r1', type: 'markTarget', effectId: '', maxTargets: 1 },
				{ id: 'r2', type: 'applyCondition', effectId: 'other' },
			],
		});
		expect(item.system.activation.effects[0]).toEqual(applyNode('top', 'fx'));
		expect(item.deleteEmbeddedDocuments).toHaveBeenCalledWith('ActiveEffect', ['fx']);
	});

	it('clears the stack effect of another effect that gives it', async () => {
		const dazed = {
			id: 'dazed',
			system: { stacks: { on: true, count: 1, at: 3, effectId: 'fx' } },
		};
		const item = itemWith([], [], [dazed]);

		await deleteItemEffect(item, 'fx');

		expect(item.updateEmbeddedDocuments).toHaveBeenCalledWith('ActiveEffect', [
			{ _id: 'dazed', 'system.stacks.effectId': '' },
		]);
		expect(item.deleteEmbeddedDocuments).toHaveBeenCalledWith('ActiveEffect', ['fx']);
	});

	it('clears rule fields on other effects of the item in one update', async () => {
		const holder = (id: string) => ({
			id,
			system: { rules: [{ id: 'r', type: 'defendOption', attackerEffectId: 'fx' }] },
		});
		const item = itemWith([], [], [holder('a'), holder('b')]);

		await deleteItemEffect(item, 'fx');

		expect(item.update).not.toHaveBeenCalled();
		const cleared = [{ id: 'r', type: 'defendOption', attackerEffectId: '' }];
		expect(item.updateEmbeddedDocuments).toHaveBeenCalledTimes(1);
		expect(item.updateEmbeddedDocuments).toHaveBeenCalledWith('ActiveEffect', [
			{ _id: 'a', 'system.rules': cleared },
			{ _id: 'b', 'system.rules': cleared },
		]);
		expect(item.deleteEmbeddedDocuments).toHaveBeenCalledWith('ActiveEffect', ['fx']);
	});

	it('writes the stored rules, not the prepared ones', async () => {
		const stored = [{ id: 'r1', type: 'markTarget', effectId: 'fx' }];
		const item = Object.assign(
			itemWith([], [{ id: 'r1', type: 'markTarget', effectId: 'fx', maxTargets: 1 }]),
			{ _source: { system: { activation: { effects: [] }, rules: stored } } },
		);

		await deleteItemEffect(item, 'fx');

		expect(item.update).toHaveBeenCalledWith({
			'system.rules': [{ id: 'r1', type: 'markTarget', effectId: '' }],
		});
	});

	it('only deletes an effect that nothing uses', async () => {
		const item = itemWith([applyNode('n', 'other')], []);

		await deleteItemEffect(item, 'fx');

		expect(item.update).not.toHaveBeenCalled();
		expect(item.deleteEmbeddedDocuments).toHaveBeenCalledWith('ActiveEffect', ['fx']);
	});
});
