import { fireEvent, render } from '@testing-library/svelte';
import { tick } from 'svelte';
import { describe, expect, it } from 'vitest';

import type { NimbleCharacter } from '#documents/actor/character.js';
import type { NimbleFeatureItem } from '#documents/item/feature.js';
import type { ResolvedOptionSwapOffer, ResolvedSwappableOptionPool } from '#types/optionSwap.d.ts';
import OptionSwapSection from './OptionSwapSection.svelte';

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
		pickIdsByUuid: new Map([['Item.cleave', ['abc123']]]),
		repeatableUuids: [],
		candidates: ARSENAL,
		...overrides,
	};
}

const TACTICS = [
	createFeature('Item.heavy-strike', 'Heavy Strike'),
	createFeature('Item.sweeping-strike', 'Sweeping Strike'),
	createFeature('Item.max-die', '+1 Max Combat Die'),
];

/** A Commander pool: one tactic and the die twice, three picks, the die repeatable. */
function createDiePool(
	overrides: Partial<ResolvedSwappableOptionPool> = {},
): ResolvedSwappableOptionPool {
	return createPool({
		poolKey: 'combat-tactics',
		poolGroups: ['combat-tactics'],
		displayName: 'Fit for Any Battlefield',
		optionLabel: null,
		levels: [4, 6, 8],
		pickCount: 3,
		candidateUuids: TACTICS.map((feature) => feature.uuid as string),
		pickIdsByUuid: new Map([
			['Item.heavy-strike', ['t4']],
			['Item.max-die', ['d6', 'd8']],
		]),
		repeatableUuids: ['Item.max-die'],
		candidates: TACTICS,
		...overrides,
	});
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

	const rendered = render(OptionSwapSection, {
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

	it('shows the feature and says why when no pick is recorded to swap', async () => {
		// A character built by hand has picks on the sheet that no level up recorded. The
		// system does not guess at them, so it offers no pool and says so.
		const { expand, getByText, queryByText } = renderSection(createOffer({ pools: [] }));

		await expand();

		expect(getByText(/Wrath & Ruin: Whenever/)).toBeTruthy();
		expect(getByText(/No class option picks are recorded/)).toBeTruthy();
		expect(queryByText('Savage Arsenal')).toBeNull();
	});

	it('renders nothing when only a skill move is offered and none is left', () => {
		// An empty allowed set is the resolver's word for "no swap rule on this rest".
		const { container } = renderSection(
			createOffer({ pools: [], skillPoints: 0, allowedGroups: new Set() }),
		);

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
						pickIdsByUuid: new Map([
							['Item.cleave', ['abc123']],
							['Item.rampage', ['def456']],
						]),
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

	it('unfolds the alternatives when the last pick of a member is released', async () => {
		const { expand, getByLabelText, queryByLabelText, latest } = renderSection(
			createOffer({
				pools: [
					createPool({
						pickCount: 2,
						pickIdsByUuid: new Map([
							['Item.cleave', ['abc123']],
							['Item.rampage', ['def456']],
						]),
					}),
				],
			}),
		);

		await expand();
		expect(queryByLabelText('Select Savage Leap')).toBeNull();

		await fireEvent.click(getByLabelText('Deselect Cleave'));

		// The released member is among the alternatives, in view rather than behind the fold,
		// and focus follows it there rather than falling to the body.
		expect(getByLabelText('Select Cleave')).toBeTruthy();
		expect(getByLabelText('Select Savage Leap')).toBeTruthy();
		await tick();
		expect(document.activeElement).toBe(getByLabelText('Select Cleave'));
		expect(latest.selections.get('savage-arsenal')).toEqual(['Item.rampage']);
	});

	describe('a repeated pick', () => {
		it('renders one card carrying its count, and counts every pick in the progress', async () => {
			const { expand, getAllByText, getByText, latest } = renderSection(
				createOffer({ pools: [createDiePool()] }),
			);

			await expand();

			expect(getAllByText('+1 Max Combat Die')).toHaveLength(1);
			expect(getByText('x2')).toBeTruthy();
			expect(getByText('3 of 3 selected')).toBeTruthy();
			expect(latest.selections.get('combat-tactics')).toEqual([
				'Item.heavy-strike',
				'Item.max-die',
				'Item.max-die',
			]);
		});

		it('keeps a member with a pick out of the alternatives and one without in them', async () => {
			const { expand, unfold, queryByLabelText, getByLabelText } = renderSection(
				createOffer({ pools: [createDiePool()] }),
			);

			await expand();
			await unfold();

			expect(queryByLabelText('Select +1 Max Combat Die')).toBeNull();
			expect(queryByLabelText('Select Heavy Strike')).toBeNull();
			expect(getByLabelText('Select Sweeping Strike')).toBeTruthy();
		});

		it('offers to take one more only on a repeatable member, and not while the pool is full', async () => {
			const { expand, getByLabelText, queryByLabelText, latest } = renderSection(
				createOffer({ pools: [createDiePool()] }),
			);

			await expand();

			const more = getByLabelText('Take another +1 Max Combat Die');
			expect(more.getAttribute('aria-disabled')).toBe('true');
			expect(queryByLabelText('Take another Heavy Strike')).toBeNull();

			await fireEvent.click(more);
			expect(latest.selections.get('combat-tactics')).toHaveLength(3);
		});

		it('gives up one copy at a time and never the last through that control', async () => {
			const { expand, getByLabelText, queryByLabelText, queryByText, latest } = renderSection(
				createOffer({ pools: [createDiePool()] }),
			);

			await expand();
			expect(queryByLabelText('Give up one Heavy Strike')).toBeNull();
			expect(queryByLabelText('Deselect +1 Max Combat Die')).toBeNull();

			await fireEvent.click(getByLabelText('Give up one +1 Max Combat Die'));

			expect(latest.selections.get('combat-tactics')).toEqual([
				'Item.heavy-strike',
				'Item.max-die',
			]);
			// At one the card keeps the member, loses the count, and offers deselect instead.
			expect(queryByText('x2')).toBeNull();
			expect(queryByLabelText('Give up one +1 Max Combat Die')).toBeNull();
			expect(getByLabelText('Deselect +1 Max Combat Die')).toBeTruthy();
			await tick();
			expect(document.activeElement).toBe(getByLabelText('Deselect +1 Max Combat Die'));
			expect(getByLabelText('Take another +1 Max Combat Die').getAttribute('aria-disabled')).toBe(
				'false',
			);
		});

		it('trades an ability for a second copy once room is made', async () => {
			const { expand, getByLabelText, getByText, latest } = renderSection(
				createOffer({
					pools: [
						createDiePool({
							pickCount: 2,
							pickIdsByUuid: new Map([
								['Item.heavy-strike', ['t4']],
								['Item.max-die', ['d6']],
							]),
						}),
					],
				}),
			);

			await expand();
			await fireEvent.click(getByLabelText('Deselect Heavy Strike'));
			await fireEvent.click(getByLabelText('Take another +1 Max Combat Die'));

			expect(latest.selections.get('combat-tactics')).toEqual(['Item.max-die', 'Item.max-die']);
			expect(getByText('x2')).toBeTruthy();
			expect(getByText('2 of 2 selected')).toBeTruthy();
		});

		it('offers no count control in a one-pick pool, which is always full', async () => {
			const { expand, queryByLabelText } = renderSection(
				createOffer({
					pools: [
						createDiePool({
							pickCount: 1,
							pickIdsByUuid: new Map([['Item.max-die', ['d6']]]),
						}),
					],
				}),
			);

			await expand();

			expect(queryByLabelText('Take another +1 Max Combat Die')).toBeNull();
		});
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

	it('refuses to take a point that would push a skill bonus below +0', async () => {
		// A negative ability can hold the bonus under the points, so the points floor alone
		// would let this skill go negative.
		const actor = createActor({
			arcana: { points: 2, mod: 4 },
			stealth: { points: 1, mod: 0 },
		});
		const { expand, getByLabelText } = renderSection(
			createOffer({ pools: [], skillPoints: 1 }),
			actor,
		);

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
