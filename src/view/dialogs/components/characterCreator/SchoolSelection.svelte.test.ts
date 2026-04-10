import { fireEvent, render, screen } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';

import type { SpellIndex, SpellIndexEntry } from '#utils/getSpells.js';
// @ts-expect-error - Svelte component default export is provided by the Svelte compiler
import SchoolSelection from './SchoolSelection.svelte';

function createSpellEntry({
	uuid,
	name,
	school = 'fire',
	isUtility = false,
	classes = [],
}: {
	uuid: string;
	name: string;
	school?: string;
	isUtility?: boolean;
	classes?: string[];
}): SpellIndexEntry {
	return {
		uuid,
		name,
		img: 'icons/svg/item-bag.svg',
		school,
		tier: 0,
		isUtility,
		classes,
	};
}

function createSpellIndex(entries: SpellIndexEntry[]): SpellIndex {
	const index: SpellIndex = new Map();

	for (const entry of entries) {
		if (!index.has(entry.school)) {
			index.set(entry.school, new Map());
		}

		const tierMap = index.get(entry.school)!;
		if (!tierMap.has(entry.tier)) {
			tierMap.set(entry.tier, []);
		}

		tierMap.get(entry.tier)!.push(entry);
	}

	return index;
}

describe('SchoolSelection', () => {
	it('replaces the current school at the selection limit and previews only matching spells', async () => {
		const group = {
			ruleId: 'school-choice',
			label: 'Choose a School',
			availableSchools: ['fire', 'ice'],
			tiers: [0],
			count: 1,
			utilityOnly: false,
			forClass: 'mage',
			source: 'class' as const,
		};
		const spellIndex = createSpellIndex([
			createSpellEntry({
				uuid: 'Compendium.nimble.nimble-spells.Item.fire-bolt',
				name: 'Fire Bolt',
				school: 'fire',
			}),
			createSpellEntry({
				uuid: 'Compendium.nimble.nimble-spells.Item.fire-utility',
				name: 'Fire Utility',
				school: 'fire',
				isUtility: true,
			}),
			createSpellEntry({
				uuid: 'Compendium.nimble.nimble-spells.Item.fire-rogue',
				name: 'Rogue Fire',
				school: 'fire',
				classes: ['rogue'],
			}),
			createSpellEntry({
				uuid: 'Compendium.nimble.nimble-spells.Item.ice-bolt',
				name: 'Ice Bolt',
				school: 'ice',
			}),
		]);

		let selected: string[] = [];
		const onConfirm = vi.fn();
		const onSelect = vi.fn((nextSelected: string[]) => {
			selected = nextSelected;
			void rerender({
				group,
				spellIndex,
				selected,
				onSelect,
				onConfirm,
			});
		});

		const { rerender } = render(SchoolSelection, {
			props: {
				group,
				spellIndex,
				selected,
				onSelect,
				onConfirm,
			},
		});

		await fireEvent.click(screen.getByRole('button', { name: 'Fire' }));
		expect(onSelect).toHaveBeenLastCalledWith(['fire']);
		expect(screen.getByText('Fire Bolt')).toBeInTheDocument();
		expect(screen.queryByText('Fire Utility')).not.toBeInTheDocument();
		expect(screen.queryByText('Rogue Fire')).not.toBeInTheDocument();

		await fireEvent.click(screen.getByRole('button', { name: 'Ice' }));
		expect(onSelect).toHaveBeenLastCalledWith(['ice']);
		expect(screen.queryByText('Fire Bolt')).not.toBeInTheDocument();
		expect(screen.getByText('Ice Bolt')).toBeInTheDocument();

		await fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));
		expect(onConfirm).toHaveBeenCalledTimes(1);
	});
});
