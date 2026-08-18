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

	// Three options, not two: with two, forwards and backwards land on the same option, so the
	// direction of every arrow key would go unverified.
	it('carries the selection forwards and backwards with the arrow keys, wrapping at both ends', async () => {
		renderOptions(createAncestry({ variants: ['Dryad', 'Shroomling', 'Sporeling'] }));
		const selected = () => screen.getByTestId('selected-ancestry-variant');

		await fireEvent.keyDown(screen.getByRole('radio', { name: 'Dryad' }), { key: 'ArrowDown' });
		expect(selected()).toHaveTextContent('Shroomling');

		await fireEvent.keyDown(screen.getByRole('radio', { name: 'Shroomling' }), {
			key: 'ArrowDown',
		});
		expect(selected()).toHaveTextContent('Sporeling');

		// Past the last option the choice wraps back to the first.
		await fireEvent.keyDown(screen.getByRole('radio', { name: 'Sporeling' }), {
			key: 'ArrowDown',
		});
		expect(selected()).toHaveTextContent('Dryad');

		// Backwards past the first reaches the last.
		await fireEvent.keyDown(screen.getByRole('radio', { name: 'Dryad' }), { key: 'ArrowUp' });
		expect(selected()).toHaveTextContent('Sporeling');

		// Left and right move the same way as up and down.
		await fireEvent.keyDown(screen.getByRole('radio', { name: 'Sporeling' }), { key: 'ArrowLeft' });
		expect(selected()).toHaveTextContent('Shroomling');

		await fireEvent.keyDown(screen.getByRole('radio', { name: 'Shroomling' }), {
			key: 'ArrowRight',
		});
		expect(selected()).toHaveTextContent('Sporeling');
	});

	it('moves focus to the chosen radio and keeps the group to one tab stop', async () => {
		renderOptions(createAncestry({ variants: ['Dryad', 'Shroomling', 'Sporeling'] }));

		await fireEvent.keyDown(screen.getByRole('radio', { name: 'Dryad' }), { key: 'ArrowDown' });

		const shroomling = screen.getByRole('radio', { name: 'Shroomling' });
		expect(document.activeElement).toBe(shroomling);
		// A radiogroup is one stop in the tab order: only the chosen radio is reachable by Tab.
		expect(shroomling).toHaveAttribute('tabindex', '0');
		expect(screen.getByRole('radio', { name: 'Dryad' })).toHaveAttribute('tabindex', '-1');
		expect(screen.getByRole('radio', { name: 'Sporeling' })).toHaveAttribute('tabindex', '-1');
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
