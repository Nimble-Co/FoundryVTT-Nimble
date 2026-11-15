import { fireEvent, render, waitFor } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';
import RulesBuilderWindow from '#view/rulesBuilder/RulesBuilderWindow.svelte';
import { COPY_TYPE } from '../ItemRulesTab.svelte.js';
import ItemRulesTab from './ItemRulesTab.testHarness.svelte';

const MIME = `application/x-nimble-reorderable+${COPY_TYPE.toLowerCase()}`;

function emptyItem() {
	const item = {
		uuid: 'Item.target',
		name: 'Target',
		system: { rules: [] },
		actor: null,
		get reactive() {
			return item;
		},
		rules: { addRule: vi.fn(async () => undefined) },
	};
	return item;
}

function dropCopiedRule(target: Element) {
	const payload = JSON.stringify({
		rule: { id: 'r1', type: 'note', label: 'Copied' },
		sourceItemUuid: 'Item.source',
		type: COPY_TYPE,
	});
	const dataTransfer = {
		types: [MIME, 'text/plain'],
		getData: (type: string) => (type === MIME ? payload : ''),
		dropEffect: 'none',
	};
	return fireEvent.drop(target, { dataTransfer });
}

describe('a rule dropped on a list with no rules', () => {
	it('is copied onto the item from the Rules tab', async () => {
		const item = emptyItem();
		const { container } = render(ItemRulesTab, { props: { item } });

		await dropCopiedRule(container.querySelector('.nimble-rules-tab__empty')!);

		await waitFor(() =>
			expect(item.rules.addRule).toHaveBeenCalledWith({ type: 'note', label: 'Copied' }),
		);
	});

	it('is copied onto the item from the Rules Builder', async () => {
		const item = emptyItem();
		const { container } = render(RulesBuilderWindow, { props: { document: item as never } });

		await dropCopiedRule(container.querySelector('.nimble-rules-builder-window__empty')!);

		await waitFor(() =>
			expect(item.rules.addRule).toHaveBeenCalledWith({ type: 'note', label: 'Copied' }),
		);
	});
});
