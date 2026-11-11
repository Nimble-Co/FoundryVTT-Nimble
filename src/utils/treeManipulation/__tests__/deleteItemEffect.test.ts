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

	it('clears a rule field on another effect of the item', async () => {
		const holder = {
			id: 'holder',
			system: { rules: [{ id: 'r', type: 'defendOption', attackerEffectId: 'fx' }] },
			update: vi.fn(async () => undefined),
		};
		const item = itemWith([], [], [holder]);

		await deleteItemEffect(item, 'fx');

		expect(item.update).not.toHaveBeenCalled();
		expect(holder.update).toHaveBeenCalledWith({
			'system.rules': [{ id: 'r', type: 'defendOption', attackerEffectId: '' }],
		});
		expect(item.deleteEmbeddedDocuments).toHaveBeenCalledWith('ActiveEffect', ['fx']);
	});

	it('only deletes an effect that nothing uses', async () => {
		const item = itemWith([applyNode('n', 'other')], []);

		await deleteItemEffect(item, 'fx');

		expect(item.update).not.toHaveBeenCalled();
		expect(item.deleteEmbeddedDocuments).toHaveBeenCalledWith('ActiveEffect', ['fx']);
	});
});
