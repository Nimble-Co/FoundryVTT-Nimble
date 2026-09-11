import { fireEvent, render, screen } from '@testing-library/svelte';
import { tick } from 'svelte';
import { describe, expect, it, vi } from 'vitest';

import type { NimbleCharacter } from '#documents/actor/character.js';
import type { OptionSwapChange, ResolvedOptionSwapOffer } from '#types/optionSwap.d.ts';
import {
	createDiePool,
	createMagePool,
	createOffer,
	createPool,
	createSpanningPool,
	createSwapSource,
} from '../../../../../tests/fixtures/optionSwap.ts';
import OptionSwapSection from './OptionSwapSection.svelte';

function createActor(skills: Record<string, { points: number; mod: number }>) {
	return {
		items: new Map(),
		reactive: { system: { skills } },
	} as unknown as NimbleCharacter;
}

const DEFAULT_ACTOR = createActor({
	arcana: { points: 2, mod: 4 },
	stealth: { points: 0, mod: 1 },
});

interface RenderOptions {
	actor?: NimbleCharacter;
	onPending?: (isPending: boolean) => void;
	onToggle?: (isExpanded: boolean) => void;
}

function renderSection(offer: ResolvedOptionSwapOffer | null, options: RenderOptions = {}) {
	const latest = {
		selections: new Map<string, string[]>(),
		skillPoints: new Map<string, number>(),
	};

	const rendered = render(OptionSwapSection, {
		props: {
			document: options.actor ?? DEFAULT_ACTOR,
			offer,
			onChange: (change: OptionSwapChange) => {
				latest.selections = change.selections;
				latest.skillPoints = change.skillPoints;
			},
			onPending: options.onPending,
			onToggle: options.onToggle,
		},
	});

	async function expand() {
		await fireEvent.click(rendered.getByRole('button', { name: /change my options/i }));
	}

	async function unfold() {
		await fireEvent.click(rendered.getByRole('button', { name: /other option/i }));
	}

	return { ...rendered, expand, latest, unfold };
}

/** Rests the pointer on a chip until its card opens. */
async function hover(chip: Element) {
	await fireEvent.mouseEnter(chip);
	await new Promise((resolve) => {
		setTimeout(resolve, 250);
	});
	await tick();
}

const chipOf = (control: HTMLElement) => control.closest('li') as HTMLElement;

/** The skills a select offers, by key. */
const optionValues = (select: HTMLElement) =>
	[...(select as HTMLSelectElement).options].map((option) => option.value);

/** The sub-heading of each option list, in the order they are shown. */
const listTitles = (root: HTMLElement) =>
	[...root.querySelectorAll('.nimble-option-swap__list-title')].map((title) =>
		title.textContent?.trim(),
	);

/** The block of one list, found by its sub-heading. */
const listNamed = (root: HTMLElement, title: string) =>
	[...root.querySelectorAll('.nimble-option-swap__list')].find(
		(list) => list.querySelector('.nimble-option-swap__list-title')?.textContent?.trim() === title,
	) as HTMLElement;

describe('OptionSwapSection', () => {
	it('renders nothing when the rest offers no swap', () => {
		const { container } = renderSection(null);

		expect(container.textContent?.trim()).toBe('');
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

	it('gives every offering feature a card with what it offers', async () => {
		const { expand, getByText } = renderSection(createOffer());

		await expand();

		expect(getByText('Wrath & Ruin')).toBeTruthy();
		expect(getByText('Swap class options')).toBeTruthy();
		expect(getByText('Savage Arsenal')).toBeTruthy();
	});

	it('shows a chip per held pick and an empty place for an ungranted one', async () => {
		const { expand, getByLabelText, getByText } = renderSection(
			createOffer({ pools: [createPool({ heldCount: 1, grantedCount: 2 })] }),
		);

		await expand();

		expect(getByLabelText('Give up Cleave')).toBeTruthy();
		expect(getByText('Empty. Choose below.')).toBeTruthy();
		expect(getByText('1 / 2')).toBeTruthy();
		expect(getByText('Your level gives you 2 options. You have 1. Choose 1 more.')).toBeTruthy();
	});

	it('reads the count against what the level grants', async () => {
		const { expand, getByText } = renderSection(
			createOffer({ pools: [createPool({ heldCount: 1, grantedCount: 2 })] }),
		);

		await expand();

		const count = getByText('1 / 2');
		expect(count.getAttribute('data-tooltip')).toBe('Chosen / what your level gives you');
		expect(count.className).toContain('count--short');
	});

	it('empties the place a pick is given up from, and moves focus there', async () => {
		const { expand, getByLabelText, getByText } = renderSection(createOffer());

		await expand();
		await fireEvent.click(getByLabelText('Give up Cleave'));
		await tick();

		const empty = getByText('Empty. Choose below.');
		expect(empty).toBeTruthy();
		expect(document.activeElement).toBe(empty.closest('button'));
	});

	it('fills the first empty place with a choice', async () => {
		const { expand, getByLabelText, latest } = renderSection(createOffer());

		await expand();
		await fireEvent.click(getByLabelText('Give up Cleave'));
		// Giving a pick up unfolds the choices, so the replacement is already in view.
		await fireEvent.click(getByLabelText('Select Rampage'));

		expect(latest.selections.get('savage-arsenal')).toEqual(['Item.rampage']);
		expect(getByLabelText('Give up Rampage')).toBeTruthy();
	});

	it('greys the choices out while every place is full', async () => {
		const { expand, getByLabelText, getByText, unfold } = renderSection(createOffer());

		await expand();
		await unfold();

		expect(getByText('Give up an option to choose another.')).toBeTruthy();
		expect(getByLabelText('Select Rampage').hasAttribute('disabled')).toBe(true);
		expect(chipOf(getByLabelText('Select Rampage')).className).toContain('chip--blocked');
	});

	it('keeps offering a member the grant allows more than once', async () => {
		const { expand, getByLabelText, queryByLabelText, unfold } = renderSection(
			createOffer({ pools: [createDiePool()] }),
		);

		await expand();
		await unfold();

		expect(getByLabelText('Select +1 Max Combat Die')).toBeTruthy();
		expect(queryByLabelText('Select Heavy Strike')).toBeNull();
	});

	it('says what the selection will do once it is ready', async () => {
		const { expand, getByLabelText, getByText } = renderSection(createOffer());

		await expand();
		await fireEvent.click(getByLabelText('Give up Cleave'));

		expect(getByText('Choose 1 more option to complete the swap.')).toBeTruthy();

		await fireEvent.click(getByLabelText('Select Rampage'));

		expect(getByText('You give up Cleave and take Rampage.')).toBeTruthy();
		expect(
			getByText('You give up Cleave and take Rampage.').closest('.nimble-hint')?.className,
		).toContain('nimble-hint--success');
	});

	describe('a pool whose options come from more than one list', () => {
		const spanningOffer = () => createOffer({ pools: [createSpanningPool()] });

		it('heads the chips with one title per list', async () => {
			const { container, expand } = renderSection(spanningOffer());

			await expand();

			expect(listTitles(container)).toEqual(['Field Signals', 'Field Maneuvers', '+1 Extra Die']);
			expect(listNamed(container, 'Field Signals').textContent).toContain('Rally');
			expect(listNamed(container, 'Field Maneuvers').textContent).toContain('Feint');
			expect(listNamed(container, '+1 Extra Die').textContent).toContain('+1 Extra Die');
		});

		it('splits the unfolded choices by the same titles', async () => {
			const { container, expand, unfold } = renderSection(spanningOffer());

			await expand();
			await unfold();

			// Once for the chips, once for the choices under them.
			expect(listTitles(container)).toEqual([
				'Field Signals',
				'Field Maneuvers',
				'+1 Extra Die',
				'Field Signals',
				'Field Maneuvers',
				'+1 Extra Die',
			]);

			const choices = [...container.querySelectorAll('.nimble-option-swap__list')].slice(3);
			expect(choices[0].textContent).toContain('Regroup');
			expect(choices[1].textContent).toContain('Flank');
		});

		it('heads nothing when the options come from one list', async () => {
			const { container, expand, unfold } = renderSection(createOffer());

			await expand();
			await unfold();

			expect(listTitles(container)).toEqual([]);
			expect(container.querySelectorAll('.nimble-option-swap__chips')).toHaveLength(2);
		});
	});

	describe('the hover card', () => {
		it('opens beside a chip the pointer rests on', async () => {
			const { expand, getByLabelText } = renderSection(createOffer());

			await expand();
			await hover(chipOf(getByLabelText('Give up Cleave')));

			const peek = screen.getByRole('tooltip');
			expect(peek.textContent).toContain('Cleave');
			expect(peek.textContent).toContain('Hit them all.');
		});

		it('says when a member may be taken more than once', async () => {
			const { expand, getAllByLabelText } = renderSection(
				createOffer({ pools: [createDiePool()] }),
			);

			await expand();
			// The die is held twice, so it stands in two places.
			await hover(chipOf(getAllByLabelText('Give up +1 Max Combat Die')[0]));

			expect(screen.getByRole('tooltip').textContent).toContain(
				'You can take this more than once.',
			);
		});

		it('opens for a chip that takes keyboard focus, and closes when it leaves', async () => {
			const { expand, getByLabelText } = renderSection(createOffer());

			await expand();
			const check = getByLabelText('Give up Cleave');
			await fireEvent.focusIn(check);
			await new Promise((resolve) => {
				setTimeout(resolve, 250);
			});
			await tick();

			expect(screen.getByRole('tooltip').textContent).toContain('Hit them all.');

			await fireEvent.focusOut(check);

			expect(screen.queryByRole('tooltip')).toBeNull();
		});

		it('closes when the pointer leaves', async () => {
			const { expand, getByLabelText } = renderSection(createOffer());

			await expand();
			const chip = chipOf(getByLabelText('Give up Cleave'));
			await hover(chip);
			await fireEvent.mouseLeave(chip);

			expect(screen.queryByRole('tooltip')).toBeNull();
		});
	});

	describe('the skill move line', () => {
		it('moves a point from one skill to another', async () => {
			const { expand, getByLabelText, getByText, latest } = renderSection(
				createOffer({
					pools: [],
					skillPoints: 1,
					sources: [createSwapSource({ name: 'Jack of All Trades', skillPoints: 1 })],
				}),
			);

			await expand();

			expect(getByText('Move a point')).toBeTruthy();

			await fireEvent.change(getByLabelText('from a skill'), { target: { value: 'arcana' } });

			expect(getByText('Pick a skill to give the point to.')).toBeTruthy();

			await fireEvent.change(getByLabelText('to a skill'), { target: { value: 'stealth' } });

			expect(getByText('Arcana 4 → 3, Stealth 1 → 2')).toBeTruthy();
			expect(Object.fromEntries(latest.skillPoints)).toEqual({ arcana: 1, stealth: 1 });
		});

		it('shows one line per point the feature moves, and adds them up', async () => {
			const { expand, getByLabelText, getByText, latest } = renderSection(
				createOffer({
					pools: [],
					skillPoints: 2,
					sources: [createSwapSource({ name: 'Jack of All Trades', skillPoints: 2 })],
				}),
			);

			await expand();

			await fireEvent.change(getByLabelText('from a skill (point 1)'), {
				target: { value: 'arcana' },
			});
			await fireEvent.change(getByLabelText('to a skill (point 1)'), {
				target: { value: 'stealth' },
			});
			await fireEvent.change(getByLabelText('from a skill (point 2)'), {
				target: { value: 'arcana' },
			});
			await fireEvent.change(getByLabelText('to a skill (point 2)'), {
				target: { value: 'stealth' },
			});

			expect(getByText('Arcana 4 → 3, Stealth 1 → 2')).toBeTruthy();
			expect(getByText('Arcana 3 → 2, Stealth 2 → 3')).toBeTruthy();
			expect(Object.fromEntries(latest.skillPoints)).toEqual({ arcana: 0, stealth: 2 });
		});

		it('keeps the point a line took out of the other lines', async () => {
			const { expand, getByLabelText } = renderSection(
				createOffer({
					pools: [],
					skillPoints: 2,
					sources: [createSwapSource({ name: 'Jack of All Trades', skillPoints: 2 })],
				}),
				{ actor: createActor({ arcana: { points: 1, mod: 4 }, stealth: { points: 0, mod: 1 } }) },
			);

			await expand();

			await fireEvent.change(getByLabelText('from a skill (point 1)'), {
				target: { value: 'arcana' },
			});
			await fireEvent.change(getByLabelText('to a skill (point 1)'), {
				target: { value: 'stealth' },
			});

			expect(optionValues(getByLabelText('from a skill (point 1)'))).toContain('arcana');
			expect(optionValues(getByLabelText('from a skill (point 2)'))).not.toContain('arcana');
		});

		it('gives each feature that moves a point a line of its own', async () => {
			const { expand, getAllByText, getByLabelText, latest } = renderSection(
				createOffer({
					pools: [],
					skillPoints: 2,
					sources: [
						createSwapSource({ name: 'Jack of All Trades', uuid: 'Actor.hero.Item.a' }),
						createSwapSource({ name: 'Wide Study', uuid: 'Actor.hero.Item.b' }),
					].map((source) => ({ ...source, skillPoints: 1 })),
				}),
			);

			await expand();

			// One line on each card, not both lines on both.
			expect(getAllByText('Move a point')).toHaveLength(2);

			await fireEvent.change(getByLabelText('from a skill (point 1)'), {
				target: { value: 'arcana' },
			});
			await fireEvent.change(getByLabelText('to a skill (point 1)'), {
				target: { value: 'stealth' },
			});
			await fireEvent.change(getByLabelText('from a skill (point 2)'), {
				target: { value: 'arcana' },
			});
			await fireEvent.change(getByLabelText('to a skill (point 2)'), {
				target: { value: 'stealth' },
			});

			expect(Object.fromEntries(latest.skillPoints)).toEqual({ arcana: 0, stealth: 2 });
		});

		it('offers no skill until one is chosen to give the point', async () => {
			const { expand, getByLabelText } = renderSection(
				createOffer({
					pools: [],
					skillPoints: 1,
					sources: [createSwapSource({ name: 'Jack of All Trades', skillPoints: 1 })],
				}),
			);

			await expand();

			expect(getByLabelText('to a skill').hasAttribute('disabled')).toBe(true);
		});
	});

	it('switches a card off when its own feature is the pick being given up', async () => {
		const { expand, getByLabelText, getByText, queryByText } = renderSection(
			createOffer({
				skillPoints: 1,
				pools: [createMagePool()],
				sources: [
					createSwapSource({ name: 'Focus', uuid: 'Actor.hero.Item.i-focus', skillPoints: 1 }),
				],
			}),
		);

		await expand();
		expect(getByText('Move a point')).toBeTruthy();

		await fireEvent.click(getByLabelText('Give up Focus'));

		expect(
			getByText('You are giving up Focus. What it lets you do is not offered on this rest.'),
		).toBeTruthy();
		expect(queryByText('Move a point')).toBeNull();
	});

	describe('the host', () => {
		it('is told when a change is ready to confirm', async () => {
			const onPending = vi.fn();
			const { expand, getByLabelText } = renderSection(createOffer(), { onPending });

			await expand();
			expect(onPending).toHaveBeenLastCalledWith(false);

			await fireEvent.click(getByLabelText('Give up Cleave'));
			expect(onPending).toHaveBeenLastCalledWith(false);

			await fireEvent.click(getByLabelText('Select Rampage'));
			expect(onPending).toHaveBeenLastCalledWith(true);
		});

		it('is told to refit when a pool unfolds', async () => {
			const onToggle = vi.fn();
			const { expand, unfold } = renderSection(createOffer(), { onToggle });

			await expand();
			onToggle.mockClear();

			await unfold();

			expect(onToggle).toHaveBeenCalledTimes(1);
			expect(onToggle).toHaveBeenCalledWith(true);
		});

		it('is told to refit when giving a pick up unfolds the choices', async () => {
			const onToggle = vi.fn();
			const { expand, getByLabelText } = renderSection(createOffer(), { onToggle });

			await expand();
			onToggle.mockClear();

			await fireEvent.click(getByLabelText('Give up Cleave'));

			expect(onToggle).toHaveBeenCalledTimes(1);
			expect(onToggle).toHaveBeenCalledWith(true);
		});
	});
});
