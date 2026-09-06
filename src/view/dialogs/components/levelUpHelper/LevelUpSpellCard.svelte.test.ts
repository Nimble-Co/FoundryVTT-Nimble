import { render, waitFor } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';

import type { SpellIndexEntry } from '#utils/getSpells.js';
import LevelUpSpellCardStateHarness from '../../../../../tests/harnesses/LevelUpSpellCardStateHarness.svelte';

/** Back `fromUuid` with one in-memory spell document. Returns a restore function. */
function stubSpellDocument(uuid: string, system: Record<string, unknown>): () => void {
	const g = globalThis as unknown as { fromUuid?: (uuid: string) => Promise<unknown> };
	const original = g.fromUuid;
	g.fromUuid = async (requested: string) => (requested === uuid ? { uuid, system } : null);
	return () => {
		g.fromUuid = original;
	};
}

function createIndexEntry(tier: number): SpellIndexEntry {
	return {
		uuid: 'Item.test-spell',
		name: 'Test Spell',
		img: 'icons/svg/explosion.svg',
		school: 'fire',
		tier,
		isUtility: false,
		classes: [],
	};
}

describe('createLevelUpSpellCardState', () => {
	let restore: (() => void) | null = null;

	afterEach(() => {
		restore?.();
		restore = null;
	});

	it('reads a tiered spell as costing its tier in mana', async () => {
		restore = stubSpellDocument('Item.test-spell', { tier: 3 });
		const { getByTestId } = render(LevelUpSpellCardStateHarness, {
			props: { spell: createIndexEntry(3) },
		});

		await waitFor(() => expect(getByTestId('mana-cost').textContent).toBe('3'));
	});

	it('reads a cantrip as free', async () => {
		restore = stubSpellDocument('Item.test-spell', { tier: 0 });
		const { getByTestId } = render(LevelUpSpellCardStateHarness, {
			props: { spell: createIndexEntry(0) },
		});

		await waitFor(() => expect(getByTestId('mana-cost').textContent).toBe('0'));
	});
});
