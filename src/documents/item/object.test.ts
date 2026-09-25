import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SYSTEM_ID } from '#system';

import { NimbleBaseItem } from './base.svelte.js';
import { NimbleObjectItem } from './object.js';

const SCHOOL = 'fire';

interface ScrollOverrides {
	/** Spells the wielder already carries. A fire spell waives the Arcana check. */
	actorSpellSchools?: string[];
	/** Absent for an actor type that cannot roll a skill check at all. */
	rollSkillCheck?: ReturnType<typeof vi.fn> | null;
	quantity?: number;
	isEmbedded?: boolean;
	/** Omitted flags make an ordinary object rather than a scroll. */
	isScroll?: boolean;
}

function createScroll(overrides: ScrollOverrides = {}) {
	const {
		actorSpellSchools = [],
		rollSkillCheck = vi.fn(async () => ({
			roll: { total: 15 },
			rollData: { visibilityMode: 'publicroll' },
		})),
		quantity = 1,
		isEmbedded = true,
		isScroll = true,
	} = overrides;

	const actor = {
		type: 'character',
		items: actorSpellSchools.map((school) => ({ type: 'spell', system: { school } })),
		...(rollSkillCheck ? { rollSkillCheck } : {}),
	};

	const scroll = new NimbleObjectItem({
		name: 'Scroll of Fireball',
		type: 'object',
		system: { quantity, activation: {} },
		flags: isScroll
			? { [SYSTEM_ID]: { spellScroll: { spellUuid: 'Item.fireball', school: SCHOOL, tier: 3 } } }
			: {},
	} as never);

	Object.assign(scroll, {
		actor,
		isEmbedded,
		update: vi.fn(async () => undefined),
		delete: vi.fn(async () => undefined),
	});

	return scroll as NimbleObjectItem & {
		actor: typeof actor;
		update: ReturnType<typeof vi.fn>;
		delete: ReturnType<typeof vi.fn>;
	};
}

function stubChatMessage() {
	const create = vi.fn(async () => ({ id: 'arcana-message' }));
	const applyMode = vi.fn();

	Object.assign((globalThis as unknown as { ChatMessage: object }).ChatMessage, {
		create,
		applyMode,
		getSpeaker: vi.fn(() => ({})),
	});

	return { create, applyMode };
}

function confirmDialog() {
	return foundry.applications.api.DialogV2.confirm as unknown as ReturnType<typeof vi.fn>;
}

type DiceSoNiceMock = { waitFor3DAnimationByMessageID: ReturnType<typeof vi.fn> } | undefined;

function setDiceSoNice(dice3d: DiceSoNiceMock): void {
	(globalThis as unknown as { game: { dice3d?: DiceSoNiceMock } }).game.dice3d = dice3d;
}

function setResourceSpendingAutomation(enabled: boolean): void {
	(
		globalThis as unknown as { game: { settings?: { get: ReturnType<typeof vi.fn> } } }
	).game.settings = { get: vi.fn(() => enabled) };
}

describe('NimbleObjectItem.activate', () => {
	let baseActivate: ReturnType<typeof vi.spyOn>;
	let chat: ReturnType<typeof stubChatMessage>;

	beforeEach(() => {
		vi.restoreAllMocks();

		// Base activation reports only whether a card was posted.
		baseActivate = vi
			.spyOn(NimbleBaseItem.prototype, 'activate')
			.mockResolvedValue({ id: 'chat-1' } as never);

		chat = stubChatMessage();
		confirmDialog().mockResolvedValue(true);

		setDiceSoNice(undefined);
		setResourceSpendingAutomation(true);
	});

	describe('an object that is not a scroll', () => {
		it('activates normally, with no prompt and nothing consumed', async () => {
			const object = createScroll({ isScroll: false });

			await object.activate();

			expect(baseActivate).toHaveBeenCalled();
			expect(confirmDialog()).not.toHaveBeenCalled();
			expect(object.delete).not.toHaveBeenCalled();
		});
	});

	// The rulebook's one exemption from the check.
	describe('a wielder who knows the school', () => {
		it('asks before spending the scroll', async () => {
			const scroll = createScroll({ actorSpellSchools: [SCHOOL] });

			await scroll.activate();

			expect(confirmDialog()).toHaveBeenCalled();
			expect(scroll.actor.rollSkillCheck).not.toHaveBeenCalled();
		});

		it('leaves the scroll alone when the confirmation is declined', async () => {
			const scroll = createScroll({ actorSpellSchools: [SCHOOL] });
			confirmDialog().mockResolvedValue(false);

			expect(await scroll.activate()).toBeNull();

			expect(baseActivate).not.toHaveBeenCalled();
			expect(scroll.delete).not.toHaveBeenCalled();
		});

		it('casts the spell and consumes the scroll once confirmed', async () => {
			const scroll = createScroll({ actorSpellSchools: [SCHOOL] });

			await scroll.activate();

			expect(baseActivate).toHaveBeenCalled();
			expect(scroll.delete).toHaveBeenCalled();
		});

		// The confirmation is the commit point, not the card. A `skipRollDialog`
		// spell, or any scroll used with Alt held, posts no dialog to back out of.
		it('consumes the scroll even when the activation posts no card', async () => {
			const scroll = createScroll({ actorSpellSchools: [SCHOOL] });
			baseActivate.mockResolvedValue(null as never);

			await scroll.activate();

			expect(scroll.delete).toHaveBeenCalled();
		});
	});

	describe('a wielder who knows no spell of the school', () => {
		it('rolls the Arcana check instead of asking for confirmation', async () => {
			const scroll = createScroll();

			await scroll.activate();

			expect(scroll.actor.rollSkillCheck).toHaveBeenCalledWith('arcana', expect.any(Object));
			expect(confirmDialog()).not.toHaveBeenCalled();
		});

		it('casts the spell and consumes the scroll on a passing roll', async () => {
			const scroll = createScroll();

			await scroll.activate();

			expect(baseActivate).toHaveBeenCalled();
			expect(scroll.delete).toHaveBeenCalled();
		});

		// "on a failure, it is wasted": the scroll is spent, the spell never happens.
		it('wastes the scroll without casting on a failing roll', async () => {
			const scroll = createScroll({
				rollSkillCheck: vi.fn(async () => ({ roll: { total: 9 }, rollData: {} })),
			});

			expect(await scroll.activate()).toBeNull();

			expect(baseActivate).not.toHaveBeenCalled();
			expect(scroll.delete).toHaveBeenCalled();
		});

		it('treats a total of exactly the DC as a pass', async () => {
			const scroll = createScroll({
				rollSkillCheck: vi.fn(async () => ({ roll: { total: 10 }, rollData: {} })),
			});

			await scroll.activate();

			expect(baseActivate).toHaveBeenCalled();
		});

		// A check the player never agreed to must not spend anything.
		it('leaves the scroll alone when the check dialog is closed', async () => {
			const scroll = createScroll({
				rollSkillCheck: vi.fn(async () => ({ roll: null, rollData: null })),
			});

			expect(await scroll.activate()).toBeNull();

			expect(baseActivate).not.toHaveBeenCalled();
			expect(scroll.delete).not.toHaveBeenCalled();
			expect(chat.create).not.toHaveBeenCalled();
		});

		it('follows the roll mode the GM configured, so a hidden roll stays hidden', async () => {
			const scroll = createScroll({
				rollSkillCheck: vi.fn(async () => ({
					roll: { total: 15 },
					rollData: { visibilityMode: 'blindroll' },
				})),
			});

			await scroll.activate();

			expect(chat.applyMode).toHaveBeenCalledWith(expect.any(Object), 'blind');
		});

		// Dice So Nice animates after the message exists, so a prompt opened right away
		// would sit over rolling dice and give the result away.
		it('holds the outcome until the dice have finished rolling', async () => {
			const scroll = createScroll();
			let finishAnimation = () => {};
			const waitFor3DAnimationByMessageID = vi.fn(
				() =>
					new Promise<void>((resolve) => {
						finishAnimation = resolve;
					}),
			);
			setDiceSoNice({ waitFor3DAnimationByMessageID });

			const activation = scroll.activate();
			await vi.waitFor(() =>
				expect(waitFor3DAnimationByMessageID).toHaveBeenCalledWith('arcana-message'),
			);

			expect(baseActivate).not.toHaveBeenCalled();

			finishAnimation();
			await activation;

			expect(baseActivate).toHaveBeenCalled();
		});

		// Knowing a spell of the school is the rulebook's only exemption, so an actor
		// that cannot roll must not be waved through.
		it('throws for an actor that cannot roll a skill check', async () => {
			const scroll = createScroll({ rollSkillCheck: null });

			await expect(scroll.activate()).rejects.toThrow(/Arcana check/);

			expect(baseActivate).not.toHaveBeenCalled();
			expect(scroll.delete).not.toHaveBeenCalled();
		});
	});

	describe('consumption', () => {
		it('spends one of a stack rather than deleting it', async () => {
			const scroll = createScroll({ actorSpellSchools: [SCHOOL], quantity: 3 });

			await scroll.activate();

			expect(scroll.update).toHaveBeenCalledWith({ 'system.quantity': 2 });
			expect(scroll.delete).not.toHaveBeenCalled();
		});

		it('leaves an unowned scroll alone, since there is no sheet to spend it from', async () => {
			const scroll = createScroll({ actorSpellSchools: [SCHOOL], isEmbedded: false });

			await scroll.activate();

			expect(scroll.delete).not.toHaveBeenCalled();
		});

		it('leaves the scroll in place when resource spending automation is off', async () => {
			const scroll = createScroll({ actorSpellSchools: [SCHOOL] });
			setResourceSpendingAutomation(false);

			await scroll.activate();

			expect(baseActivate).toHaveBeenCalled();
			expect(scroll.delete).not.toHaveBeenCalled();
		});
	});

	describe('a macro-driven activation', () => {
		it('runs the macro path untouched, spending nothing', async () => {
			const scroll = createScroll({ actorSpellSchools: [SCHOOL] });

			await scroll.activate({ executeMacro: true });

			expect(confirmDialog()).not.toHaveBeenCalled();
			expect(scroll.delete).not.toHaveBeenCalled();
		});
	});
});

interface ObjectStubOverrides {
	name?: string;
	objectSizeType?: string;
	quantity?: number;
	containerId?: string;
	isContainer?: boolean;
}

/**
 * A plain object item. The Foundry mock assigns the construction data straight
 * onto the document, so `system` here is what the code under test reads.
 */
function createObject(id: string, overrides: ObjectStubOverrides = {}) {
	const {
		name = id,
		objectSizeType = 'slots',
		quantity = 1,
		containerId = '',
		isContainer = false,
	} = overrides;

	const item = new NimbleObjectItem({
		_id: id,
		id,
		name,
		type: 'object',
		system: {
			objectSizeType,
			quantity,
			containerId,
			container: { enabled: isContainer, requiresEquipped: false },
			activation: {},
		},
	} as never);

	// The base mock's `updateSource` is a no-op, but `_preCreate` relies on it to
	// rewrite the incoming document before it is stored.
	Object.assign(item, {
		update: vi.fn(async () => undefined),
		updateSource: (changes: Record<string, unknown>) => {
			for (const [path, value] of Object.entries(changes)) {
				foundry.utils.setProperty(item, path, value);
			}
		},
	});

	return item as NimbleObjectItem & { update: ReturnType<typeof vi.fn> };
}

function attachActor(items: NimbleObjectItem[]) {
	const updateEmbeddedDocuments = vi.fn(async () => []);
	const collection = Object.assign(items, {
		get: (id: string) => items.find((item) => item.id === id),
	});
	const actor = { items: collection, updateEmbeddedDocuments };

	for (const item of items) {
		Object.assign(item, { actor, isEmbedded: true });
	}

	return { actor, updateEmbeddedDocuments };
}

const DELETING_USER_ID = 'test-user-id';
const DELETING_USER = { id: DELETING_USER_ID } as never;

describe('NimbleObjectItem.confirmDeleteWithContents', () => {
	const confirmDialog = vi.mocked(foundry.applications.api.DialogV2.confirm);

	beforeEach(() => {
		confirmDialog.mockReset();
	});

	it('asks before a container that holds something is deleted, and writes nothing yet', async () => {
		const bag = createObject('bag', { isContainer: true });
		const armor = createObject('armor', { containerId: 'bag' });
		const { updateEmbeddedDocuments } = attachActor([bag, armor]);
		confirmDialog.mockResolvedValue(true);

		expect(await bag.confirmDeleteWithContents()).toBe(true);
		expect(confirmDialog).toHaveBeenCalled();
		// The contents are freed in `_onDelete`, once the delete has actually happened.
		expect(updateEmbeddedDocuments).not.toHaveBeenCalled();
	});

	it('refuses the deletion when the confirmation is declined', async () => {
		const bag = createObject('bag', { isContainer: true });
		const armor = createObject('armor', { containerId: 'bag' });
		attachActor([bag, armor]);
		confirmDialog.mockResolvedValue(false);

		expect(await bag.confirmDeleteWithContents()).toBe(false);
	});

	it('asks nothing when the container is empty', async () => {
		const bag = createObject('bag', { isContainer: true });
		const sword = createObject('sword');
		attachActor([bag, sword]);

		expect(await bag.confirmDeleteWithContents()).toBe(true);
		expect(confirmDialog).not.toHaveBeenCalled();
	});

	it('asks nothing for an object that was never a container', async () => {
		const sword = createObject('sword');
		const chalk = createObject('chalk', { containerId: 'sword' });
		attachActor([sword, chalk]);

		expect(await sword.confirmDeleteWithContents()).toBe(true);
		expect(confirmDialog).not.toHaveBeenCalled();
	});
});

describe('NimbleObjectItem._onDelete', () => {
	type OnDeleteHost = { _onDelete?: ReturnType<typeof vi.fn> };
	let baseOnDelete: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		baseOnDelete = vi.fn();
		(NimbleBaseItem.prototype as unknown as OnDeleteHost)._onDelete = baseOnDelete;
	});

	afterEach(() => {
		delete (NimbleBaseItem.prototype as unknown as OnDeleteHost)._onDelete;
	});

	it('clears the container reference on everything the deleted container held', async () => {
		const bag = createObject('bag', { isContainer: true });
		const armor = createObject('armor', { containerId: 'bag' });
		const sword = createObject('sword');
		const { updateEmbeddedDocuments } = attachActor([bag, armor, sword]);

		bag._onDelete({} as never, DELETING_USER_ID);
		await vi.waitFor(() => expect(updateEmbeddedDocuments).toHaveBeenCalled());

		expect(baseOnDelete).toHaveBeenCalled();
		expect(updateEmbeddedDocuments).toHaveBeenCalledWith('Item', [
			{ _id: 'armor', 'system.containerId': '' },
		]);
	});

	it('leaves the write to the deleting client', () => {
		const bag = createObject('bag', { isContainer: true });
		const armor = createObject('armor', { containerId: 'bag' });
		const { updateEmbeddedDocuments } = attachActor([bag, armor]);

		bag._onDelete({} as never, 'a-different-user');

		expect(updateEmbeddedDocuments).not.toHaveBeenCalled();
	});

	it('writes nothing when the deleted object was never a container', () => {
		const sword = createObject('sword');
		const chalk = createObject('chalk', { containerId: 'sword' });
		const { updateEmbeddedDocuments } = attachActor([sword, chalk]);

		sword._onDelete({} as never, DELETING_USER_ID);

		expect(updateEmbeddedDocuments).not.toHaveBeenCalled();
	});

	it('leaves out contents that are being deleted in the same batch', async () => {
		const bag = createObject('bag', { isContainer: true });
		const armor = createObject('armor', { containerId: 'bag' });
		const rope = createObject('rope', { containerId: 'bag' });
		const { updateEmbeddedDocuments } = attachActor([bag, armor, rope]);

		bag._onDelete({ ids: ['bag', 'armor'] } as never, DELETING_USER_ID);
		await vi.waitFor(() => expect(updateEmbeddedDocuments).toHaveBeenCalled());

		expect(updateEmbeddedDocuments).toHaveBeenCalledWith('Item', [
			{ _id: 'rope', 'system.containerId': '' },
		]);
	});

	it('writes nothing when the whole container went in one batch', () => {
		const bag = createObject('bag', { isContainer: true });
		const armor = createObject('armor', { containerId: 'bag' });
		const { updateEmbeddedDocuments } = attachActor([bag, armor]);

		bag._onDelete({ ids: ['bag', 'armor'] } as never, DELETING_USER_ID);

		expect(updateEmbeddedDocuments).not.toHaveBeenCalled();
	});

	it('reports a failed spill rather than leaving it silent', async () => {
		const bag = createObject('bag', { isContainer: true });
		const armor = createObject('armor', { containerId: 'bag' });
		const { actor } = attachActor([bag, armor]);
		actor.updateEmbeddedDocuments.mockRejectedValue(new Error('no permission'));
		vi.spyOn(console, 'error').mockImplementation(() => {});
		vi.mocked(ui.notifications.error).mockClear();

		bag._onDelete({} as never, DELETING_USER_ID);

		await vi.waitFor(() =>
			expect(ui.notifications.error).toHaveBeenCalledWith(
				expect.stringContaining('Could not empty bag'),
			),
		);
	});
});

describe('NimbleObjectItem container configuration', () => {
	type UpdateHooks = {
		_preUpdate?: ReturnType<typeof vi.fn>;
		_onUpdate?: ReturnType<typeof vi.fn>;
	};
	let basePreUpdate: ReturnType<typeof vi.fn>;

	// `_preUpdate` is protected, so the test reaches it the way Foundry does.
	function preUpdate(item: NimbleObjectItem, changed: Record<string, unknown>) {
		const hook = item as unknown as {
			_preUpdate(
				changed: Record<string, unknown>,
				options: never,
				user: never,
			): Promise<boolean | undefined>;
		};

		return hook._preUpdate(changed, {} as never, DELETING_USER);
	}

	beforeEach(() => {
		basePreUpdate = vi.fn(async () => undefined);
		(NimbleBaseItem.prototype as unknown as UpdateHooks)._preUpdate = basePreUpdate;
		(NimbleBaseItem.prototype as unknown as UpdateHooks)._onUpdate = vi.fn();
		vi.mocked(ui.notifications.warn).mockClear();
	});

	afterEach(() => {
		delete (NimbleBaseItem.prototype as unknown as UpdateHooks)._preUpdate;
		delete (NimbleBaseItem.prototype as unknown as UpdateHooks)._onUpdate;
	});

	it('refuses to make a stored object a container', async () => {
		const bag = createObject('bag', { isContainer: true });
		const pouch = createObject('pouch', { containerId: 'bag' });
		attachActor([bag, pouch]);

		expect(await preUpdate(pouch, { system: { container: { enabled: true } } })).toBe(false);
		expect(ui.notifications.warn).toHaveBeenCalled();
	});

	it('lets an object carried loose become a container', async () => {
		const pouch = createObject('pouch');
		attachActor([pouch]);

		expect(await preUpdate(pouch, { system: { container: { enabled: true } } })).toBeUndefined();
		expect(basePreUpdate).toHaveBeenCalled();
	});

	it('releases the contents when the container box is unticked', async () => {
		const bag = createObject('bag', { isContainer: true });
		const armor = createObject('armor', { containerId: 'bag' });
		const { updateEmbeddedDocuments } = attachActor([bag, armor]);
		bag.system.container.enabled = false;

		bag._onUpdate({ system: { container: { enabled: false } } }, {} as never, DELETING_USER_ID);
		await vi.waitFor(() => expect(updateEmbeddedDocuments).toHaveBeenCalled());

		expect(updateEmbeddedDocuments).toHaveBeenCalledWith('Item', [
			{ _id: 'armor', 'system.containerId': '' },
		]);
	});

	it('leaves the contents alone when some other field changes', () => {
		const bag = createObject('bag', { isContainer: true });
		const armor = createObject('armor', { containerId: 'bag' });
		const { updateEmbeddedDocuments } = attachActor([bag, armor]);

		bag._onUpdate({ system: { container: { capacity: 4 } } }, {} as never, DELETING_USER_ID);

		expect(updateEmbeddedDocuments).not.toHaveBeenCalled();
	});

	it('leaves the release to the client that made the change', () => {
		const bag = createObject('bag', { isContainer: true });
		const armor = createObject('armor', { containerId: 'bag' });
		const { updateEmbeddedDocuments } = attachActor([bag, armor]);
		bag.system.container.enabled = false;

		bag._onUpdate({ system: { container: { enabled: false } } }, {} as never, 'a-different-user');

		expect(updateEmbeddedDocuments).not.toHaveBeenCalled();
	});
});

/**
 * Equipping writes the rules and the equipped flag together. Two writes could half
 * succeed, so what these assert is the single `update` as much as its contents.
 */
describe('NimbleObjectItem.toggleEquipment', () => {
	function makeEquippable(equipped: boolean) {
		const update = vi.fn(async () => undefined);
		const withAllRulesDisabled = vi.fn((disabled: boolean) => [
			{ id: 'rule-1', type: 'armorClass', disabled },
		]);
		const item = { system: { equipped }, rules: { withAllRulesDisabled }, update };

		return {
			update,
			toggle: () => NimbleObjectItem.prototype.toggleEquipment.call(item as never),
		};
	}

	it('equips and enables the rules in one write', async () => {
		const { update, toggle } = makeEquippable(false);

		await toggle();

		expect(update).toHaveBeenCalledTimes(1);
		expect(update).toHaveBeenCalledWith({
			'system.rules': [{ id: 'rule-1', type: 'armorClass', disabled: false }],
			'system.equipped': true,
		});
	});

	it('unequips and disables the rules in one write', async () => {
		const { update, toggle } = makeEquippable(true);

		await toggle();

		expect(update).toHaveBeenCalledTimes(1);
		expect(update).toHaveBeenCalledWith({
			'system.rules': [{ id: 'rule-1', type: 'armorClass', disabled: true }],
			'system.equipped': false,
		});
	});
});

describe('NimbleObjectItem._preCreate stacking', () => {
	type PreCreateHost = { _preCreate?: ReturnType<typeof vi.fn> };
	let basePreCreate: ReturnType<typeof vi.fn>;

	// `_preCreate` lives on Foundry's own Item, above NimbleBaseItem, so there is
	// nothing to spy on under the test mock. Stand one in for the block instead.
	beforeEach(() => {
		vi.restoreAllMocks();
		basePreCreate = vi.fn(async () => true);
		(NimbleBaseItem.prototype as unknown as PreCreateHost)._preCreate = basePreCreate;
	});

	afterEach(() => {
		delete (NimbleBaseItem.prototype as unknown as PreCreateHost)._preCreate;
	});

	/**
	 * `_preCreate` runs before the document joins the collection, so the incoming
	 * item is given the actor without being listed among what is already carried.
	 */
	function dropOnto(carried: NimbleObjectItem[], incoming: NimbleObjectItem) {
		const { actor } = attachActor(carried);
		Object.assign(incoming, { actor, isEmbedded: true });

		return incoming._preCreate({} as never, {} as never, {} as never);
	}

	it('folds a new stack into one already carried in the same place', async () => {
		const carried = createObject('carried-arrows', {
			name: 'Arrows',
			objectSizeType: 'stackable',
			quantity: 3,
		});
		const dropped = createObject('dropped-arrows', {
			name: 'Arrows',
			objectSizeType: 'stackable',
		});

		expect(await dropOnto([carried], dropped)).toBe(false);
		expect(carried.update).toHaveBeenCalledWith({ 'system.quantity': 4 });
		expect(basePreCreate).not.toHaveBeenCalled();
	});

	it('keeps a new stack out of an identical one stored in a container', async () => {
		const quivered = createObject('quivered-arrows', {
			name: 'Arrows',
			objectSizeType: 'stackable',
			quantity: 3,
			containerId: 'quiver',
		});
		const dropped = createObject('dropped-arrows', {
			name: 'Arrows',
			objectSizeType: 'stackable',
		});

		await dropOnto([quivered], dropped);

		// Arrows in a quiver and arrows on the belt are separate piles.
		expect(quivered.update).not.toHaveBeenCalled();
		expect(basePreCreate).toHaveBeenCalled();
	});

	it('folds into the stack inside the container when the new one is stored there too', async () => {
		const quiver = createObject('quiver', { isContainer: true });
		const quivered = createObject('quivered-arrows', {
			name: 'Arrows',
			objectSizeType: 'stackable',
			quantity: 3,
			containerId: 'quiver',
		});
		const dropped = createObject('dropped-arrows', {
			name: 'Arrows',
			objectSizeType: 'stackable',
			containerId: 'quiver',
		});

		expect(await dropOnto([quiver, quivered], dropped)).toBe(false);
		expect(quivered.update).toHaveBeenCalledWith({ 'system.quantity': 4 });
	});

	it('discards a container id that names nothing this actor carries', async () => {
		const dropped = createObject('copied-armor', { containerId: 'a-bag-on-another-actor' });

		await dropOnto([], dropped);

		expect(dropped.system.containerId).toBe('');
	});

	it('discards a container id that names an object which is not a container', async () => {
		const sword = createObject('sword');
		const dropped = createObject('copied-armor', { containerId: 'sword' });

		await dropOnto([sword], dropped);

		expect(dropped.system.containerId).toBe('');
	});

	it('keeps a container id that names a container this actor carries', async () => {
		const bag = createObject('bag', { isContainer: true });
		const dropped = createObject('armor', { containerId: 'bag' });

		await dropOnto([bag], dropped);

		expect(dropped.system.containerId).toBe('bag');
	});

	it('puts a copied-out stack back in the loose pile rather than keeping it stranded', async () => {
		const loose = createObject('loose-arrows', {
			name: 'Arrows',
			objectSizeType: 'stackable',
			quantity: 3,
		});
		const dropped = createObject('copied-arrows', {
			name: 'Arrows',
			objectSizeType: 'stackable',
			containerId: 'a-quiver-on-another-actor',
		});

		expect(await dropOnto([loose], dropped)).toBe(false);
		expect(loose.update).toHaveBeenCalledWith({ 'system.quantity': 4 });
	});
});
