import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';

import { Migration035CommanderCoordinatedStrike } from './migrations/Migration035CommanderCoordinatedStrike.js';

const PACK_ROOT = join(process.cwd(), 'packs/classFeatures/core/commander');

const PACK_FILES = {
	coordinatedStrike: 'commanders-order/coordinated-strike.json',
	masterCommander: 'commander-progression/master-commander.json',
	experiencedCommander: 'commander-subclasses/champion-of-the-vanguard/experienced-commander.json',
	surveyTheBattlefield: 'commander-subclasses/champion-of-the-vanguard/survey-the-battlefield.json',
} as const;

type PackKey = keyof typeof PACK_FILES;

interface PackActivation {
	acquireTargetsFromTemplate: boolean;
	cost: Record<string, unknown>;
	effects: Record<string, unknown>[];
	template: Record<string, unknown>;
}

interface PackDocument {
	_id: string;
	name: string;
	system: {
		class: string;
		rules: unknown[];
		activation: PackActivation;
	};
}

function readPackDocument(key: PackKey): PackDocument {
	return JSON.parse(readFileSync(join(PACK_ROOT, PACK_FILES[key]), 'utf-8')) as PackDocument;
}

/**
 * The reminder placeholder Coordinated Strike shipped before the automation
 * pass: a zero-formula damage node that existed only to hang a note off.
 *
 * The superseded state is history rather than something still on disk, so it is
 * transcribed here. It is also exactly what the migration is allowed to
 * overwrite, which makes it the fixture every guard test varies from.
 */
const SUPERSEDED_DAMAGE_NODE = {
	id: 'YnNEXga2R6LAEvlb',
	type: 'damage',
	damageType: 'acid',
	formula: '0',
	parentContext: null,
	parentNode: null,
	canCrit: false,
	canMiss: false,
	on: {
		hit: [
			{
				id: '0gbDXjqJDZcUxjNB',
				type: 'note',
				noteType: 'reminder',
				text: 'You can do this INT times/Safe Rest.',
				parentContext: 'hit',
				parentNode: 'YnNEXga2R6LAEvlb',
			},
		],
	},
};

const SUPERSEDED_TEMPLATE = { length: 1, radius: 1, shape: 'square', width: 6 };
const SUPERSEDED_COST = { details: '', quantity: 1, type: 'none', isReaction: false };

interface LegacyOverrides {
	name?: string;
	cost?: Record<string, unknown>;
	effects?: Record<string, unknown>[];
	template?: Record<string, unknown>;
	acquireTargetsFromTemplate?: boolean;
}

/** An embedded copy as it existed before the pack gained rules. */
function createLegacyItem(sourceId: string, overrides: LegacyOverrides = {}): any {
	return {
		type: 'feature',
		name: overrides.name ?? 'Legacy Copy',
		system: {
			class: 'commander',
			rules: [],
			activation: {
				acquireTargetsFromTemplate: overrides.acquireTargetsFromTemplate ?? true,
				cost: overrides.cost ?? structuredClone(SUPERSEDED_COST),
				effects: overrides.effects ?? [structuredClone(SUPERSEDED_DAMAGE_NODE)],
				template: overrides.template ?? structuredClone(SUPERSEDED_TEMPLATE),
			},
		},
		_stats: { compendiumSource: sourceId },
	};
}

function compendiumSourceId(packId: string): string {
	return `Compendium.nimble.nimble-class-features.Item.${packId}`;
}

const COORDINATED_STRIKE_ID = '6xpILHYt5KTSnTtd';

describe('Migration035CommanderCoordinatedStrike', () => {
	let migration: Migration035CommanderCoordinatedStrike;

	beforeEach(() => {
		migration = new Migration035CommanderCoordinatedStrike();
	});

	it('should declare version 35', () => {
		expect(Migration035CommanderCoordinatedStrike.version).toBe(35);
		expect(migration.version).toBe(35);
	});

	describe('pack parity', () => {
		const keys = Object.keys(PACK_FILES) as PackKey[];

		it.each(keys)('should produce the pack rules verbatim for %s', async (key) => {
			// arrange
			const pack = readPackDocument(key);
			const item = createLegacyItem(compendiumSourceId(pack._id));

			// act
			await migration.updateItem!(item);

			// assert
			expect(item.system.rules).toEqual(pack.system.rules);
		});

		it('should produce the pack activation cost for coordinated strike', async () => {
			// arrange
			const pack = readPackDocument('coordinatedStrike');
			const item = createLegacyItem(compendiumSourceId(pack._id));

			// act
			await migration.updateItem!(item);

			// assert
			expect(item.system.activation.cost).toEqual(pack.system.activation.cost);
		});

		it('should produce the pack activation effects for coordinated strike', async () => {
			// arrange
			const pack = readPackDocument('coordinatedStrike');
			const item = createLegacyItem(compendiumSourceId(pack._id));

			// act
			await migration.updateItem!(item);

			// assert
			expect(item.system.activation.effects).toEqual(pack.system.activation.effects);
		});

		it('should produce the pack template for coordinated strike', async () => {
			// arrange
			const pack = readPackDocument('coordinatedStrike');
			const item = createLegacyItem(compendiumSourceId(pack._id));

			// act
			await migration.updateItem!(item);

			// assert
			expect(item.system.activation.template).toEqual(pack.system.activation.template);
		});

		it('should produce the pack targeting flag for coordinated strike', async () => {
			// arrange
			const pack = readPackDocument('coordinatedStrike');
			const item = createLegacyItem(compendiumSourceId(pack._id));

			// act
			await migration.updateItem!(item);

			// assert
			expect(item.system.activation.acquireTargetsFromTemplate).toBe(
				pack.system.activation.acquireTargetsFromTemplate,
			);
		});
	});

	describe('idempotency', () => {
		it('should not duplicate rules when run twice', async () => {
			// arrange
			const pack = readPackDocument('coordinatedStrike');
			const item = createLegacyItem(compendiumSourceId(pack._id));

			// act
			await migration.updateItem!(item);
			await migration.updateItem!(item);

			// assert
			expect(item.system.rules).toEqual(pack.system.rules);
		});

		it('should not re-apply the activation changes when run twice', async () => {
			// arrange
			const pack = readPackDocument('coordinatedStrike');
			const item = createLegacyItem(compendiumSourceId(pack._id));

			// act
			await migration.updateItem!(item);
			await migration.updateItem!(item);

			// assert
			expect(item.system.activation.effects).toEqual(pack.system.activation.effects);
			expect(item.system.activation.template).toEqual(pack.system.activation.template);
		});

		it('should leave an already-migrated copy untouched', async () => {
			// arrange
			const pack = readPackDocument('masterCommander');
			const item = createLegacyItem(compendiumSourceId(pack._id));
			item.system.rules = structuredClone(pack.system.rules);

			// act
			await migration.updateItem!(item);

			// assert
			expect(item.system.rules).toEqual(pack.system.rules);
		});

		it('should not re-add a rule a GM already carries under the pack id', async () => {
			// arrange
			const item = createLegacyItem(compendiumSourceId('UOx9MGeTyXGK9iEh'));
			item.system.rules = [{ type: 'modifyPool', id: 'experienced-commander-uses' }];

			// act
			await migration.updateItem!(item);

			// assert
			expect(item.system.rules).toHaveLength(1);
		});
	});

	describe('matching', () => {
		it('should match by class and name when the copy has no source id', async () => {
			// arrange
			const pack = readPackDocument('surveyTheBattlefield');
			const item = createLegacyItem('', { name: pack.name });
			delete item._stats;

			// act
			await migration.updateItem!(item);

			// assert
			expect(item.system.rules).toEqual(pack.system.rules);
		});

		it('should ignore a same-named feature belonging to another class', async () => {
			// arrange
			const pack = readPackDocument('surveyTheBattlefield');
			const item = createLegacyItem('', { name: pack.name });
			delete item._stats;
			item.system.class = 'berserker';

			// act
			await migration.updateItem!(item);

			// assert
			expect(item.system.rules).toEqual([]);
		});

		it('should ignore documents that are not features', async () => {
			// arrange
			const item = createLegacyItem(compendiumSourceId(COORDINATED_STRIKE_ID));
			item.type = 'object';

			// act
			await migration.updateItem!(item);

			// assert
			expect(item.system.rules).toEqual([]);
		});

		it('should ignore unrelated commander features', async () => {
			// arrange
			const item = createLegacyItem(compendiumSourceId('notACommanderFeature'), {
				name: 'Some Other Order',
			});

			// act
			await migration.updateItem!(item);

			// assert
			expect(item.system.rules).toEqual([]);
		});
	});

	describe('activation cost', () => {
		it('should keep a cost a GM has already changed', async () => {
			// arrange
			const custom = { details: '', quantity: 2, type: 'action', isReaction: false };
			const item = createLegacyItem(compendiumSourceId(COORDINATED_STRIKE_ID), { cost: custom });

			// act
			await migration.updateItem!(item);

			// assert
			expect(item.system.activation.cost).toEqual(custom);
		});

		it('should preserve unrelated cost fields while re-stamping', async () => {
			// arrange
			const item = createLegacyItem(compendiumSourceId(COORDINATED_STRIKE_ID), {
				cost: { details: 'Only on your turn', quantity: 1, type: 'none', isReaction: false },
			});

			// act
			await migration.updateItem!(item);

			// assert
			expect(item.system.activation.cost).toEqual({
				details: 'Only on your turn',
				quantity: 0,
				type: 'action',
				isReaction: false,
			});
		});

		it('should not touch the cost of the rules-only features', async () => {
			// arrange
			const item = createLegacyItem(compendiumSourceId('qbrHOGpSY2thczfu'));

			// act
			await migration.updateItem!(item);

			// assert
			expect(item.system.activation.cost).toEqual(SUPERSEDED_COST);
		});
	});

	describe('activation effects', () => {
		it('should drop the zero-damage node that emits a damage packet on every card', async () => {
			// arrange
			const item = createLegacyItem(compendiumSourceId(COORDINATED_STRIKE_ID));

			// act
			await migration.updateItem!(item);

			// assert
			expect(item.system.activation.effects).toHaveLength(1);
			expect(item.system.activation.effects[0].type).toBe('note');
		});

		it('should keep a damage node a GM has edited', async () => {
			// arrange
			const edited = structuredClone(SUPERSEDED_DAMAGE_NODE);
			edited.formula = '2d6';
			const item = createLegacyItem(compendiumSourceId(COORDINATED_STRIKE_ID), {
				effects: [edited],
			});

			// act
			await migration.updateItem!(item);

			// assert
			expect(item.system.activation.effects).toEqual([edited]);
		});

		it('should keep the node when a GM has reworded the nested reminder', async () => {
			// arrange
			const edited = structuredClone(SUPERSEDED_DAMAGE_NODE);
			edited.on.hit[0].text = 'Remember to ask the table who is in range.';
			const item = createLegacyItem(compendiumSourceId(COORDINATED_STRIKE_ID), {
				effects: [edited],
			});

			// act
			await migration.updateItem!(item);

			// assert
			expect(item.system.activation.effects).toEqual([edited]);
		});

		it('should keep the node when a GM has added a second reminder beneath it', async () => {
			// arrange
			const edited = structuredClone(SUPERSEDED_DAMAGE_NODE);
			edited.on.hit.push({
				id: 'gmAddedNote000001',
				type: 'note',
				noteType: 'reminder',
				text: 'House rule: allies must be adjacent.',
				parentContext: 'hit',
				parentNode: 'YnNEXga2R6LAEvlb',
			});
			const item = createLegacyItem(compendiumSourceId(COORDINATED_STRIKE_ID), {
				effects: [edited],
			});

			// act
			await migration.updateItem!(item);

			// assert
			expect(item.system.activation.effects).toEqual([edited]);
		});

		it('should preserve nodes a GM added alongside ours, and their order', async () => {
			// arrange
			const pack = readPackDocument('coordinatedStrike');
			const gmNode = {
				id: 'gmAddedNode00001',
				type: 'note',
				noteType: 'reminder',
				text: 'House rule: allies must be adjacent.',
				parentContext: null,
				parentNode: null,
			};
			const item = createLegacyItem(compendiumSourceId(COORDINATED_STRIKE_ID), {
				effects: [gmNode, structuredClone(SUPERSEDED_DAMAGE_NODE)],
			});

			// act
			await migration.updateItem!(item);

			// assert
			expect(item.system.activation.effects).toEqual([gmNode, pack.system.activation.effects[0]]);
		});

		it('should not touch the effects of the rules-only features', async () => {
			// arrange
			const item = createLegacyItem(compendiumSourceId('qbrHOGpSY2thczfu'));

			// act
			await migration.updateItem!(item);

			// assert
			expect(item.system.activation.effects).toEqual([SUPERSEDED_DAMAGE_NODE]);
		});
	});

	describe('activation template', () => {
		it('should keep a template a GM has reshaped', async () => {
			// arrange
			const custom = { length: 1, radius: 6, shape: 'emanation', width: 1 };
			const item = createLegacyItem(compendiumSourceId(COORDINATED_STRIKE_ID), {
				template: custom,
			});

			// act
			await migration.updateItem!(item);

			// assert
			expect(item.system.activation.template).toEqual(custom);
			expect(item.system.activation.acquireTargetsFromTemplate).toBe(true);
		});

		it('should still clear the stray shape when a GM has only cleared the targeting flag', async () => {
			// arrange
			const pack = readPackDocument('coordinatedStrike');
			const item = createLegacyItem(compendiumSourceId(COORDINATED_STRIKE_ID), {
				acquireTargetsFromTemplate: false,
			});

			// act
			await migration.updateItem!(item);

			// assert
			expect(item.system.activation.template).toEqual(pack.system.activation.template);
		});

		it('should not touch the template of the rules-only features', async () => {
			// arrange
			const item = createLegacyItem(compendiumSourceId('qbrHOGpSY2thczfu'));

			// act
			await migration.updateItem!(item);

			// assert
			expect(item.system.activation.template).toEqual(SUPERSEDED_TEMPLATE);
			expect(item.system.activation.acquireTargetsFromTemplate).toBe(true);
		});
	});
});
