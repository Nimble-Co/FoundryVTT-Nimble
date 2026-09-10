import { afterEach, describe, expect, it, vi } from 'vitest';

import type { ResolvedSwappableOptionPool } from '#types/optionSwap.d.ts';
import { NimbleCharacter } from './character.js';

interface HistoryEntry {
	level: number;
	grantedFeatureIds: string[];
}

/**
 * A real instance, not a plain object: the rollback path is a private method, and a private
 * method rejects any receiver the constructor did not brand.
 */
function makeCharacter(levelUpHistory: HistoryEntry[], itemIds: string[] = []) {
	// Each item is a feature whose source is the pool member its id names, as on a real sheet.
	const store = new Map(
		itemIds.map((id) => [
			id,
			{
				id,
				type: 'feature',
				_stats: { compendiumSource: `uuid:${id.replace(/^item-/, '')}` },
				toObject: () => ({ _id: id, name: id }),
			},
		]),
	);
	const items = {
		get: (id: string) => store.get(id),
		[Symbol.iterator]: () => store.values(),
	};
	const character = new NimbleCharacter({
		_id: 'actor-1',
		type: 'character',
		system: { attributes: { hp: { value: 10, max: 10, temp: 0 } } },
	} as never);

	return Object.assign(character, {
		system: { levelUpHistory },
		items,
		createEmbeddedDocuments: vi.fn(async (_type: string, sources: Array<{ name: string }>) =>
			sources.map((source, position) => ({ id: `granted-${position}`, name: source.name })),
		),
		deleteEmbeddedDocuments: vi.fn(async (_type: string, ids: string[]) => {
			const removed = ids.map((id) => store.get(id));
			for (const id of ids) store.delete(id);
			return removed;
		}),
		update: vi.fn(async (_updates: Record<string, unknown>) => undefined),
		sheet: { render: vi.fn() },
	});
}

/** A two pick Berserker pool holding Rampage and Whirlwind. */
function pool(overrides: Partial<ResolvedSwappableOptionPool> = {}): ResolvedSwappableOptionPool {
	const heldCount = overrides.heldCount ?? 2;
	return {
		poolKey: 'savage-arsenal',
		poolGroups: ['savage-arsenal'],
		displayName: 'Savage Arsenal',
		optionLabel: 'Choose a Savage Arsenal Ability',
		levels: [4, 6],
		heldCount,
		// The levels grant what the character holds unless a case says otherwise.
		grantedCount: heldCount,
		slots: [],
		candidateUuids: ['uuid:rampage', 'uuid:whirlwind', 'uuid:death-blow'],
		heldIdsByUuid: new Map([
			['uuid:rampage', ['item-rampage']],
			['uuid:whirlwind', ['item-whirlwind']],
		]),
		repeatableUuids: [],
		candidates: [
			{ uuid: 'uuid:rampage', name: 'Rampage' },
			{ uuid: 'uuid:whirlwind', name: 'Whirlwind' },
			{ uuid: 'uuid:death-blow', name: 'Death Blow' },
		] as ResolvedSwappableOptionPool['candidates'],
		...overrides,
	};
}

function stubFromUuid(namesByUuid: Record<string, string>) {
	const globals = globalThis as unknown as { fromUuid?: (uuid: string) => Promise<unknown> };
	const original = globals.fromUuid;

	globals.fromUuid = async (uuid: string) => {
		const name = namesByUuid[uuid];
		if (!name) return null;
		return { toObject: () => ({ name, _stats: {} }) };
	};

	return () => {
		globals.fromUuid = original;
	};
}

function notifications() {
	const globals = globalThis as unknown as {
		ui: { notifications: { warn: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> } };
	};
	return globals.ui.notifications;
}

function warn() {
	return notifications().warn;
}

function error() {
	return notifications().error;
}

/** The level-up history a swap wrote, or undefined when it wrote nothing. */
function historyWritten(character: ReturnType<typeof makeCharacter>): HistoryEntry[] | undefined {
	const updates = character.update.mock.calls[0]?.[0];
	return updates?.['system.levelUpHistory'] as HistoryEntry[] | undefined;
}

function applySwap(
	character: ReturnType<typeof makeCharacter>,
	pools: ResolvedSwappableOptionPool[],
	selections: Map<string, string[]>,
	skillPoints: Map<string, number> = new Map(),
) {
	return NimbleCharacter.prototype.applyOptionSwap.call(character, pools, selections, skillPoints);
}

describe('applyOptionSwap', () => {
	let restoreFromUuid: (() => void) | null = null;

	afterEach(() => {
		restoreFromUuid?.();
		restoreFromUuid = null;
		vi.restoreAllMocks();
	});

	it('replaces a released pick that no entry names and records the replacement nowhere', async () => {
		restoreFromUuid = stubFromUuid({ 'uuid:death-blow': 'Death Blow' });
		// No entry names item-rampage, so its replacement has no entry to inherit.
		const character = makeCharacter(
			[{ level: 6, grantedFeatureIds: ['item-whirlwind'] }],
			['item-rampage', 'item-whirlwind'],
		);

		const plan = await applySwap(
			character,
			[pool()],
			new Map([['savage-arsenal', ['uuid:whirlwind', 'uuid:death-blow']]]),
		);

		expect(plan?.deleteItemIds).toEqual(['item-rampage']);
		expect(character.createEmbeddedDocuments).toHaveBeenCalledOnce();
		expect(character.deleteEmbeddedDocuments).toHaveBeenCalledWith('Item', ['item-rampage']);
		expect(historyWritten(character)).toEqual([
			{ level: 6, grantedFeatureIds: ['item-whirlwind'] },
		]);
		expect(warn()).not.toHaveBeenCalled();
	});

	it('puts the replacement where the released pick sat in its entry', async () => {
		restoreFromUuid = stubFromUuid({ 'uuid:death-blow': 'Death Blow' });
		const character = makeCharacter(
			[
				{ level: 4, grantedFeatureIds: ['item-rampage', 'other'] },
				{ level: 6, grantedFeatureIds: ['item-whirlwind'] },
			],
			['item-rampage', 'item-whirlwind'],
		);

		await applySwap(
			character,
			[pool()],
			new Map([['savage-arsenal', ['uuid:whirlwind', 'uuid:death-blow']]]),
		);

		expect(historyWritten(character)).toEqual([
			{ level: 4, grantedFeatureIds: ['granted-0', 'other'] },
			{ level: 6, grantedFeatureIds: ['item-whirlwind'] },
		]);
	});

	it('fills a pool below its granted count without deleting or touching the history', async () => {
		restoreFromUuid = stubFromUuid({ 'uuid:death-blow': 'Death Blow' });
		const character = makeCharacter(
			[{ level: 4, grantedFeatureIds: ['item-rampage'] }],
			['item-rampage'],
		);

		const plan = await applySwap(
			character,
			[
				pool({
					heldCount: 1,
					grantedCount: 2,
					heldIdsByUuid: new Map([['uuid:rampage', ['item-rampage']]]),
				}),
			],
			new Map([['savage-arsenal', ['uuid:rampage', 'uuid:death-blow']]]),
		);

		expect(plan?.deleteItemIds).toEqual([]);
		expect(character.createEmbeddedDocuments).toHaveBeenCalledOnce();
		expect(character.deleteEmbeddedDocuments).not.toHaveBeenCalled();
		expect(historyWritten(character)).toEqual([{ level: 4, grantedFeatureIds: ['item-rampage'] }]);
	});

	it('plans against what the sheet holds now, so a pick that left since the window opened is filled, not released', async () => {
		restoreFromUuid = stubFromUuid({ 'uuid:death-blow': 'Death Blow' });
		// item-rampage left the sheet after the window opened. The window was shown two of two;
		// the sheet holds one of two, so the same selection is now a fill.
		const character = makeCharacter(
			[
				{ level: 4, grantedFeatureIds: ['item-rampage'] },
				{ level: 6, grantedFeatureIds: ['item-whirlwind'] },
			],
			['item-whirlwind'],
		);

		const plan = await applySwap(
			character,
			[pool()],
			new Map([['savage-arsenal', ['uuid:whirlwind', 'uuid:death-blow']]]),
		);

		expect(plan?.pools[0]?.heldCount).toBe(1);
		expect(plan?.deleteItemIds).toEqual([]);
		expect(character.deleteEmbeddedDocuments).not.toHaveBeenCalled();
		expect(character.createEmbeddedDocuments).toHaveBeenCalledOnce();
		// A fill vacates no entry, so the dead id stays where it was and the new item is untracked.
		expect(historyWritten(character)).toEqual([
			{ level: 4, grantedFeatureIds: ['item-rampage'] },
			{ level: 6, grantedFeatureIds: ['item-whirlwind'] },
		]);
		expect(error()).not.toHaveBeenCalled();
	});

	it('releases only what the sheet holds now', async () => {
		restoreFromUuid = stubFromUuid({ 'uuid:death-blow': 'Death Blow' });
		const character = makeCharacter(
			[
				{ level: 4, grantedFeatureIds: ['item-rampage'] },
				{ level: 6, grantedFeatureIds: ['item-whirlwind'] },
			],
			['item-whirlwind'],
		);

		const plan = await applySwap(
			character,
			[pool()],
			new Map([['savage-arsenal', ['uuid:death-blow', 'uuid:death-blow']]]),
		);

		expect(plan?.deleteItemIds).toEqual(['item-whirlwind']);
		expect(character.deleteEmbeddedDocuments).toHaveBeenCalledWith('Item', ['item-whirlwind']);
		expect(historyWritten(character)).toEqual([
			{ level: 4, grantedFeatureIds: ['item-rampage'] },
			{ level: 6, grantedFeatureIds: ['granted-0'] },
		]);
	});

	it('writes nothing and does not re-render when the selection matches the picks', async () => {
		restoreFromUuid = stubFromUuid({});
		const character = makeCharacter(
			[
				{ level: 4, grantedFeatureIds: ['item-rampage'] },
				{ level: 6, grantedFeatureIds: ['item-whirlwind'] },
			],
			['item-rampage', 'item-whirlwind'],
		);

		const plan = await applySwap(
			character,
			[pool()],
			new Map([['savage-arsenal', ['uuid:rampage', 'uuid:whirlwind']]]),
		);

		expect(plan).toMatchObject({ deleteItemIds: [], grants: [], changedPoolKeys: [] });
		expect(character.createEmbeddedDocuments).not.toHaveBeenCalled();
		expect(character.deleteEmbeddedDocuments).not.toHaveBeenCalled();
		expect(character.update).not.toHaveBeenCalled();
		expect(character.sheet.render).not.toHaveBeenCalled();
		expect(warn()).not.toHaveBeenCalled();
	});

	it('reports a grant that throws and leaves the character as it was', async () => {
		restoreFromUuid = stubFromUuid({ 'uuid:death-blow': 'Death Blow' });
		const character = makeCharacter(
			[
				{ level: 4, grantedFeatureIds: ['item-rampage'] },
				{ level: 6, grantedFeatureIds: ['item-whirlwind'] },
			],
			['item-rampage', 'item-whirlwind'],
		);
		character.createEmbeddedDocuments = vi.fn(async () => {
			throw new Error('grant rejected');
		});
		const logged = vi.spyOn(console, 'error').mockImplementation(() => {});

		const plan = await applySwap(
			character,
			[pool()],
			new Map([['savage-arsenal', ['uuid:whirlwind', 'uuid:death-blow']]]),
		);

		expect(plan).toBeNull();
		expect(character.deleteEmbeddedDocuments).not.toHaveBeenCalled();
		expect(character.update).not.toHaveBeenCalled();
		expect(character.sheet.render).not.toHaveBeenCalled();
		expect(error()).toHaveBeenCalledOnce();
		expect(error().mock.calls[0][0]).toMatch(/put back as they were/);
		expect(logged).toHaveBeenCalledOnce();
	});
});
