import { describe, expect, it } from 'vitest';
import { SYSTEM_ID } from '#system';
import { emptyPartyInventory } from '../../../settings/partyInventorySetting.ts';
import {
	ensurePartyInventoryHolder,
	hidePartyInventoryHolder,
	partyInventoryIdentity,
	partyInventoryReplacement,
	partyInventoryStoredName,
} from '../partyInventoryHolder.ts';

const world = game as unknown as { actors: unknown; user: unknown };
const torch = { _id: 'torch', type: 'object', name: 'Torch', system: { quantity: 2 } };

describe('hidePartyInventoryHolder', () => {
	it('leaves the party inventory actor out of the actors sidebar', () => {
		const previous = world.actors;
		const hero = { name: 'Ada', getFlag: () => undefined };
		const holder = {
			name: 'Party Inventory',
			getFlag: (scope: string, key: string) =>
				scope === SYSTEM_ID && key === 'partyInventoryHolder',
		};
		const contents = [hero, holder];
		const collection = {
			shown: contents,
			_getVisibleTreeContents: () => contents,
			initializeTree() {
				this.shown = this._getVisibleTreeContents();
			},
		};
		world.actors = collection;
		try {
			hidePartyInventoryHolder();
			expect(collection.shown).toEqual([hero]);
			collection.initializeTree();
			expect(collection.shown).toEqual([hero]);
		} finally {
			world.actors = previous;
		}
	});
});

describe('partyInventoryReplacement', () => {
	it('creates a party inventory actor from the setting when none exists', () => {
		expect(
			partyInventoryReplacement(
				null,
				{ currency: { gp: 4, sp: 0, cp: 0 }, items: [torch] },
				{ default: 3 },
			),
		).toEqual({
			name: 'Party Inventory',
			type: 'partyInventory',
			ownership: { default: 3 },
			flags: {
				[SYSTEM_ID]: {
					partyInventoryHolder: true,
					partyInventory: { currency: { gp: 4, sp: 0, cp: 0 }, items: [torch] },
				},
			},
		});
	});

	it('copies the inventory and ownership off a creature holder, without its creature data', () => {
		const replacement = partyInventoryReplacement(
			{
				type: 'npc',
				ownership: { default: 3 },
				getFlag: () => ({ currency: { gp: 2, sp: 1, cp: 0 }, items: [torch] }),
			},
			emptyPartyInventory(),
			{ default: 0 },
		);
		expect(replacement?.type).toBe('partyInventory');
		expect(replacement?.ownership).toEqual({ default: 3 });
		expect(replacement?.flags[SYSTEM_ID].partyInventory.items).toEqual([torch]);
		expect(replacement).not.toHaveProperty('system');
	});

	it('leaves a party inventory actor alone', () => {
		expect(
			partyInventoryReplacement(
				{ type: 'partyInventory', getFlag: () => emptyPartyInventory() },
				emptyPartyInventory(),
				{ default: 3 },
			),
		).toBeNull();
	});

	it('names the replacement in the language of this client', () => {
		const i18n = game.i18n as { localize: (key: string) => string };
		const original = i18n.localize;
		i18n.localize = (key: string) =>
			key === 'NIMBLE.actorSheet.hero.inventory.party' ? 'Inventaire' : original(key);
		try {
			expect(partyInventoryReplacement(null, emptyPartyInventory(), { default: 3 })?.name).toBe(
				'Inventaire',
			);
		} finally {
			i18n.localize = original;
		}
	});
});

describe('partyInventoryIdentity', () => {
	it('gives a party inventory actor the party name when it still has another name', () => {
		expect(partyInventoryIdentity({ type: 'partyInventory', name: 'Goblin' })).toEqual({
			name: partyInventoryStoredName(),
		});
	});

	it('leaves a party inventory actor that already has the party name', () => {
		expect(
			partyInventoryIdentity({ type: 'partyInventory', name: partyInventoryStoredName() }),
		).toBeNull();
	});
});

describe('ensurePartyInventoryHolder', () => {
	const actorClass = Actor as unknown as {
		create?: (data: unknown) => Promise<unknown>;
	};

	it('replaces a monster holder after the party inventory actor is created', async () => {
		const previousActors = world.actors;
		const previousUser = world.user;
		const actorCreate = actorClass.create;
		const created: unknown[] = [];
		let deleted = false;
		const npc = {
			type: 'npc',
			ownership: { default: 3 },
			getFlag: (scope: string, key: string) => {
				if (scope !== SYSTEM_ID) return undefined;
				if (key === 'partyInventoryHolder') return true;
				if (key === 'partyInventory') return { currency: { gp: 2, sp: 0, cp: 0 }, items: [torch] };
				return undefined;
			},
			delete: async () => {
				deleted = true;
			},
		};
		world.user = { isGM: true };
		world.actors = [npc];
		actorClass.create = async (data: unknown) => {
			created.push(data);
			return { id: 'party' };
		};
		try {
			await ensurePartyInventoryHolder();
			expect(created).toHaveLength(1);
			expect(created[0]).toMatchObject({
				type: 'partyInventory',
				name: 'Party Inventory',
			});
			expect(created[0]).not.toHaveProperty('img');
			expect(deleted).toBe(true);
		} finally {
			world.actors = previousActors;
			world.user = previousUser;
			actorClass.create = actorCreate;
		}
	});

	it('keeps the monster when creating the replacement fails', async () => {
		const previousActors = world.actors;
		const previousUser = world.user;
		const actorCreate = actorClass.create;
		let deleted = false;
		const npc = {
			type: 'npc',
			getFlag: (scope: string, key: string) =>
				scope === SYSTEM_ID && key === 'partyInventoryHolder',
			delete: async () => {
				deleted = true;
			},
		};
		world.user = { isGM: true };
		world.actors = [npc];
		actorClass.create = async () => {
			throw new Error('create failed');
		};
		try {
			await expect(ensurePartyInventoryHolder()).rejects.toThrow('create failed');
			expect(deleted).toBe(false);
		} finally {
			world.actors = previousActors;
			world.user = previousUser;
			actorClass.create = actorCreate;
		}
	});

	it('renames a party inventory actor without deleting it', async () => {
		const previousActors = world.actors;
		const previousUser = world.user;
		const actorCreate = actorClass.create;
		const updates: unknown[] = [];
		let deleted = false;
		const holder = {
			type: 'partyInventory',
			name: 'Goblin',
			img: 'icons/svg/mystery-man.svg',
			getFlag: (scope: string, key: string) =>
				scope === SYSTEM_ID && key === 'partyInventoryHolder',
			update: async (data: unknown) => {
				updates.push(data);
			},
			delete: async () => {
				deleted = true;
			},
		};
		world.user = { isGM: true };
		world.actors = [holder];
		actorClass.create = async () => {
			throw new Error('created');
		};
		try {
			await ensurePartyInventoryHolder();
			expect(updates).toEqual([{ name: 'Party Inventory' }]);
			expect(deleted).toBe(false);
		} finally {
			world.actors = previousActors;
			world.user = previousUser;
			actorClass.create = actorCreate;
		}
	});
});
