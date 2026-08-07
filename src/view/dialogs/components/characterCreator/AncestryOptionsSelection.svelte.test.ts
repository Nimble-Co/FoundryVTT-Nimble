import { fireEvent, render, screen } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';

import AncestryOptionsSelectionHarness from '../../../../../tests/harnesses/AncestryOptionsSelectionHarness.svelte';

function createAncestry({
	name = 'Dryad/Shroomling',
	size = ['medium'],
	variants = [] as string[],
} = {}) {
	return {
		uuid: 'Compendium.nimble.nimble-ancestries.Item.dryadshroomling',
		name,
		system: { size, variants, rules: [] },
	} as unknown as NimbleAncestryItem;
}

function renderOptions(ancestry: NimbleAncestryItem | null) {
	render(AncestryOptionsSelectionHarness, { props: { selectedAncestry: ancestry } });
}

describe('AncestryOptionsSelection variant choice', () => {
	it('offers a radio per variant with none selected until the player picks', async () => {
		renderOptions(createAncestry({ variants: ['Dryad', 'Shroomling'] }));

		const variantGroup = screen.getByRole('radiogroup', { name: 'Ancestry Variant' });
		const variants = screen.getAllByRole('radio', { name: /Dryad|Shroomling/ });

		expect(variantGroup).toBeInTheDocument();
		expect(variants.map((radio) => radio.getAttribute('aria-checked'))).toEqual(['false', 'false']);

		await fireEvent.click(screen.getByRole('radio', { name: 'Shroomling' }));

		expect(screen.getByTestId('selected-ancestry-variant')).toHaveTextContent('Shroomling');
		expect(screen.getByRole('radio', { name: 'Shroomling' })).toHaveAttribute(
			'aria-checked',
			'true',
		);
	});

	it('carries the selection with the arrow keys, wrapping at both ends', async () => {
		renderOptions(createAncestry({ variants: ['Dryad', 'Shroomling'] }));

		await fireEvent.keyDown(screen.getByRole('radio', { name: 'Dryad' }), { key: 'ArrowDown' });
		expect(screen.getByTestId('selected-ancestry-variant')).toHaveTextContent('Shroomling');

		// Past the last option the choice wraps back to the first.
		await fireEvent.keyDown(screen.getByRole('radio', { name: 'Shroomling' }), {
			key: 'ArrowDown',
		});
		expect(screen.getByTestId('selected-ancestry-variant')).toHaveTextContent('Dryad');

		// And back past the first to the last.
		await fireEvent.keyDown(screen.getByRole('radio', { name: 'Dryad' }), { key: 'ArrowUp' });
		expect(screen.getByTestId('selected-ancestry-variant')).toHaveTextContent('Shroomling');
	});

	it('asks nothing of an ancestry that covers a single kind of people', () => {
		// A lone variant is the ancestry's own name, so the section has nothing to show for it.
		renderOptions(createAncestry({ variants: ['Dryad'] }));

		expect(screen.queryByRole('radiogroup', { name: 'Ancestry Variant' })).not.toBeInTheDocument();
	});
});

describe('AncestryOptionsSelection size choice', () => {
	it('offers a radio per size and records the one clicked', async () => {
		renderOptions(createAncestry({ size: ['small', 'medium'] }));

		expect(screen.getByRole('radiogroup', { name: 'Size Category' })).toBeInTheDocument();

		await fireEvent.click(screen.getByRole('radio', { name: /Small/ }));

		expect(screen.getByTestId('selected-ancestry-size')).toHaveTextContent('small');
	});

	it('states a fixed size rather than asking for it', () => {
		renderOptions(createAncestry({ name: 'Half-Giant', size: ['large'] }));

		expect(screen.queryByRole('radiogroup', { name: 'Size Category' })).not.toBeInTheDocument();
		expect(screen.getByText(/set by Half-Giant/)).toBeInTheDocument();
	});

	it('shows both sections when the ancestry offers a variant and a size', () => {
		renderOptions(createAncestry({ size: ['small', 'medium'], variants: ['Dryad', 'Shroomling'] }));

		expect(screen.getByRole('radiogroup', { name: 'Ancestry Variant' })).toBeInTheDocument();
		expect(screen.getByRole('radiogroup', { name: 'Size Category' })).toBeInTheDocument();
	});
});
