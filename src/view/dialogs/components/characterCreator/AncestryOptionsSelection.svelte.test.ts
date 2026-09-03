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
	});

	it('states the chosen variant and puts changing it behind an edit control', async () => {
		renderOptions(createAncestry({ variants: ['Dryad', 'Shroomling'] }));

		await fireEvent.click(screen.getByRole('radio', { name: 'Shroomling' }));

		expect(screen.queryByRole('radiogroup', { name: 'Ancestry Variant' })).not.toBeInTheDocument();
		expect(document.querySelector('.nimble-ancestry-choice__granted')).toHaveTextContent(
			'Shroomling',
		);

		await fireEvent.click(screen.getByRole('button', { name: 'Edit Ancestry Variant Selection' }));

		expect(screen.getByRole('radiogroup', { name: 'Ancestry Variant' })).toBeInTheDocument();
		expect(screen.getByTestId('selected-ancestry-variant')).toHaveTextContent('null');
	});

	// Three options, not two: with two, forwards and backwards land on the same one.
	it('walks focus forwards and backwards with the arrow keys, wrapping at both ends', async () => {
		renderOptions(createAncestry({ variants: ['Dryad', 'Shroomling', 'Sporeling'] }));
		const focused = () => document.activeElement;

		await fireEvent.keyDown(screen.getByRole('radio', { name: 'Dryad' }), { key: 'ArrowDown' });
		expect(focused()).toBe(screen.getByRole('radio', { name: 'Shroomling' }));

		await fireEvent.keyDown(screen.getByRole('radio', { name: 'Shroomling' }), {
			key: 'ArrowDown',
		});
		expect(focused()).toBe(screen.getByRole('radio', { name: 'Sporeling' }));

		await fireEvent.keyDown(screen.getByRole('radio', { name: 'Sporeling' }), {
			key: 'ArrowDown',
		});
		expect(focused()).toBe(screen.getByRole('radio', { name: 'Dryad' }));

		await fireEvent.keyDown(screen.getByRole('radio', { name: 'Dryad' }), { key: 'ArrowUp' });
		expect(focused()).toBe(screen.getByRole('radio', { name: 'Sporeling' }));

		await fireEvent.keyDown(screen.getByRole('radio', { name: 'Sporeling' }), { key: 'ArrowLeft' });
		expect(focused()).toBe(screen.getByRole('radio', { name: 'Shroomling' }));

		await fireEvent.keyDown(screen.getByRole('radio', { name: 'Shroomling' }), {
			key: 'ArrowRight',
		});
		expect(focused()).toBe(screen.getByRole('radio', { name: 'Sporeling' }));
	});

	it('chooses nothing until the walked-to option is pressed', async () => {
		renderOptions(createAncestry({ variants: ['Dryad', 'Shroomling', 'Sporeling'] }));

		await fireEvent.keyDown(screen.getByRole('radio', { name: 'Dryad' }), { key: 'ArrowDown' });
		expect(screen.getByTestId('selected-ancestry-variant')).toHaveTextContent('null');

		await fireEvent.click(screen.getByRole('radio', { name: 'Shroomling' }));
		expect(screen.getByTestId('selected-ancestry-variant')).toHaveTextContent('Shroomling');
	});

	it('moves focus to the walked-to radio and keeps the group to one tab stop', async () => {
		renderOptions(createAncestry({ variants: ['Dryad', 'Shroomling', 'Sporeling'] }));

		await fireEvent.keyDown(screen.getByRole('radio', { name: 'Dryad' }), { key: 'ArrowDown' });

		const shroomling = screen.getByRole('radio', { name: 'Shroomling' });
		expect(document.activeElement).toBe(shroomling);
		expect(shroomling).toHaveAttribute('tabindex', '0');
		expect(screen.getByRole('radio', { name: 'Dryad' })).toHaveAttribute('tabindex', '-1');
		expect(screen.getByRole('radio', { name: 'Sporeling' })).toHaveAttribute('tabindex', '-1');
	});

	it('marks each variant with an icon of what kind of people it is', () => {
		renderOptions(createAncestry({ variants: ['Dryad', 'Shroomling', 'Sporeling'] }));

		const iconOf = (name: string) =>
			screen
				.getByRole('radio', { name })
				.querySelector('.nimble-ancestry-choice__icon')
				?.getAttribute('style');

		expect(iconOf('Dryad')).toContain('/assets/icons/dryad.svg');
		expect(iconOf('Shroomling')).toContain('/assets/icons/shroomling.svg');
		expect(iconOf('Sporeling')).toContain('/assets/icons/ancestry-variant.svg');
	});

	it('asks nothing of an ancestry that covers a single kind of people', () => {
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

	it('states a fixed size rather than asking for it, and gives it no step of its own', () => {
		renderOptions(createAncestry({ name: 'Half-Giant', size: ['large'] }));

		expect(screen.queryByRole('radiogroup', { name: 'Size Category' })).not.toBeInTheDocument();
		expect(screen.getByText(/set by Half-Giant/)).toBeInTheDocument();
		expect(screen.queryByRole('heading', { name: /Step 2/ })).not.toBeInTheDocument();
	});

	it('shows both sections when the ancestry offers a variant and a size', () => {
		renderOptions(createAncestry({ size: ['small', 'medium'], variants: ['Dryad', 'Shroomling'] }));

		expect(screen.getByRole('radiogroup', { name: 'Ancestry Variant' })).toBeInTheDocument();
		expect(screen.getByRole('radiogroup', { name: 'Size Category' })).toBeInTheDocument();
	});
});

describe('AncestryOptionsSelection step numbering', () => {
	it('letters the steps in the order they are asked, starting after the ancestry bonus', () => {
		renderOptions(createAncestry({ size: ['small', 'medium'], variants: ['Dryad', 'Shroomling'] }));

		expect(screen.getByRole('heading', { name: 'Step 2c. Ancestry Variant' })).toBeInTheDocument();
		expect(screen.getByRole('heading', { name: 'Step 2d. Size Category' })).toBeInTheDocument();
	});

	it('closes the gap a step that is never asked would otherwise leave', () => {
		renderOptions(createAncestry({ size: ['small', 'medium'] }));

		expect(screen.getByRole('heading', { name: 'Step 2c. Size Category' })).toBeInTheDocument();
	});
});
