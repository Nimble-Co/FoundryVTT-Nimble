import { describe, expect, it } from 'vitest';
import { mayTransferItem, planItemTransfer, type TransferItem } from '../planItemTransfer.ts';

function object(id: string, system: Record<string, unknown> = {}, name = id): TransferItem {
	return { _id: id, name, type: 'object', system };
}

const refuseNewId = () => {
	throw new Error('new id');
};

describe('planItemTransfer', () => {
	it('moves an object whole, unequipped and loose, and keeps its id', () => {
		const source = [object('sword', { equipped: true, containerId: 'pack', quantity: 1 }, 'Sword')];

		const plan = planItemTransfer(source, [], { itemId: 'sword', quantity: 1 }, refuseNewId);

		expect(plan).toMatchObject({
			removeIds: ['sword'],
			sourceQuantity: null,
			merge: null,
			name: 'Sword',
			moved: 1,
		});
		expect(plan?.add).toEqual([
			object('sword', { equipped: false, containerId: '', quantity: 1 }, 'Sword'),
		]);
	});

	it('splits a stack onto a new id and leaves the remainder', () => {
		const source = [
			object('torch', { quantity: 5, equipped: true, objectSizeType: 'stackable' }, 'Torch'),
		];
		let issued = 0;

		const plan = planItemTransfer(source, [], { itemId: 'torch', quantity: 2 }, () => {
			issued += 1;
			return 'torch-moved';
		});

		expect(issued).toBe(1);
		expect(plan?.removeIds).toEqual([]);
		expect(plan?.sourceQuantity).toEqual({ id: 'torch', quantity: 3 });
		expect(plan?.add[0]).toMatchObject({
			_id: 'torch-moved',
			system: { quantity: 2, equipped: false, containerId: '' },
		});
	});

	it('moves a container with its contents, and only the container comes out loose', () => {
		const source = [
			object(
				'pack',
				{ container: { enabled: true }, equipped: true, containerId: 'chest' },
				'Pack',
			),
			object('rope', { containerId: 'pack', equipped: true }, 'Rope'),
			object('gem', { containerId: 'other' }, 'Gem'),
		];

		const plan = planItemTransfer(source, [], { itemId: 'pack', quantity: 1 }, refuseNewId);

		expect(plan?.removeIds).toEqual(['pack', 'rope']);
		expect(plan?.add.map((item) => item._id)).toEqual(['pack', 'rope']);
		expect(plan?.add[0]?.system).toMatchObject({ equipped: false, containerId: '' });
		expect(plan?.add[1]?.system).toMatchObject({ equipped: false, containerId: 'pack' });
	});

	it('joins a loose stack of the same name and ignores a stack inside a container', () => {
		const source = [object('torch', { quantity: 2, objectSizeType: 'smallSized' }, 'Torch')];
		const destination = [
			object('stored', { quantity: 4, objectSizeType: 'smallSized', containerId: 'pack' }, 'Torch'),
			object('loose', { quantity: 1, objectSizeType: 'stackable', containerId: '' }, 'Torch'),
		];

		const plan = planItemTransfer(
			source,
			destination,
			{ itemId: 'torch', quantity: 2 },
			refuseNewId,
		);

		expect(plan?.add).toEqual([]);
		expect(plan?.merge).toEqual({ id: 'loose', add: 2 });
		expect(plan?.removeIds).toEqual(['torch']);
	});

	it('does not merge into itself, or into a stack that does not carry a quantity', () => {
		const torch = object('torch', { quantity: 2, objectSizeType: 'stackable' }, 'Torch');
		const other = object('other', { quantity: 2, objectSizeType: 'medium' }, 'Torch');

		expect(
			planItemTransfer([torch], [torch], { itemId: 'torch', quantity: 2 }, refuseNewId)?.merge,
		).toBeNull();
		expect(
			planItemTransfer([torch], [other], { itemId: 'torch', quantity: 2 }, refuseNewId)?.add,
		).toHaveLength(1);
	});

	it('still splits a stack whose size does not auto-merge', () => {
		const source = [object('torch', { quantity: 4 }, 'Torch')];

		const plan = planItemTransfer(
			source,
			[object('other', { quantity: 1 }, 'Torch')],
			{ itemId: 'torch', quantity: 1 },
			() => 'part',
		);

		expect(plan?.merge).toBeNull();
		expect(plan?.sourceQuantity).toEqual({ id: 'torch', quantity: 3 });
		expect(plan?.add[0]?._id).toBe('part');
	});

	it('takes a stored object out of its container', () => {
		const source = [object('rope', { containerId: 'pack' }, 'Rope')];

		const plan = planItemTransfer(source, [], { itemId: 'rope', quantity: 1 }, refuseNewId);

		expect(plan?.add[0]?.system?.containerId).toBe('');
		expect(plan?.removeIds).toEqual(['rope']);
	});

	it('moves the whole stack when the count is larger than the stack, and floors the count', () => {
		const source = [object('torch', { quantity: 3 }, 'Torch')];

		expect(planItemTransfer(source, [], { itemId: 'torch', quantity: 9 }, refuseNewId)?.moved).toBe(
			3,
		);
		expect(
			planItemTransfer(source, [], { itemId: 'torch', quantity: 2.9 }, () => 'part')?.moved,
		).toBe(2);
	});

	it('refuses a missing item, a non-object, and a count below 1', () => {
		const source = [
			object('torch', { quantity: 2 }, 'Torch'),
			{ _id: 'rage', type: 'feature', name: 'Rage' },
		];

		expect(
			planItemTransfer(source, [], { itemId: 'missing', quantity: 1 }, refuseNewId),
		).toBeNull();
		expect(planItemTransfer(source, [], { itemId: 'rage', quantity: 1 }, refuseNewId)).toBeNull();
		expect(planItemTransfer(source, [], { itemId: 'torch', quantity: 0 }, refuseNewId)).toBeNull();
		expect(
			planItemTransfer(source, [], { itemId: 'torch', quantity: Number.NaN }, refuseNewId),
		).toBeNull();
	});
});

describe('mayTransferItem', () => {
	const player = {
		isGM: false,
		trusted: false,
		ownsSource: false,
		ownsDestination: false,
	};

	it('lets any player move their own objects into the party inventory and back onto a character they own', () => {
		expect(
			mayTransferItem({
				...player,
				source: 'actor',
				destination: 'stash',
				ownsSource: true,
			}),
		).toBe(true);
		expect(
			mayTransferItem({
				...player,
				source: 'stash',
				destination: 'actor',
				ownsDestination: true,
			}),
		).toBe(true);
		expect(
			mayTransferItem({
				...player,
				source: 'actor',
				destination: 'stash',
			}),
		).toBe(false);
		expect(
			mayTransferItem({
				...player,
				source: 'actor',
				destination: 'actor',
				ownsSource: true,
			}),
		).toBe(false);
	});

	it('lets a trusted player send objects to any character, from their own inventory or the stash', () => {
		expect(
			mayTransferItem({
				...player,
				trusted: true,
				source: 'actor',
				destination: 'actor',
				ownsSource: true,
			}),
		).toBe(true);
		expect(
			mayTransferItem({
				...player,
				trusted: true,
				source: 'stash',
				destination: 'actor',
			}),
		).toBe(true);
		expect(
			mayTransferItem({
				...player,
				trusted: true,
				source: 'actor',
				destination: 'actor',
			}),
		).toBe(false);
	});

	it('lets a GM move anything', () => {
		expect(
			mayTransferItem({
				...player,
				isGM: true,
				source: 'actor',
				destination: 'actor',
			}),
		).toBe(true);
	});
});
