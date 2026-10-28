import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const openSpellScrollDialogMock = vi.fn();

// The test setup has already loaded the drop route through init, so a hoisted
// vi.mock would not reach it. Load a fresh copy after the mock is registered.
let routeItemDrop: typeof import('../routeItemDrop.js').routeItemDrop;

beforeAll(async () => {
	vi.resetModules();
	vi.doMock('../../../view/dialogs/openSpellScrollDialog.js', () => ({
		default: openSpellScrollDialogMock,
	}));
	({ routeItemDrop } = await import('../routeItemDrop.js'));
});

type ItemFixture = {
	id: string;
	name: string;
	type: string;
	system: Record<string, unknown>;
};

function droppedItem(source: Partial<ItemFixture> & { type: string }) {
	const data = {
		_id: source.id ?? 'dropped-id',
		name: source.name ?? 'Dropped',
		type: source.type,
		system: source.system ?? {},
	};
	return {
		id: data._id,
		uuid: `Item.${data._id}`,
		toObject: () => structuredClone(data),
	};
}

function createActor(
	type: 'character' | 'npc',
	options: {
		items?: ItemFixture[];
		isOwner?: boolean;
		level?: number;
		classes?: Record<string, { identifier: string }>;
		canStore?: boolean;
		createResult?: (sources: Record<string, unknown>[]) => unknown[];
	} = {},
) {
	const items = options.items ?? [];
	return {
		type,
		isOwner: options.isOwner ?? true,
		levels: { character: options.level ?? 1 },
		classes: options.classes ?? {},
		items: {
			has: (id: string) => items.some((item) => item.id === id),
			find: (predicate: (item: ItemFixture) => boolean) => items.find(predicate),
		},
		canStoreDroppedObjectInContainer: vi.fn(() => options.canStore ?? true),
		createEmbeddedDocuments: vi.fn(async (_type: string, sources: Record<string, unknown>[]) =>
			options.createResult
				? options.createResult(sources)
				: sources.map((source, index) => ({ ...source, id: `created-${index}` })),
		),
		deleteEmbeddedDocuments: vi.fn(async () => []),
	};
}

function globals() {
	return globalThis as unknown as {
		Hooks: { call: ReturnType<typeof vi.fn> };
		Item: { implementation?: { fromDropData: ReturnType<typeof vi.fn> } };
		ui: { notifications: { warn: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> } };
	};
}

async function drop(
	actor: ReturnType<typeof createActor>,
	item: ReturnType<typeof droppedItem>,
	containerId?: string,
) {
	globals().Item.implementation = { fromDropData: vi.fn(async () => item) };
	return routeItemDrop({
		actor: actor as unknown as Actor.Implementation,
		sheet: {} as foundry.applications.sheets.ActorSheetV2.Any,
		data: { type: 'Item', uuid: item.uuid },
		containerId,
	});
}

function createdSources(actor: ReturnType<typeof createActor>): Record<string, unknown>[] {
	return actor.createEmbeddedDocuments.mock.calls.at(-1)?.[1] ?? [];
}

describe('routeItemDrop', () => {
	beforeEach(() => {
		globals().Hooks.call.mockReturnValue(true);
		openSpellScrollDialogMock.mockReset();
	});

	afterEach(() => {
		delete globals().Item.implementation;
	});

	it('refuses the drop when a dropActorSheetData hook returns false', async () => {
		globals().Hooks.call.mockReturnValue(false);
		const actor = createActor('character');

		expect(await drop(actor, droppedItem({ type: 'feature' }))).toEqual({ kind: 'refused' });
		expect(actor.createEmbeddedDocuments).not.toHaveBeenCalled();
	});

	it('refuses the drop for a user who does not own the actor', async () => {
		const actor = createActor('npc', { isOwner: false });

		expect(await drop(actor, droppedItem({ type: 'feature' }))).toEqual({ kind: 'refused' });
	});

	it('asks for a sort when the item is already on the actor', async () => {
		const actor = createActor('npc', {
			items: [{ id: 'owned', name: 'Bite', type: 'monsterFeature', system: {} }],
		});

		const outcome = await drop(actor, droppedItem({ id: 'owned', type: 'monsterFeature' }));

		expect(outcome).toMatchObject({ kind: 'sort', itemId: 'owned' });
		expect(outcome.kind === 'sort' && outcome.itemData.uuid).toBe('Item.owned');
		expect(actor.createEmbeddedDocuments).not.toHaveBeenCalled();
	});

	it('creates a dropped item on an NPC with no character checks', async () => {
		const actor = createActor('npc');

		const outcome = await drop(actor, droppedItem({ type: 'spell', system: { school: 'fire' } }));

		expect(outcome.kind).toBe('created');
		expect(openSpellScrollDialogMock).not.toHaveBeenCalled();
	});

	describe('subclass validation', () => {
		const subclass = () =>
			droppedItem({
				type: 'subclass',
				name: 'Path of the Mountainheart',
				system: { parentClass: 'berserker', identifier: 'mountainheart' },
			});

		it('refuses a subclass below level 3', async () => {
			const actor = createActor('character', {
				level: 2,
				classes: { berserker: { identifier: 'berserker' } },
			});

			expect(await drop(actor, subclass())).toEqual({ kind: 'refused' });
			expect(globals().ui.notifications.warn).toHaveBeenCalledWith(
				'You must be at least level 3 to select a subclass. You are currently level 2.',
			);
		});

		it('refuses a subclass of a class the character does not have', async () => {
			const actor = createActor('character', { level: 3 });

			expect(await drop(actor, subclass())).toEqual({ kind: 'refused' });
		});

		it('creates a subclass that matches a class of a level 3 character', async () => {
			const actor = createActor('character', {
				level: 3,
				classes: { berserker: { identifier: 'berserker' } },
			});

			expect((await drop(actor, subclass())).kind).toBe('created');
		});
	});

	describe('spell scrolls', () => {
		it('creates nothing when the player cancels the scroll chooser', async () => {
			openSpellScrollDialogMock.mockResolvedValue(null);
			const actor = createActor('character');

			const outcome = await drop(actor, droppedItem({ type: 'spell', system: { school: 'fire' } }));

			expect(openSpellScrollDialogMock).toHaveBeenCalledWith(
				expect.objectContaining({ mode: 'chooser' }),
			);
			expect(outcome).toEqual({ kind: 'refused' });
			expect(actor.createEmbeddedDocuments).not.toHaveBeenCalled();
		});

		it('creates a scroll in place of the spell when the player picks a scroll', async () => {
			openSpellScrollDialogMock.mockResolvedValue({ destination: 'scroll' });
			const actor = createActor('character');

			await drop(
				actor,
				droppedItem({ type: 'spell', name: 'Flame Dart', system: { school: 'fire', tier: 0 } }),
			);

			expect(createdSources(actor)).toEqual([expect.objectContaining({ type: 'object' })]);
		});
	});

	describe('containers', () => {
		it('stores and unequips an object dropped on a container', async () => {
			const actor = createActor('character');

			await drop(actor, droppedItem({ type: 'object', system: { equipped: true } }), 'bag');

			expect(createdSources(actor)[0].system).toMatchObject({
				containerId: 'bag',
				equipped: false,
			});
		});

		it('refuses an object that the container cannot hold', async () => {
			const actor = createActor('character', { canStore: false });

			expect(await drop(actor, droppedItem({ type: 'object' }), 'bag')).toEqual({
				kind: 'refused',
			});
			expect(actor.createEmbeddedDocuments).not.toHaveBeenCalled();
		});
	});

	it('reports the stack that took a copy when no document was created', async () => {
		const actor = createActor('character', {
			items: [
				{ id: 'torches', name: 'Torch', type: 'object', system: { objectSizeType: 'smallSized' } },
			],
			createResult: () => [],
		});

		const outcome = await drop(
			actor,
			droppedItem({ type: 'object', name: 'Torch', system: { objectSizeType: 'smallSized' } }),
		);

		expect(outcome).toEqual({ kind: 'stacked', itemType: 'object', itemIds: ['torches'] });
	});
});
