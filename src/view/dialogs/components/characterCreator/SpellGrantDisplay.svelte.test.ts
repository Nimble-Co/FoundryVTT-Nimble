import { fireEvent, render, screen } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';

import SpellGrantDisplayHarness from '../../../../../tests/harnesses/SpellGrantDisplayHarness.svelte';

describe('SpellGrantDisplay', () => {
	it('only clears selections and confirmations for the edited source filter', async () => {
		render(SpellGrantDisplayHarness, {
			props: {
				sourceFilter: 'background',
				spellGrants: {
					autoGrant: [],
					schoolSelections: [
						{
							ruleId: 'class-school',
							label: 'Class School',
							availableSchools: ['fire'],
							tiers: [0],
							count: 1,
							utilityOnly: false,
							forClass: 'mage',
							source: 'class',
						},
						{
							ruleId: 'background-school',
							label: 'Background School',
							availableSchools: ['wind'],
							tiers: [0],
							count: 1,
							utilityOnly: true,
							forClass: 'mage',
							source: 'background',
						},
					],
					spellSelections: [
						{
							ruleId: 'class-spell',
							label: 'Class Spell',
							availableSpells: [
								{
									uuid: 'class-spell-uuid',
									name: 'Class Spell',
									img: 'icons/svg/item-bag.svg',
									school: 'fire',
									tier: 0,
									isUtility: false,
									classes: [],
								},
							],
							count: 1,
							utilityOnly: false,
							forClass: 'mage',
							source: 'class',
						},
						{
							ruleId: 'background-spell',
							label: 'Background Spell',
							availableSpells: [
								{
									uuid: 'background-spell-uuid',
									name: 'Background Spell',
									img: 'icons/svg/item-bag.svg',
									school: 'wind',
									tier: 0,
									isUtility: true,
									classes: [],
								},
							],
							count: 1,
							utilityOnly: true,
							forClass: 'mage',
							source: 'background',
						},
					],
					hasGrants: true,
				},
				initialSelectedSchools: new Map([
					['class-school', ['fire']],
					['background-school', ['wind']],
				]),
				initialSelectedSpells: new Map([
					['class-spell', ['class-spell-uuid']],
					['background-spell', ['background-spell-uuid']],
				]),
				initialConfirmedSchools: new Set(['class-school', 'background-school']),
			},
		});

		await fireEvent.click(screen.getByRole('button', { name: 'Edit Spell Selection' }));

		expect(screen.getByTestId('confirmed-schools')).toHaveTextContent('["class-school"]');
		expect(screen.getByTestId('selected-spells')).toHaveTextContent(
			'[["class-spell",["class-spell-uuid"]]]',
		);
		expect(screen.getByTestId('selected-schools')).toHaveTextContent(
			'[["class-school",["fire"]],["background-school",["wind"]]]',
		);
	});
});
