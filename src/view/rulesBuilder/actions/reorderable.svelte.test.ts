import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { reorderable } from './reorderable.svelte.js';

/**
 * Minimal DataTransfer stub. JSDOM doesn't implement enough of the
 * DragEvent / DataTransfer surface to drive the reorderable action
 * end-to-end, so we hand-construct one. Captures `setData` calls into a
 * map and exposes `types` / `getData` over the same store.
 */
function createDataTransferStub() {
	const store = new Map<string, string>();
	return {
		store,
		dataTransfer: {
			get types() {
				return Array.from(store.keys());
			},
			setData(type: string, data: string) {
				store.set(type, data);
			},
			getData(type: string) {
				return store.get(type) ?? '';
			},
			effectAllowed: 'none',
			dropEffect: 'none',
		} as unknown as DataTransfer,
	};
}

function makeList(ids: string[]): HTMLElement {
	const ul = document.createElement('ul');
	for (const id of ids) {
		const li = document.createElement('li');
		li.dataset.reorderId = id;
		li.draggable = true;
		ul.appendChild(li);
	}
	return ul;
}

function dragEvent(name: string, target: Element, dt: DataTransfer): Event {
	// JSDOM's DragEvent constructor doesn't accept a dataTransfer init, so
	// build a generic Event and patch in the target/dataTransfer.
	const event = new Event(name, { bubbles: true, cancelable: true });
	Object.defineProperty(event, 'target', { value: target, configurable: true });
	Object.defineProperty(event, 'dataTransfer', { value: dt, configurable: true });
	return event;
}

describe('reorderable cross-list MIME isolation', () => {
	let listA: HTMLElement;
	let listB: HTMLElement;
	let onCopyA: ReturnType<typeof vi.fn>;
	let onCopyB: ReturnType<typeof vi.fn>;
	let actionA: ReturnType<typeof reorderable>;
	let actionB: ReturnType<typeof reorderable>;

	beforeEach(() => {
		document.body.innerHTML = '';
		listA = makeList(['a1']);
		listB = makeList(['b1']);
		document.body.appendChild(listA);
		document.body.appendChild(listB);
		onCopyA = vi.fn();
		onCopyB = vi.fn();
		actionA = reorderable(listA, {
			enabled: true,
			copyAcceptType: 'nimble.Rule',
			getDragPayload: (id) => ({ id, source: 'A' }),
			onCopy: onCopyA,
		});
		actionB = reorderable(listB, {
			enabled: true,
			copyAcceptType: 'nimble.Other',
			getDragPayload: (id) => ({ id, source: 'B' }),
			onCopy: onCopyB,
		});
	});

	afterEach(() => {
		actionA.destroy();
		actionB.destroy();
	});

	it('lists with different copyAcceptType use different MIMEs', () => {
		const sourceItem = listA.querySelector('[data-reorder-id="a1"]') as HTMLElement;
		const { dataTransfer, store } = createDataTransferStub();

		listA.dispatchEvent(dragEvent('dragstart', sourceItem, dataTransfer));

		const types = Array.from(store.keys());
		const reorderableMimes = types.filter((t) => t.startsWith('application/x-nimble-reorderable+'));
		expect(reorderableMimes).toHaveLength(1);
		expect(reorderableMimes[0]).toContain('nimble.rule');
		expect(reorderableMimes[0]).not.toContain('nimble.other');
	});

	it('does not trigger foreign-drag visuals on a list whose accept type does not match', () => {
		const sourceItem = listA.querySelector('[data-reorder-id="a1"]') as HTMLElement;
		const { dataTransfer } = createDataTransferStub();

		listA.dispatchEvent(dragEvent('dragstart', sourceItem, dataTransfer));
		// Simulate the dragend that resets list-A's `draggedItem` state, so
		// list B sees a "foreign" drag with only A's MIME present.
		listA.dispatchEvent(dragEvent('dragend', sourceItem, dataTransfer));

		listB.dispatchEvent(dragEvent('dragover', listB, dataTransfer));

		// List B's MIME isn't on the dataTransfer → no foreign-drag class.
		expect(listB.classList.contains('nimble-reorderable--foreign-drag')).toBe(false);
	});

	it('drop on a list with non-matching MIME does not invoke onCopy', () => {
		const sourceItem = listA.querySelector('[data-reorder-id="a1"]') as HTMLElement;
		const { dataTransfer } = createDataTransferStub();

		listA.dispatchEvent(dragEvent('dragstart', sourceItem, dataTransfer));
		listA.dispatchEvent(dragEvent('dragend', sourceItem, dataTransfer));

		listB.dispatchEvent(dragEvent('drop', listB, dataTransfer));

		expect(onCopyB).not.toHaveBeenCalled();
	});

	it('drop on a list with matching MIME invokes onCopy with the parsed payload', () => {
		// Make a fresh "third" list with the same accept type as A so a drop
		// from A onto it should succeed.
		const listC = makeList([]);
		document.body.appendChild(listC);
		const onCopyC = vi.fn();
		const actionC = reorderable(listC, {
			enabled: true,
			copyAcceptType: 'nimble.Rule',
			onCopy: onCopyC,
		});

		const sourceItem = listA.querySelector('[data-reorder-id="a1"]') as HTMLElement;
		const { dataTransfer } = createDataTransferStub();

		listA.dispatchEvent(dragEvent('dragstart', sourceItem, dataTransfer));
		listA.dispatchEvent(dragEvent('dragend', sourceItem, dataTransfer));
		listC.dispatchEvent(dragEvent('drop', listC, dataTransfer));

		expect(onCopyC).toHaveBeenCalledOnce();
		const payload = onCopyC.mock.calls[0]?.[0] as Record<string, unknown>;
		expect(payload.id).toBe('a1');
		expect(payload.source).toBe('A');
		expect(payload.type).toBe('nimble.Rule');

		actionC.destroy();
		listC.remove();
	});

	it('text/plain payload alone does not trigger onCopy', () => {
		// Simulates a Foundry document drag (sets text/plain only) that
		// happens to look like our payload. The MIME-only gate should
		// reject it.
		const { dataTransfer, store } = createDataTransferStub();
		store.set('text/plain', JSON.stringify({ type: 'nimble.Rule', id: 'spoof' }));

		listA.dispatchEvent(dragEvent('dragover', listA, dataTransfer));
		listA.dispatchEvent(dragEvent('drop', listA, dataTransfer));

		expect(onCopyA).not.toHaveBeenCalled();
		expect(listA.classList.contains('nimble-reorderable--foreign-drag')).toBe(false);
	});

	it('drop-only list (no getDragPayload) does not pollute dataTransfer with the MIME', () => {
		const dropOnly = makeList(['d1']);
		document.body.appendChild(dropOnly);
		const action = reorderable(dropOnly, {
			enabled: true,
			copyAcceptType: 'nimble.Rule',
			onCopy: vi.fn(),
		});

		const sourceItem = dropOnly.querySelector('[data-reorder-id="d1"]') as HTMLElement;
		const { dataTransfer, store } = createDataTransferStub();

		dropOnly.dispatchEvent(dragEvent('dragstart', sourceItem, dataTransfer));

		// No payload provider → no MIME should be set; nothing for foreign
		// receivers to mistake for a real drag.
		const reorderableMimes = Array.from(store.keys()).filter((t) =>
			t.startsWith('application/x-nimble-reorderable+'),
		);
		expect(reorderableMimes).toHaveLength(0);

		action.destroy();
		dropOnly.remove();
	});
});
