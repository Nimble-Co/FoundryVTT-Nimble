import { describe, expect, it, vi } from 'vitest';
import { deleteEffectNode } from '../deleteEffectNode.js';

function item(effectIds: string[]) {
	return {
		update: vi.fn(async () => undefined),
		deleteEmbeddedDocuments: vi.fn(async () => undefined),
		effects: new Map(effectIds.map((id) => [id, { id }])),
	};
}

const applyEffect = (id: string, effectId: string, parentNode: string | null = null) => ({
	id,
	type: 'applyEffect',
	effectId,
	recipient: 'targets',
	parentNode,
	parentContext: parentNode ? 'failedSave' : null,
});

describe('deleteEffectNode', () => {
	it('deletes the effect on the item with its Apply Effect node', async () => {
		const document = item(['fx']);

		await deleteEffectNode(document as never, [applyEffect('a', 'fx')] as never, 'a');

		expect(document.deleteEmbeddedDocuments).toHaveBeenCalledWith('ActiveEffect', ['fx']);
	});

	it('keeps an effect that another node still points at', async () => {
		const document = item(['fx']);

		await deleteEffectNode(
			document as never,
			[applyEffect('a', 'fx'), applyEffect('b', 'fx')] as never,
			'a',
		);

		expect(document.deleteEmbeddedDocuments).not.toHaveBeenCalled();
	});

	it('deletes the effects of the nodes under a deleted save', async () => {
		const document = item(['fx']);
		const save = {
			id: 'save',
			type: 'savingThrow',
			savingThrowType: 'dexterity',
			on: { failedSave: [applyEffect('a', 'fx', 'save')] },
			parentNode: null,
			parentContext: null,
		};

		await deleteEffectNode(document as never, [save] as never, 'save');

		expect(document.deleteEmbeddedDocuments).toHaveBeenCalledWith('ActiveEffect', ['fx']);
	});
});
