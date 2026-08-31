import { afterEach, describe, expect, it, vi } from 'vitest';

import { NimbleCharacter } from './character.js';

interface HistoryEntry {
	level: number;
	grantedFeatureIds: string[];
}

function makeCharacter(levelUpHistory: HistoryEntry[]) {
	return {
		system: { levelUpHistory },
		createEmbeddedDocuments: vi.fn(async (_type: string, sources: Array<{ name: string }>) =>
			sources.map((source, position) => ({ id: `granted-${position}`, name: source.name })),
		),
		update: vi.fn(async () => undefined),
		sheet: { render: vi.fn() },
	};
}

function stubFromUuid(namesByUuid: Record<string, string>) {
	const g = globalThis as unknown as { fromUuid?: (uuid: string) => Promise<unknown> };
	const original = g.fromUuid;

	g.fromUuid = async (uuid: string) => {
		const name = namesByUuid[uuid];
		if (!name) return null;
		return { toObject: () => ({ name, _stats: {} }) };
	};

	return () => {
		g.fromUuid = original;
	};
}

function applyCorrection(
	character: ReturnType<typeof makeCharacter>,
	selections: Array<{ level: number; uuids: string[] }>,
) {
	return NimbleCharacter.prototype.applyLevelCorrection.call(
		character as unknown as NimbleCharacter,
		selections,
	);
}

describe('applyLevelCorrection', () => {
	let restoreFromUuid: (() => void) | null = null;

	afterEach(() => {
		restoreFromUuid?.();
		restoreFromUuid = null;
	});

	it('records each grant on the history entry for the level that owed it', async () => {
		restoreFromUuid = stubFromUuid({
			'Item.light-bearer': 'Light Bearer',
			'Item.thicker-fur': 'Thicker Fur',
		});
		const character = makeCharacter([
			{ level: 5, grantedFeatureIds: ['existing-5'] },
			{ level: 9, grantedFeatureIds: [] },
		]);

		await applyCorrection(character, [
			{ level: 5, uuids: ['Item.light-bearer'] },
			{ level: 9, uuids: ['Item.thicker-fur'] },
		]);

		expect(character.update).toHaveBeenCalledWith({
			'system.levelUpHistory': [
				{ level: 5, grantedFeatureIds: ['existing-5', 'granted-0'] },
				{ level: 9, grantedFeatureIds: ['granted-1'] },
			],
		});
	});

	it('stamps the compendium source on every granted feature', async () => {
		restoreFromUuid = stubFromUuid({ 'Item.light-bearer': 'Light Bearer' });
		const character = makeCharacter([{ level: 5, grantedFeatureIds: [] }]);

		await applyCorrection(character, [{ level: 5, uuids: ['Item.light-bearer'] }]);

		expect(character.createEmbeddedDocuments).toHaveBeenCalledWith('Item', [
			{ name: 'Light Bearer', _stats: { compendiumSource: 'Item.light-bearer' } },
		]);
	});

	it('leaves the actor untouched when nothing was picked', async () => {
		restoreFromUuid = stubFromUuid({});
		const character = makeCharacter([{ level: 5, grantedFeatureIds: [] }]);

		await applyCorrection(character, [{ level: 5, uuids: [] }]);

		expect(character.createEmbeddedDocuments).not.toHaveBeenCalled();
		expect(character.update).not.toHaveBeenCalled();
	});

	/**
	 * Level 1 predates the first history entry, so there is nothing to record against. The
	 * feature is still granted — a level-down can never reach level 1 to need it reverted.
	 */
	it('grants a level-1 correction without a history entry to record it on', async () => {
		restoreFromUuid = stubFromUuid({ 'Item.light-bearer': 'Light Bearer' });
		const character = makeCharacter([{ level: 2, grantedFeatureIds: ['existing-2'] }]);

		await applyCorrection(character, [{ level: 1, uuids: ['Item.light-bearer'] }]);

		expect(character.createEmbeddedDocuments).toHaveBeenCalledOnce();
		expect(character.update).toHaveBeenCalledWith({
			'system.levelUpHistory': [{ level: 2, grantedFeatureIds: ['existing-2'] }],
		});
	});
});
