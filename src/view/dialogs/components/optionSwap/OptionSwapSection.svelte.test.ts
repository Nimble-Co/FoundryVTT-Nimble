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
		requiredActs: ['Whenever you perform a notable act of destruction during a Safe Rest'],
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

	return { ...rendered, expand, latest };
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

	it('shows the acts the class asks for as an unchecked reminder once expanded', async () => {
		const { expand, getByText } = renderSection(createOffer());

		await expand();

		expect(
			getByText('Whenever you perform a notable act of destruction during a Safe Rest'),
		).toBeTruthy();
		expect(getByText(/system never checks this/i)).toBeTruthy();
	});

	it('preselects the picks the character already holds', async () => {
		const { expand, getByText, queryByText, latest } = renderSection(createOffer());

		await expand();

		expect(getByText('Savage Arsenal')).toBeTruthy();
		expect(getByText('Choose a Savage Arsenal Ability')).toBeTruthy();
		expect(getByText('Cleave')).toBeTruthy();
		// The pool already holds its full count, so the alternatives stay collapsed until a
		// pick is released.
		expect(queryByText('Rampage')).toBeNull();
		expect(latest.selections.get('savage-arsenal')).toEqual(['Item.cleave']);
	});

	it('swaps a pick for another member of the pool', async () => {
		const { expand, getByLabelText, latest } = renderSection(createOffer());

		await expand();
		await fireEvent.click(getByLabelText('Deselect Cleave'));
		await fireEvent.click(getByLabelText('Select Rampage'));

		expect(latest.selections.get('savage-arsenal')).toEqual(['Item.rampage']);
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
