import { afterEach, describe, expect, it, vi } from 'vitest';
import type { NimbleCharacter } from '#documents/actor/character.js';
import * as transferApi from '#utils/partyInventory/requestItemTransfer.ts';
import { transferObject } from '../transferObject.ts';

const request = vi.spyOn(transferApi, 'requestItemTransfer').mockResolvedValue(true);
const dialog = () =>
	foundry.applications.api.DialogV2 as unknown as {
		confirm: ReturnType<typeof vi.fn>;
		wait?: ReturnType<typeof vi.fn>;
	};

function actorWith(
	item: { id: string; name: string; type: string; system: Record<string, unknown> } | null,
) {
	return {
		id: 'ada',
		items: { get: (id: string) => (item && id === item.id ? item : undefined) },
	} as unknown as NimbleCharacter;
}

const move = {
	kind: 'transferObject' as const,
	itemId: 'torch',
	source: 'actor' as const,
	sourceActorId: 'ada',
	destination: { kind: 'party' as const },
};

afterEach(() => {
	request.mockClear();
	dialog().confirm.mockReset();
	delete dialog().wait;
});

describe('transferObject', () => {
	it('does not move a stack whose stored quantity is 0', async () => {
		const actor = actorWith({
			id: 'torch',
			name: 'Torch',
			type: 'object',
			system: { quantity: 0, objectSizeType: 'stackable', equipped: false },
		});

		await transferObject(actor, move);

		expect(dialog().confirm).not.toHaveBeenCalled();
		expect(request).not.toHaveBeenCalled();
	});

	it('does not confirm a container or a slot-sized object whose stored quantity is 0', async () => {
		const pack = actorWith({
			id: 'torch',
			name: 'Pack',
			type: 'object',
			system: { quantity: 0, equipped: false, container: { enabled: true } },
		});
		const sword = actorWith({
			id: 'torch',
			name: 'Sword',
			type: 'object',
			system: { quantity: 0, objectSizeType: 'slots', equipped: false },
		});

		await transferObject(pack, move);
		await transferObject(sword, move);

		expect(dialog().confirm).not.toHaveBeenCalled();
		expect(request).not.toHaveBeenCalled();
	});

	it('treats a missing quantity as one object', async () => {
		dialog().confirm.mockResolvedValue(true);
		const actor = actorWith({
			id: 'torch',
			name: 'Torch',
			type: 'object',
			system: { equipped: false },
		});

		await transferObject(actor, move);

		expect(request).toHaveBeenCalledWith(expect.objectContaining({ quantity: 1, itemId: 'torch' }));
	});

	it('asks before moving one object to the party inventory', async () => {
		dialog().confirm.mockResolvedValue(true);
		const actor = actorWith({
			id: 'torch',
			name: 'Torch',
			type: 'object',
			system: { quantity: 1, equipped: false },
		});

		await transferObject(actor, move);

		expect(dialog().confirm).toHaveBeenCalledWith(
			expect.objectContaining({
				window: { title: 'Move Torch' },
				content: '<p>Torch will move to the party inventory.</p>',
			}),
		);
		expect(request).toHaveBeenCalledWith(expect.objectContaining({ quantity: 1, itemId: 'torch' }));
	});

	it('keeps the how-many slider and the number on the same amount', async () => {
		dialog().wait = vi.fn(
			async (config: {
				content: string;
				render: (event: Event, dialog: { element: ParentNode }) => void;
			}) => {
				expect(config.content).toContain('type="range"');
				expect(config.content).toContain('max="3"');
				expect(config.content).not.toContain('style=');
				const root = document.createElement('div');
				root.innerHTML = config.content;
				config.render(new Event('render'), { element: root });
				const slider = root.querySelector<HTMLInputElement>('input[type="range"]');
				const amount = root.querySelector<HTMLInputElement>('input[name="quantity"]');
				if (!slider || !amount) throw new Error('quantity controls missing');
				expect(slider.value).toBe('3');
				expect(amount.value).toBe('3');
				slider.value = '1';
				slider.dispatchEvent(new Event('input'));
				expect(amount.value).toBe('1');
				amount.value = '2';
				amount.dispatchEvent(new Event('input'));
				expect(slider.value).toBe('2');
				amount.value = '9';
				amount.dispatchEvent(new Event('change'));
				expect(amount.value).toBe('3');
				expect(slider.value).toBe('3');
				return 1;
			},
		);
		const actor = actorWith({
			id: 'torch',
			name: 'Torch',
			type: 'object',
			system: { quantity: 3, equipped: false, objectSizeType: 'stackable' },
		});

		await transferObject(actor, move);

		expect(dialog().confirm).not.toHaveBeenCalled();
		expect(request).toHaveBeenCalledWith(expect.objectContaining({ quantity: 1 }));
	});

	it('puts the count and the unequip note in one dialog', async () => {
		dialog().wait = vi.fn(async (config: { window: { title: string }; content: string }) => {
			expect(config.window.title).toBe('Unequip Torch');
			expect(config.content).toContain(
				'Torch is equipped. It will be unequipped before it moves to the party inventory.',
			);
			expect(config.content).toContain('type="range"');
			return 2;
		});
		const actor = actorWith({
			id: 'torch',
			name: 'Torch',
			type: 'object',
			system: { quantity: 3, equipped: true, objectSizeType: 'stackable' },
		});

		await transferObject(actor, move);

		expect(dialog().confirm).not.toHaveBeenCalled();
		expect(request).toHaveBeenCalledWith(expect.objectContaining({ quantity: 2 }));
	});

	it('stops when the equipped stack dialog is closed', async () => {
		dialog().wait = vi.fn(async () => null);
		const actor = actorWith({
			id: 'torch',
			name: 'Torch',
			type: 'object',
			system: { quantity: 3, equipped: true, objectSizeType: 'stackable' },
		});

		await transferObject(actor, move);

		expect(dialog().confirm).not.toHaveBeenCalled();
		expect(request).not.toHaveBeenCalled();
	});

	it('names the character inventory on the unequip confirm', async () => {
		dialog().confirm.mockResolvedValue(false);
		const world = game as unknown as {
			actors?: { get: (id: string) => { name: string } | undefined };
		};
		const previous = world.actors;
		world.actors = {
			get: (id: string) => (id === 'bram' ? { name: 'Bram Holt' } : undefined),
		};
		const actor = actorWith({
			id: 'dagger',
			name: 'Dagger',
			type: 'object',
			system: { quantity: 1, equipped: true },
		});

		await transferObject(actor, {
			...move,
			itemId: 'dagger',
			destination: { kind: 'actor', actorId: 'bram' },
		});

		expect(dialog().confirm).toHaveBeenCalledWith(
			expect.objectContaining({
				window: { title: 'Unequip Dagger' },
				content:
					'<p>Dagger is equipped. It will be unequipped before it moves to the Bram Holt inventory.</p>',
			}),
		);
		expect(request).not.toHaveBeenCalled();
		world.actors = previous;
	});

	it('moves the whole equipped stack from that same dialog', async () => {
		dialog().wait = vi.fn(async () => 3);
		const actor = actorWith({
			id: 'torch',
			name: 'Torch',
			type: 'object',
			system: { quantity: 3, equipped: true, objectSizeType: 'stackable' },
		});

		await transferObject(actor, move);

		expect(dialog().confirm).not.toHaveBeenCalled();
		expect(request).toHaveBeenCalledWith(expect.objectContaining({ quantity: 3 }));
	});

	it('moves a single object whole, without a quantity question', async () => {
		dialog().confirm.mockResolvedValue(true);
		const actor = actorWith({
			id: 'rope',
			name: 'Rope',
			type: 'object',
			system: { quantity: 5, equipped: false, objectSizeType: 'slots' },
		});

		await transferObject(actor, { ...move, itemId: 'rope' });

		expect(dialog().wait).toBeUndefined();
		expect(request).toHaveBeenCalledWith(expect.objectContaining({ itemId: 'rope', quantity: 5 }));
	});

	it('moves a container whole, without a quantity question', async () => {
		dialog().confirm.mockResolvedValue(true);
		const actor = actorWith({
			id: 'pack',
			name: 'Pack',
			type: 'object',
			system: { quantity: 4, equipped: false, container: { enabled: true } },
		});

		await transferObject(actor, { ...move, itemId: 'pack' });

		expect(dialog().wait).toBeUndefined();
		expect(request).toHaveBeenCalledWith(expect.objectContaining({ itemId: 'pack', quantity: 4 }));
	});

	it('stops when the quantity dialog is closed', async () => {
		dialog().wait = vi.fn(async () => null);
		const actor = actorWith({
			id: 'torch',
			name: 'Torch',
			type: 'object',
			system: { quantity: 3, objectSizeType: 'stackable' },
		});

		await transferObject(actor, move);

		expect(request).not.toHaveBeenCalled();
	});

	it('asks before moving one object onto this character', async () => {
		dialog().confirm.mockResolvedValue(true);
		const world = game as unknown as { settings: { get?: () => unknown } };
		const previous = world.settings;
		world.settings = {
			get: () => ({
				currency: { gp: 0, sp: 0, cp: 0 },
				items: [{ _id: 'torch', name: 'Torch', type: 'object', system: { quantity: 1 } }],
			}),
		};
		const actor = actorWith(null);
		(actor as { name?: string }).name = 'Ada';

		await transferObject(actor, {
			...move,
			source: 'party',
			destination: { kind: 'actor', actorId: 'ada' },
		});

		expect(dialog().confirm).toHaveBeenCalledWith(
			expect.objectContaining({
				window: { title: 'Move Torch' },
				content: '<p>Torch will move to the Ada inventory.</p>',
			}),
		);
		expect(request).toHaveBeenCalledWith(
			expect.objectContaining({ source: 'party', destination: { kind: 'actor', actorId: 'ada' } }),
		);
		world.settings = previous;
	});

	it('asks before giving an object to another character', async () => {
		dialog().confirm.mockResolvedValue(false);
		const world = game as unknown as {
			actors?: { get: (id: string) => { name: string } | undefined };
		};
		const previous = world.actors;
		world.actors = {
			get: (id: string) => (id === 'bram' ? { name: 'Bram Holt' } : undefined),
		};
		const actor = actorWith({
			id: 'torch',
			name: 'Torch',
			type: 'object',
			system: { quantity: 1, equipped: false },
		});

		await transferObject(actor, {
			...move,
			destination: { kind: 'actor', actorId: 'bram' },
		});

		expect(dialog().confirm).toHaveBeenCalledWith(
			expect.objectContaining({
				window: { title: 'Move Torch' },
				content: '<p>Torch will move to the Bram Holt inventory.</p>',
			}),
		);
		expect(request).not.toHaveBeenCalled();
		world.actors = previous;
	});

	it('reads a party inventory object from the party inventory', async () => {
		dialog().confirm.mockResolvedValue(true);
		const world = game as unknown as { settings: { get?: () => unknown } };
		const previous = world.settings;
		world.settings = {
			get: () => ({
				currency: { gp: 0, sp: 0, cp: 0 },
				items: [{ _id: 'gem', name: 'Gem', type: 'object', system: { quantity: 1 } }],
			}),
		};

		await transferObject(actorWith(null), {
			...move,
			itemId: 'gem',
			source: 'party',
		});

		expect(request).toHaveBeenCalledWith(
			expect.objectContaining({ source: 'party', itemId: 'gem' }),
		);
		world.settings = previous;
	});
});
