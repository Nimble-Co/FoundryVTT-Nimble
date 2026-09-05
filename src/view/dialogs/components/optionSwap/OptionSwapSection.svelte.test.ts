import { fireEvent, render } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';

import type { NimbleCharacter } from '#documents/actor/character.js';
import type { NimbleFeatureItem } from '#documents/item/feature.js';
import type { ResolvedOptionSwapOffer, ResolvedSwappableOptionPool } from '#types/optionSwap.d.ts';
import OptionSwapSectionHarness from './OptionSwapSection.testHarness.svelte';

function createFeature(uuid: string, name: string): NimbleFeatureItem {
	return {
		uuid,
		name,
		img: 'icons/svg/item-bag.svg',
		system: { description: '' },
	} as NimbleFeatureItem;
}

const ARSENAL = [
	createFeature('Item.cleave', 'Cleave'),
	createFeature('Item.rampage', 'Rampage'),
	createFeature('Item.savage-leap', 'Savage Leap'),
];

function createPool(
	overrides: Partial<ResolvedSwappableOptionPool> = {},
): ResolvedSwappableOptionPool {
	return {
		poolKey: 'savage-arsenal',
		poolGroups: ['savage-arsenal'],
		displayName: 'Savage Arsenal',
		optionLabel: 'Choose a Savage Arsenal Ability',
		levels: [3],
		pickCount: 1,
		candidateUuids: ARSENAL.map((feature) => feature.uuid as string),
		ownedUuids: ['Item.cleave'],
		itemIdByUuid: new Map([['Item.cleave', 'abc123']]),
		candidates: ARSENAL,
		...overrides,
	};
}

function createOffer(overrides: Partial<ResolvedOptionSwapOffer> = {}): ResolvedOptionSwapOffer {
	return {
		allowedGroups: null,
		skillPoints: 0,
		sources: [
			{
				name: 'Wrath & Ruin',
				text: 'Whenever you perform a notable act of destruction during a Safe Rest, you may choose different Berserker options available to you.',
			},
		],
		pools: [createPool()],
		...overrides,
	};
}

function createActor(skills: Record<string, { points: number; mod: number }>) {
	return { reactive: { system: { skills } } } as unknown as NimbleCharacter;
}

const DEFAULT_ACTOR = createActor({
	arcana: { points: 2, mod: 4 },
	stealth: { points: 0, mod: 1 },
});

function renderSection(offer: ResolvedOptionSwapOffer | null, actor = DEFAULT_ACTOR) {
	const latest = {
		selections: new Map<string, string[]>(),
		skillPoints: new Map<string, number>(),
	};

	const rendered = render(OptionSwapSectionHarness, {
		props: {
			document: actor,
			offer,
			onChange: (next: typeof latest) => {
				latest.selections = next.selections;
				latest.skillPoints = next.skillPoints;
			},
		},
	});

	async function expand() {
		await fireEvent.click(rendered.getByRole('button', { name: /change my options/i }));
	}

	async function unfold() {
		await fireEvent.click(rendered.getByRole('button', { name: /more option/i }));
	}

	return { ...rendered, expand, unfold, latest };
}

describe('OptionSwapSection', () => {
	it('renders nothing when the rest offers no swap', () => {
		const { container } = renderSection(null);

		expect(container.textContent?.trim()).toBe('');
	});

	it('starts collapsed, showing only the row that opens it', () => {
		const { getByRole, queryByText } = renderSection(createOffer());

		expect(getByRole('button', { name: /change my options/i })).toBeTruthy();
		expect(queryByText('Savage Arsenal')).toBeNull();
	});

	it('quotes the feature that offers the swap once expanded', async () => {
		const { expand, getByText } = renderSection(createOffer());

		await expand();

		expect(getByText('Swap class options')).toBeTruthy();
		expect(
			getByText(/Wrath & Ruin: Whenever you perform a notable act of destruction/),
		).toBeTruthy();
	});

	it('preselects the picks the character already holds', async () => {
		const { expand, unfold, getByText, getByRole, getByLabelText, latest } = renderSection(
			createOffer(),
		);

		await expand();

		expect(getByText('Savage Arsenal')).toBeTruthy();
		expect(getByLabelText('Deselect Cleave')).toBeTruthy();
		// The rest of the pool sits folded below the held pick, a click away.
		expect(getByRole('button', { name: 'Show 2 more options' })).toBeTruthy();
		await unfold();
		expect(getByLabelText('Select Rampage')).toBeTruthy();
		expect(getByLabelText('Select Savage Leap')).toBeTruthy();
		expect(latest.selections.get('savage-arsenal')).toEqual(['Item.cleave']);
	});

	it('swaps a single pick for another member of the pool in one click', async () => {
		const { expand, unfold, getByLabelText, latest } = renderSection(createOffer());

		await expand();
		await unfold();
		await fireEvent.click(getByLabelText('Select Rampage'));

		expect(latest.selections.get('savage-arsenal')).toEqual(['Item.rampage']);
	});

	it('asks for a pick to be released before a multi-pick pool takes another', async () => {
		const { expand, unfold, getByLabelText, latest } = renderSection(
			createOffer({
				pools: [
					createPool({
						pickCount: 2,
						ownedUuids: ['Item.cleave', 'Item.rampage'],
					}),
				],
			}),
		);

		await expand();
		await unfold();
		await fireEvent.click(getByLabelText('Select Savage Leap'));
		expect(latest.selections.get('savage-arsenal')).toEqual(['Item.cleave', 'Item.rampage']);

		await fireEvent.click(getByLabelText('Deselect Cleave'));
		await fireEvent.click(getByLabelText('Select Savage Leap'));
		expect(latest.selections.get('savage-arsenal')).toEqual(['Item.rampage', 'Item.savage-leap']);
	});

	it('only offers a skill point once one has been taken from another skill', async () => {
		const { expand, getByLabelText, latest } = renderSection(
			createOffer({ pools: [], skillPoints: 1 }),
		);

		await expand();

		expect(getByLabelText('Give a point to Stealth').hasAttribute('disabled')).toBe(true);

		await fireEvent.click(getByLabelText('Take a point from Arcana'));

		// A point taken and not yet placed is not a move, so nothing is offered to the host.
		expect(latest.skillPoints.size).toBe(0);

		await fireEvent.click(getByLabelText('Give a point to Stealth'));

		expect(Object.fromEntries(latest.skillPoints)).toEqual({ arcana: 1, stealth: 1 });
	});

	it('refuses to take a point from a skill that holds none', async () => {
		const { expand, getByLabelText } = renderSection(createOffer({ pools: [], skillPoints: 1 }));

		await expand();

		expect(getByLabelText('Take a point from Stealth').hasAttribute('disabled')).toBe(true);
	});

	it('refuses to push a skill past the +12 maximum', async () => {
		const actor = createActor({
			arcana: { points: 2, mod: 4 },
			stealth: { points: 4, mod: 12 },
		});
		const { expand, getByLabelText } = renderSection(
			createOffer({ pools: [], skillPoints: 1 }),
			actor,
		);

		await expand();
		await fireEvent.click(getByLabelText('Take a point from Arcana'));

		expect(getByLabelText('Give a point to Stealth').hasAttribute('disabled')).toBe(true);
	});
});
