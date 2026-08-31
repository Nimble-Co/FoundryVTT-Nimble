import { flushSync } from 'svelte';
import { describe, expect, it, vi } from 'vitest';

import { createVariantOptionsInputState } from './VariantOptionsInput.svelte.ts';

// The factory reads its props through a getter, so a `$state` holder here lets the test re-point the
// stored list the way the sheet does when `item.update()` round-trips.
function createState({
	selectedVariants = [] as string[] | undefined,
	// Shares no words with the variant names or summary strings, so no branch passes for another.
	ancestryName = 'Fey-Kin',
} = {}) {
	let storedVariants = $state(selectedVariants);
	const onChange = vi.fn((nextVariants: string[]) => {
		storedVariants = nextVariants;
	});

	const state = createVariantOptionsInputState(() => ({
		get selectedVariants() {
			return storedVariants;
		},
		ancestryName,
		onChange,
	}));

	return { state, onChange };
}

describe('createVariantOptionsInputState', () => {
	it('adds the drafted name and clears the field', () => {
		const cleanup = $effect.root(() => {
			const { state, onChange } = createState({ selectedVariants: ['Dryad'] });

			state.draftVariant = 'Shroomling';
			state.addDraftVariant();

			expect(onChange).toHaveBeenCalledWith(['Dryad', 'Shroomling']);
			expect(state.draftVariant).toBe('');
			expect(state.duplicateVariant).toBe('');
		});

		cleanup();
	});

	it('trims the drafted name, including the copy it puts in the notice', () => {
		const cleanup = $effect.root(() => {
			const { state, onChange } = createState({ selectedVariants: ['Oozeling'] });

			state.draftVariant = '  Oozeling  ';
			state.addDraftVariant();

			expect(onChange).not.toHaveBeenCalled();
			expect(state.duplicateVariant).toBe('Oozeling');
		});

		cleanup();
	});

	it('re-derives the list and the summary when the sheet writes the change back', () => {
		const cleanup = $effect.root(() => {
			const { state } = createState({ selectedVariants: ['Dryad'] });

			expect(state.currentVariants).toEqual(['Dryad']);
			expect(state.summary).toBe(game.i18n.localize('NIMBLE.ancestrySheet.variantsSummaryOne'));

			state.draftVariant = 'Shroomling';
			state.addDraftVariant();
			flushSync();

			expect(state.currentVariants).toEqual(['Dryad', 'Shroomling']);
			expect(state.summary).toBe(
				game.i18n.format('NIMBLE.ancestrySheet.variantsSummaryChoice', {
					variants: 'Dryad or Shroomling',
				}),
			);
		});

		cleanup();
	});

	it('keeps a name the list already carries in the field and names it in the notice', () => {
		const cleanup = $effect.root(() => {
			const { state, onChange } = createState({ selectedVariants: ['Dryad', 'Shroomling'] });

			state.draftVariant = 'dryad';
			state.addDraftVariant();

			expect(onChange).not.toHaveBeenCalled();
			expect(state.draftVariant).toBe('dryad');
			expect(state.duplicateVariant).toBe('dryad');
		});

		cleanup();
	});

	it('clears the duplicate notice once a name is removed', () => {
		const cleanup = $effect.root(() => {
			const { state, onChange } = createState({ selectedVariants: ['Dryad', 'Shroomling'] });

			state.draftVariant = 'Dryad';
			state.addDraftVariant();
			expect(state.duplicateVariant).toBe('Dryad');

			state.removeListedVariant('Dryad');

			expect(onChange).toHaveBeenCalledWith(['Shroomling']);
			expect(state.duplicateVariant).toBe('');
		});

		cleanup();
	});

	it('adds on Enter and keeps the keypress from submitting the sheet', () => {
		const cleanup = $effect.root(() => {
			const { state, onChange } = createState({ selectedVariants: ['Dryad'] });
			const event = new KeyboardEvent('keydown', { key: 'Enter', cancelable: true });

			state.draftVariant = 'Shroomling';
			state.handleKeydown(event);

			expect(onChange).toHaveBeenCalledWith(['Dryad', 'Shroomling']);
			expect(event.defaultPrevented).toBe(true);
		});

		cleanup();
	});

	it('ignores any other key', () => {
		const cleanup = $effect.root(() => {
			const { state, onChange } = createState();

			state.draftVariant = 'Shroomling';
			state.handleKeydown(new KeyboardEvent('keydown', { key: 'a', cancelable: true }));

			expect(onChange).not.toHaveBeenCalled();
			expect(state.draftVariant).toBe('Shroomling');
		});

		cleanup();
	});

	it('normalizes a stored list that carries blanks and repeats', () => {
		const cleanup = $effect.root(() => {
			const { state } = createState({ selectedVariants: [' Dryad ', '', 'dryad', 'Shroomling'] });

			expect(state.currentVariants).toEqual(['Dryad', 'Shroomling']);
		});

		cleanup();
	});

	it('says the list becomes a player choice once it holds two names', () => {
		const cleanup = $effect.root(() => {
			const { state } = createState({ selectedVariants: ['Dryad', 'Shroomling'] });

			expect(state.summary).toBe(
				game.i18n.format('NIMBLE.ancestrySheet.variantsSummaryChoice', {
					variants: 'Dryad or Shroomling',
				}),
			);
		});

		cleanup();
	});

	it('says a lone name is not yet a choice', () => {
		const cleanup = $effect.root(() => {
			const { state } = createState({ selectedVariants: ['Dryad'] });

			expect(state.summary).toBe(game.i18n.localize('NIMBLE.ancestrySheet.variantsSummaryOne'));
		});

		cleanup();
	});

	it('names the ancestry itself when it lists no variants', () => {
		const cleanup = $effect.root(() => {
			const { state } = createState({ selectedVariants: [], ancestryName: 'Half-Giant' });

			expect(state.summary).toBe(
				game.i18n.format('NIMBLE.ancestrySheet.variantsSummaryNone', { ancestry: 'Half-Giant' }),
			);
		});

		cleanup();
	});
});
