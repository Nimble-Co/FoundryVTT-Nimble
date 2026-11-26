import { afterEach, describe, expect, it, vi } from 'vitest';

import { NimbleCharacter } from '../character.js';

const FIRST = 'Compendium.nimble.nimble-class-features.Item.first';
const SECOND = 'Compendium.nimble.nimble-class-features.Item.second';

function makeCharacter() {
	const held = new Map<string, { id: string; type: string }>([
		['keen', { id: 'keen', type: 'feature' }],
		['throat', { id: 'throat', type: 'feature' }],
	]);
	const calls: string[] = [];

	const items = {
		get: (id: string) => held.get(id),
		filter: (predicate: (item: { id: string; type: string }) => boolean) =>
			[...held.values()].filter(predicate),
		[Symbol.iterator]: () => held.values(),
	};

	return {
		calls,
		system: {
			levelUpHistory: [
				{
					level: 2,
					hpIncrease: 4,
					abilityIncreases: {},
					skillIncreases: {},
					hitDieAdded: false,
					classIdentifier: 'hunter',
					grantedFeatureIds: [],
					grantedSpellIds: [],
					releasedFeatures: [],
				},
				{
					level: 3,
					hpIncrease: 5,
					abilityIncreases: {},
					skillIncreases: {},
					hitDieAdded: false,
					classIdentifier: 'hunter',
					grantedFeatureIds: ['keen', 'throat'],
					grantedSpellIds: [],
					releasedFeatures: [
						{ uuid: FIRST, level: 2 },
						{ uuid: SECOND, level: 2 },
					],
				},
			],
			attributes: { hp: { value: 20 }, hitDice: {} },
			skills: {},
			classData: { levels: ['hunter', 'hunter', 'hunter'] },
		},
		classes: {
			hunter: {
				id: 'class-1',
				system: { classLevel: 3, hitDieSize: 8, hpData: [6, 4, 5] },
			},
		},
		items,
		deleteEmbeddedDocuments: vi.fn(async (_type: string, ids: string[]) => {
			calls.push(`delete:${ids.join(',')}`);
			for (const id of ids) held.delete(id);
		}),
		createEmbeddedDocuments: vi.fn(async (_type: string, sources: Array<{ name: string }>) => {
			calls.push(`create:${sources.map((source) => source.name).join(',')}`);
			return sources.map((_source, index) => {
				const id = `restored-${index}`;
				held.set(id, { id, type: 'feature' });
				return { id };
			});
		}),
		updateItem: vi.fn(async () => undefined),
		update: vi.fn(async () => undefined),
	};
}

function stubFromUuid() {
	const g = globalThis as unknown as { fromUuid?: (uuid: string) => Promise<unknown> };
	const original = g.fromUuid;
	g.fromUuid = async (uuid: string) => ({
		toObject: () => ({ name: uuid, _stats: {} }),
	});
	return () => {
		g.fromUuid = original;
	};
}

describe('revertLastLevelUp released features', () => {
	let restoreFromUuid: (() => void) | null = null;

	afterEach(() => {
		restoreFromUuid?.();
		restoreFromUuid = null;
	});

	it('restores the released picks onto their original level before deleting this level', async () => {
		restoreFromUuid = stubFromUuid();
		const character = makeCharacter();

		await NimbleCharacter.prototype.revertLastLevelUp.call(character as unknown as NimbleCharacter);

		expect(character.calls[0]).toBe(`create:${FIRST},${SECOND}`);
		expect(character.calls).toContain('delete:keen,throat');
		expect(character.calls.indexOf(`create:${FIRST},${SECOND}`)).toBeLessThan(
			character.calls.indexOf('delete:keen,throat'),
		);
		expect(character.update).toHaveBeenCalledWith(
			expect.objectContaining({
				'system.levelUpHistory': [
					expect.objectContaining({
						level: 2,
						grantedFeatureIds: ['restored-0', 'restored-1'],
					}),
				],
			}),
		);
		expect(character.createEmbeddedDocuments).toHaveBeenCalledWith('Item', [
			{ name: FIRST, _stats: { compendiumSource: FIRST } },
			{ name: SECOND, _stats: { compendiumSource: SECOND } },
		]);
	});
});
