import { render, waitFor } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { SpellIndexEntry } from '#utils/getSpells.js';
import LevelUpSpellCardStateHarness from '../../../../../tests/harnesses/LevelUpSpellCardStateHarness.svelte';

/** Back `fromUuid` with one in-memory spell document. */
function stubSpellDocument(uuid: string, system: Record<string, unknown>): void {
	vi.stubGlobal('fromUuid', async (requested: string) =>
		requested === uuid ? { uuid, system } : null,
	);
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
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('labels a tiered spell with its tier in mana', async () => {
		stubSpellDocument('Item.test-spell', { tier: 3 });
		const { getByTestId } = render(LevelUpSpellCardStateHarness, {
			props: { spell: createIndexEntry(3) },
		});

		await waitFor(() => expect(getByTestId('loaded').textContent).toBe('true'));
		expect(getByTestId('cost-label').textContent).toBe('3 Mana');
	});

	it('shows no cost for a cantrip', async () => {
		stubSpellDocument('Item.test-spell', { tier: 0 });
		const { getByTestId } = render(LevelUpSpellCardStateHarness, {
			props: { spell: createIndexEntry(0) },
		});

		await waitFor(() => expect(getByTestId('loaded').textContent).toBe('true'));
		expect(getByTestId('cost-label').textContent).toBe('');
	});
});
