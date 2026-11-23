import { describe, expect, it } from 'vitest';
import { NimblePartyInventory } from '../partyInventory.ts';
import { partyInventoryStoredName } from '../partyInventoryHolder.ts';

describe('NimblePartyInventory', () => {
	function actor(): NimblePartyInventory {
		return new NimblePartyInventory({
			name: 'Goblin',
			img: 'icons/svg/mystery-man.svg',
			type: 'partyInventory',
		} as never);
	}

	it('cannot be deleted, and can still be edited', async () => {
		const inventory = actor();
		const parent = Object.getPrototypeOf(NimblePartyInventory.prototype) as {
			canUserModify?: (user: unknown, action: string) => boolean;
		};
		const original = parent.canUserModify;
		const seen: string[] = [];
		parent.canUserModify = (_user, action) => {
			seen.push(action);
			return true;
		};
		try {
			expect(inventory.canUserModify({} as never, 'delete')).toBe(false);
			expect(inventory.canUserModify({} as never, 'update')).toBe(true);
			expect(seen).toEqual(['update']);
		} finally {
			parent.canUserModify = original;
		}
		const deleting = inventory as unknown as {
			_preDelete(options: object, user: object): Promise<boolean>;
		};
		expect(await deleting._preDelete({}, {})).toBe(false);
	});

	it('is named Party Inventory in English', () => {
		expect(partyInventoryStoredName()).toBe('Party Inventory');
	});

	it('keeps the party name when a rename comes in, and leaves the image alone', async () => {
		const inventory = actor();
		const parent = Object.getPrototypeOf(NimblePartyInventory.prototype) as {
			_preUpdate?: (...args: unknown[]) => Promise<unknown>;
		};
		const original = parent._preUpdate;
		parent._preUpdate = async () => true;
		const changes = { name: 'Goblin', img: 'icons/svg/mystery-man.svg' };
		try {
			await inventory._preUpdate(changes as never, {} as never, {} as never);
		} finally {
			parent._preUpdate = original;
		}
		expect(changes.name).toBe('Party Inventory');
		expect(changes.img).toBe('icons/svg/mystery-man.svg');
	});

	it('stores the name in the language of the client that saves it', async () => {
		const i18n = game.i18n as { localize: (key: string) => string };
		const original = i18n.localize;
		i18n.localize = (key: string) =>
			key === 'NIMBLE.actorSheet.hero.inventory.party' ? 'Inventaire' : original(key);
		const inventory = actor();
		const parent = Object.getPrototypeOf(NimblePartyInventory.prototype) as {
			_preUpdate?: (...args: unknown[]) => Promise<unknown>;
		};
		const originalUpdate = parent._preUpdate;
		parent._preUpdate = async () => true;
		const changes = { name: 'Goblin' };
		try {
			await inventory._preUpdate(changes as never, {} as never, {} as never);
		} finally {
			parent._preUpdate = originalUpdate;
			i18n.localize = original;
		}
		expect(changes.name).toBe('Inventaire');
	});
});
