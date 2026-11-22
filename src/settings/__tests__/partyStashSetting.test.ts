import { describe, expect, it } from 'vitest';
import { SYSTEM_ID, SYSTEM_PATH } from '#system';

const world = game as unknown as { actors: unknown; user: unknown };

import {
	emptyPartyStash,
	ensurePartyStashHolder,
	hidePartyStashHolder,
	normalizePartyStash,
	PARTY_INVENTORY_IMAGE,
	PARTY_INVENTORY_NAME,
	partyCoin,
	partyInventoryIdentity,
	partyInventoryReplacement,
} from '../partyStashSetting.ts';

describe('normalizePartyStash', () => {
	it('starts empty', () => {
		expect(emptyPartyStash()).toEqual({ currency: { gp: 0, sp: 0, cp: 0 }, items: [] });
	});

	it('keeps object rows and drops a bad coin or a non-object', () => {
		expect(
			normalizePartyStash({
				currency: { gp: 4.8, sp: -3, cp: 'nope' },
				items: [
					{ _id: 'torch', type: 'object', name: 'Torch', system: { quantity: 2 } },
					{ _id: '', type: 'object', name: 'Blank' },
					{ _id: 'rage', type: 'feature', name: 'Rage' },
					null,
				],
			}),
		).toEqual({
			currency: { gp: 4, sp: 0, cp: 0 },
			items: [{ _id: 'torch', type: 'object', name: 'Torch', system: { quantity: 2 } }],
		});
	});

	it('reads an empty stash from anything that is not the setting', () => {
		expect(normalizePartyStash(null)).toEqual(emptyPartyStash());
		expect(normalizePartyStash('nope')).toEqual(emptyPartyStash());
	});

	it('names the three coins', () => {
		expect(partyCoin('gp')).toBe(true);
		expect(partyCoin('pp')).toBe(false);
	});
});

describe('hidePartyStashHolder', () => {
	it('leaves the party inventory actor out of the actors sidebar', () => {
		const previous = world.actors;
		const hero = { name: 'Ada', getFlag: () => undefined };
		const holder = {
			name: 'Party Inventory',
			getFlag: (scope: string, key: string) => scope === SYSTEM_ID && key === 'partyStashHolder',
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
			hidePartyStashHolder();
			expect(collection.shown).toEqual([hero]);
			collection.initializeTree();
			expect(collection.shown).toEqual([hero]);
		} finally {
			world.actors = previous;
		}
	});
});

const torch = { _id: 'torch', type: 'object', name: 'Torch', system: { quantity: 2 } };
const portrait = {
	name: PARTY_INVENTORY_NAME,
	img: PARTY_INVENTORY_IMAGE,
	prototypeToken: { name: PARTY_INVENTORY_NAME, texture: { src: PARTY_INVENTORY_IMAGE } },
};

describe('partyInventoryReplacement', () => {
	it('creates a party inventory actor from the setting when none exists', () => {
		expect(
			partyInventoryReplacement(
				null,
				{ currency: { gp: 4, sp: 0, cp: 0 }, items: [torch] },
				{ default: 3 },
			),
		).toEqual({
			...portrait,
			type: 'partyInventory',
			ownership: { default: 3 },
			flags: {
				[SYSTEM_ID]: {
					partyStashHolder: true,
					partyStash: { currency: { gp: 4, sp: 0, cp: 0 }, items: [torch] },
				},
			},
		});
	});

	it('copies the stash and ownership off a creature holder, without its creature data', () => {
		const replacement = partyInventoryReplacement(
			{
				type: 'npc',
				ownership: { default: 3 },
				getFlag: () => ({ currency: { gp: 2, sp: 1, cp: 0 }, items: [torch] }),
			},
			emptyPartyStash(),
			{ default: 0 },
		);
		expect(replacement?.type).toBe('partyInventory');
		expect(replacement?.ownership).toEqual({ default: 3 });
		expect(replacement?.flags[SYSTEM_ID].partyStash.items).toEqual([torch]);
		expect(replacement).not.toHaveProperty('system');
	});

	it('leaves a party inventory actor alone', () => {
		expect(
			partyInventoryReplacement(
				{ type: 'partyInventory', getFlag: () => emptyPartyStash() },
				emptyPartyStash(),
				{ default: 3 },
			),
		).toBeNull();
	});
});

describe('partyInventoryIdentity', () => {
	it('gives a party inventory actor the party name and chest when it still looks like something else', () => {
		expect(
			partyInventoryIdentity({
				type: 'partyInventory',
				name: 'Goblin',
				img: 'icons/svg/mystery-man.svg',
			}),
		).toEqual(portrait);
		expect(PARTY_INVENTORY_IMAGE).toBe(`${SYSTEM_PATH}/assets/icons/party-inventory.svg`);
	});

	it('leaves a party inventory actor that already has the name and chest', () => {
		expect(
			partyInventoryIdentity({
				type: 'partyInventory',
				name: PARTY_INVENTORY_NAME,
				img: PARTY_INVENTORY_IMAGE,
			}),
		).toBeNull();
	});
});

describe('ensurePartyStashHolder', () => {
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
				if (key === 'partyStashHolder') return true;
				if (key === 'partyStash') return { currency: { gp: 2, sp: 0, cp: 0 }, items: [torch] };
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
			await ensurePartyStashHolder();
			expect(created).toHaveLength(1);
			expect(created[0]).toMatchObject({
				type: 'partyInventory',
				name: 'Party Inventory',
				img: `${SYSTEM_PATH}/assets/icons/party-inventory.svg`,
			});
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
			getFlag: (scope: string, key: string) => scope === SYSTEM_ID && key === 'partyStashHolder',
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
			await expect(ensurePartyStashHolder()).rejects.toThrow('create failed');
			expect(deleted).toBe(false);
		} finally {
			world.actors = previousActors;
			world.user = previousUser;
			actorClass.create = actorCreate;
		}
	});

	it('renames and reicons a party inventory actor without deleting it', async () => {
		const previousActors = world.actors;
		const previousUser = world.user;
		const actorCreate = actorClass.create;
		const updates: unknown[] = [];
		let deleted = false;
		const holder = {
			type: 'partyInventory',
			name: 'Goblin',
			img: 'icons/svg/mystery-man.svg',
			getFlag: (scope: string, key: string) => scope === SYSTEM_ID && key === 'partyStashHolder',
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
			await ensurePartyStashHolder();
			expect(updates).toEqual([portrait]);
			expect(deleted).toBe(false);
		} finally {
			world.actors = previousActors;
			world.user = previousUser;
			actorClass.create = actorCreate;
		}
	});
});
