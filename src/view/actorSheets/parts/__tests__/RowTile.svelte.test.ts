import { render } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import RowTile from '../RowTile.svelte';

describe('RowTile', () => {
	it('shows painted art as an image', () => {
		const { container } = render(RowTile, { img: 'worlds/ash/sword.webp' });

		expect(container.querySelector('img')).toHaveAttribute('src', 'worlds/ash/sword.webp');
		expect(container.querySelector('.glyph')).toBeNull();
	});

	it('shows a core icon as a bronze glyph on a dark tile', () => {
		const { container } = render(RowTile, { img: 'icons/svg/item-bag.svg' });

		expect(container.querySelector('img')).toBeNull();
		expect(container.querySelector<HTMLElement>('.glyph')?.style.getPropertyValue('--glyph')).toBe(
			'url(icons/svg/item-bag.svg)',
		);
	});
});
