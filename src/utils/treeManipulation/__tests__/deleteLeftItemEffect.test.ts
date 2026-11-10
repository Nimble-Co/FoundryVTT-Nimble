import { describe, expect, it, vi } from 'vitest';
import { deleteLeftItemEffect } from '../deleteLeftItemEffect.ts';

function itemWith(effect: Record<string, unknown>) {
	return {
		name: 'Frost Shield',
		img: 'frost.svg',
		effects: { get: (id: string) => (id === 'old' ? effect : undefined) },
		deleteEmbeddedDocuments: vi.fn(async () => []),
	};
}

const asMade = () => ({
	name: 'Frost Shield',
	img: 'frost.svg',
	description: '',
	statuses: new Set(),
	system: { changes: [], rules: [], lastsUntil: [], escape: { dc: '' } },
});

const applyNode = (effectId: string) => ({
	id: `n-${effectId}`,
	type: 'applyEffect',
	effectId,
	recipient: 'targets',
	parentContext: null,
	parentNode: null,
});

describe('deleteLeftItemEffect', () => {
	it('deletes the effect a new node made, when no node points at it now', async () => {
		const item = itemWith(asMade());

		await deleteLeftItemEffect(item, [applyNode('new')] as never, 'old');

		expect(item.deleteEmbeddedDocuments).toHaveBeenCalledWith('ActiveEffect', ['old']);
	});

	it('keeps an effect that another node still uses', async () => {
		const item = itemWith(asMade());

		await deleteLeftItemEffect(item, [applyNode('new'), applyNode('old')] as never, 'old');

		expect(item.deleteEmbeddedDocuments).not.toHaveBeenCalled();
	});

	it('keeps an effect that the author changed', async () => {
		const changed = [
			{ ...asMade(), name: 'Shield of Ice' },
			{ ...asMade(), statuses: new Set(['slowed']) },
			{ ...asMade(), system: { ...asMade().system, lastsUntil: [{ kind: 'turn' }] } },
			{ ...asMade(), description: '<p>Cold.</p>' },
		];
		for (const effect of changed) {
			const item = itemWith(effect);
			await deleteLeftItemEffect(item, [applyNode('new')] as never, 'old');
			expect(item.deleteEmbeddedDocuments).not.toHaveBeenCalled();
		}
	});
});
