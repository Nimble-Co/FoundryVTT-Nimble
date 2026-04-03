import { fireEvent, render, screen } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';

import type { SpellIndexEntry } from '#utils/getSpells.js';
// @ts-expect-error - Svelte component default export is provided by the Svelte compiler
import SpellSelection from './SpellSelection.svelte';

function createSpellEntry({
	uuid,
	name,
	school,
}: {
	uuid: string;
	name: string;
	school: string;
}): SpellIndexEntry {
	return {
		uuid,
		name,
		img: 'icons/svg/item-bag.svg',
		school,
		tier: 0,
		isUtility: false,
		classes: [],
	};
}

describe('SpellSelection', () => {
	it('collapses to the selected spell at the limit, disables other options, and restores them after deselection', async () => {
		const group = {
			ruleId: 'spell-choice',
			label: 'Choose a Spell',
			availableSpells: [
				createSpellEntry({
					uuid: 'Compendium.nimble.nimble-spells.Item.arc-spark',
					name: 'Arc Spark',
					school: 'lightning',
				}),
				createSpellEntry({
					uuid: 'Compendium.nimble.nimble-spells.Item.blizzard',
					name: 'Blizzard',
					school: 'ice',
				}),
			],
			count: 1,
			utilityOnly: false,
			forClass: 'mage',
			source: 'background' as const,
		};

		let selected: string[] = [];
		const onSelect = vi.fn((nextSelected: string[]) => {
			selected = nextSelected;
			void rerender({
				group,
				selected,
				onSelect,
			});
		});

		const { rerender } = render(SpellSelection, {
			props: {
				group,
				selected,
				onSelect,
			},
		});

		await fireEvent.click(screen.getByRole('button', { name: 'Select Blizzard' }));
		expect(onSelect).toHaveBeenLastCalledWith(['Compendium.nimble.nimble-spells.Item.blizzard']);
		expect(screen.getByRole('button', { name: 'Change' })).toBeInTheDocument();
		expect(screen.queryByRole('button', { name: 'Select Arc Spark' })).not.toBeInTheDocument();

		await fireEvent.click(screen.getByRole('button', { name: 'Change' }));

		expect(screen.getByRole('button', { name: 'Deselect Blizzard' })).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Select Arc Spark' })).toBeDisabled();

		await fireEvent.click(screen.getByRole('button', { name: 'Deselect Blizzard' }));
		expect(onSelect).toHaveBeenLastCalledWith([]);

		expect(screen.getByRole('button', { name: 'Select Arc Spark' })).toBeEnabled();
		expect(screen.getByRole('button', { name: 'Select Blizzard' })).toBeEnabled();
	});
});
