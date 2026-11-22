import { afterEach, describe, expect, it, vi } from 'vitest';
import type { NimbleCharacter } from '#documents/actor/character.js';
import * as transferApi from '#utils/partyStash/requestItemTransfer.ts';
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
	destination: { kind: 'stash' as const },
};

afterEach(() => {
	request.mockClear();
	dialog().confirm.mockReset();
	delete dialog().wait;
});

describe('transferObject', () => {
	it('moves one object without asking', async () => {
		const actor = actorWith({
			id: 'torch',
			name: 'Torch',
			type: 'object',
			system: { quantity: 1, equipped: false },
		});

		await transferObject(actor, move);

		expect(dialog().confirm).not.toHaveBeenCalled();
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
			system: { quantity: 3, equipped: false },
		});

		await transferObject(actor, move);

		expect(request).toHaveBeenCalledWith(expect.objectContaining({ quantity: 1 }));
	});

	it('asks how many of a stack, and skips the unequip question for a partial split', async () => {
		dialog().wait = vi.fn(async () => 2);
		const actor = actorWith({
			id: 'torch',
			name: 'Torch',
			type: 'object',
			system: { quantity: 3, equipped: true },
		});

		await transferObject(actor, move);

		expect(dialog().wait).toHaveBeenCalled();
		expect(dialog().confirm).not.toHaveBeenCalled();
		expect(request).toHaveBeenCalledWith(expect.objectContaining({ quantity: 2 }));
	});

	it('asks before the whole equipped stack leaves, and stops when declined', async () => {
		dialog().wait = vi.fn(async () => 3);
		dialog().confirm.mockResolvedValue(false);
		const actor = actorWith({
			id: 'torch',
			name: 'Torch',
			type: 'object',
			system: { quantity: 3, equipped: true },
		});

		await transferObject(actor, move);

		expect(dialog().confirm).toHaveBeenCalled();
		expect(request).not.toHaveBeenCalled();
	});

	it('moves the whole equipped stack once the unequip is confirmed', async () => {
		dialog().wait = vi.fn(async () => 3);
		dialog().confirm.mockResolvedValue(true);
		const actor = actorWith({
			id: 'torch',
			name: 'Torch',
			type: 'object',
			system: { quantity: 3, equipped: true },
		});

		await transferObject(actor, move);

		expect(request).toHaveBeenCalledWith(expect.objectContaining({ quantity: 3 }));
	});

	it('moves a container whole, without a quantity question', async () => {
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
			system: { quantity: 3 },
		});

		await transferObject(actor, move);

		expect(request).not.toHaveBeenCalled();
	});

	it('reads a stash object from the party inventory', async () => {
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
			source: 'stash',
		});

		expect(request).toHaveBeenCalledWith(
			expect.objectContaining({ source: 'stash', itemId: 'gem' }),
		);
		world.settings = previous;
	});
});
