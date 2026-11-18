import { describe, expect, it } from 'vitest';
import { MigrationBase, type MigrationKind } from '../MigrationBase.js';
import { type PlanRoot, planMigration } from '../planMigration.js';

const PACK_PARRY = 'Compendium.nimble.nimble-monster-abilities.Item.parry0000000001';

function migration(
	version: number,
	kind: MigrationKind,
	hooks: Partial<
		Pick<
			MigrationBase,
			'updateActor' | 'updateItem' | 'updateEffect' | 'updateMessage' | 'alwaysUpdateItem'
		>
	>,
): MigrationBase {
	class TestMigration extends MigrationBase {
		override readonly version = version;

		override readonly title = `Migration ${version}`;

		override readonly kind = kind;
	}
	return Object.assign(new TestMigration(), hooks);
}

function item(id: string, name: string, extra: Record<string, unknown> = {}) {
	return {
		_id: id,
		name,
		type: 'monsterFeature',
		system: { description: 'old' },
		effects: [],
		...extra,
	};
}

function packItem(id: string, name: string) {
	return item(id, name, { _stats: { compendiumSource: PACK_PARRY } });
}

function actorRoot(items: unknown[], extra: Record<string, unknown> = {}): PlanRoot {
	return {
		kind: 'actor',
		uuid: 'Actor.gorm',
		source: { _id: 'gorm', name: 'Gorm', type: 'npc', system: {}, effects: [], items, ...extra },
		holder: { kind: 'actor', actorName: 'Gorm', actorUuid: 'Actor.gorm' },
	};
}

const newDescription = migration(91, 'content', {
	async updateItem(source: any) {
		if (source.name === 'Parry') source.system.description = 'new';
	},
});

describe('planMigration', () => {
	it('lists a Compendium Copy that a migration changes, with the migration that changes it', async () => {
		const plan = await planMigration(
			[actorRoot([packItem('parry', 'Parry'), packItem('claw', 'Claw')])],
			[newDescription],
		);

		expect(plan.copies).toEqual([
			expect.objectContaining({
				uuid: 'Actor.gorm.Item.parry',
				name: 'Parry',
				versions: [91],
				excludable: true,
				matchedByName: false,
			}),
		]);
	});

	it('lists a copy with no compendium id only when a content migration changes it', async () => {
		const weaponType = migration(92, 'structure', {
			async updateItem(source: any) {
				source.system.weaponType ??= '';
			},
		});
		const plan = await planMigration(
			[actorRoot([item('cleaver', 'Cleaver'), item('parry', 'Parry')])],
			[newDescription, weaponType],
		);

		expect(plan.copies).toEqual([
			expect.objectContaining({ name: 'Parry', matchedByName: true, versions: [91, 92] }),
		]);
	});

	it('lists a monster from a pack, but never a character', async () => {
		const resetFlag = migration(93, 'structure', {
			async updateActor(source: any) {
				source.system.flag = true;
			},
		});
		const monster = actorRoot([], {
			_stats: { compendiumSource: 'Compendium.nimble.nimble-monsters.Actor.bandit' },
		});
		const character: PlanRoot = {
			...actorRoot([], {
				type: 'character',
				_stats: { compendiumSource: 'Compendium.nimble.x.Actor.y' },
			}),
			uuid: 'Actor.wren',
		};
		const plan = await planMigration([monster, character], [resetFlag]);

		expect(plan.copies.map((copy) => [copy.uuid, copy.documentName, copy.excludable])).toEqual([
			['Actor.gorm', 'Actor', false],
		]);
		expect(plan.roots.map((root) => root.changed)).toEqual([true, true]);
	});

	it('records which migrations changed each document, for the report counts', async () => {
		const untouched = migration(95, 'structure', {});
		const plan = await planMigration(
			[actorRoot([packItem('parry', 'Parry'), item('bite', 'Bite')])],
			[newDescription, untouched],
		);

		expect(plan.roots[0].versions).toEqual([91]);
	});

	it('never lists a chat message, but plans its change', async () => {
		const cards = migration(94, 'structure', {
			async updateMessage(source: any) {
				source.system.version = 2;
			},
		});
		const message: PlanRoot = {
			kind: 'message',
			uuid: 'ChatMessage.m1',
			source: { _id: 'm1', system: {} },
		};
		const plan = await planMigration([message], [cards]);

		expect(plan.copies).toEqual([]);
		expect(plan.roots[0].after.system.version).toBe(2);
		expect(plan.roots[0].changed).toBe(true);
	});

	describe('a copy the GM keeps out', () => {
		const weaponType = migration(92, 'structure', {
			async updateItem(source: any) {
				source.system.weaponType ??= '';
			},
		});
		const durationMoves = migration(95, 'content', {
			async alwaysUpdateItem(source: any) {
				source.system.duration = 'moved';
			},
			async updateItem(source: any) {
				source.system.rules = ['pack rule'];
			},
		});

		it('skips content changes and keeps structure changes', async () => {
			const plan = await planMigration(
				[actorRoot([packItem('parry', 'Parry')])],
				[newDescription, weaponType, durationMoves],
				{ excluded: new Set(['Actor.gorm.Item.parry']) },
			);

			expect(plan.roots[0].after.items[0].system).toEqual({
				description: 'old',
				weaponType: '',
				duration: 'moved',
			});
		});

		it('keeps an actor out without keeping its Nimble items out', async () => {
			const renameActor = migration(96, 'content', {
				async updateActor(source: any) {
					source.system.packName = 'Bandit';
					source.items.push(item('added', 'Added'));
				},
			});
			const plan = await planMigration(
				[actorRoot([packItem('parry', 'Parry')])],
				[renameActor, newDescription],
				{ excluded: new Set(['Actor.gorm']) },
			);
			const after = plan.roots[0].after;

			expect(after.system).toEqual({});
			expect(after.items.map((entry: any) => [entry._id, entry.system.description])).toEqual([
				['parry', 'new'],
			]);
		});
	});

	it('lists only the copies that an unlinked token holds in its delta', async () => {
		const token: PlanRoot = {
			...actorRoot([packItem('parry', 'Parry'), packItem('own', 'Parry')], {
				_stats: { compendiumSource: 'Compendium.nimble.nimble-monsters.Actor.cobra' },
			}),
			uuid: 'Scene.temple.Token.t1.Actor.cobra',
			holder: { kind: 'token', actorName: 'Cobra Captain', sceneName: 'Sunken Temple' },
			delta: { itemIds: ['own'], effectIds: [] },
		};
		const plan = await planMigration([token], [newDescription]);

		expect(plan.copies.map((copy) => copy.uuid)).toEqual([
			'Scene.temple.Token.t1.Actor.cobra.Item.own',
		]);
	});

	it('records an error with the migration that threw, and goes on', async () => {
		const broken = migration(97, 'content', {
			async updateItem(source: any) {
				if (source._id === 'claw')
					throw new Error("Cannot read properties of undefined (reading 'rules')");
			},
		});
		const plan = await planMigration(
			[actorRoot([packItem('claw', 'Claw'), packItem('parry', 'Parry')])],
			[broken, newDescription],
		);

		expect(plan.errors).toEqual([
			{
				uuid: 'Actor.gorm.Item.claw',
				name: 'Claw',
				version: 97,
				message: "Cannot read properties of undefined (reading 'rules')",
			},
		]);
		expect(plan.roots[0].after.items[1].system.description).toBe('new');
	});
});
