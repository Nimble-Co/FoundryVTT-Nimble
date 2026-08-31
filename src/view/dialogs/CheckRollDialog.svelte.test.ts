import { fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import CheckRollDialog from './CheckRollDialog.svelte';

// Stands in for the real formula builder so the rendered formula is a direct
// readout of the roll mode the dialog resolved. The builder itself is covered by
// constructD20RollFormula's own tests.
vi.mock('../../utils/getRollFormula.js', () => ({
	default: (_actor: unknown, rollData: { rollMode: number }) => `d20 @ ${rollData.rollMode}`,
}));

/**
 * The dialog reaches its options through the real `getSituationalRollModeOptions`,
 * which only calls back into the rule's public methods. Lightweight stand-ins keep
 * this test on the dialog's wiring; `situationalRollMode.test.ts` covers the rule.
 */
function createSituationalRule(
	overrides: { id?: string; label?: string; value?: number; img?: string } = {},
): Record<string, unknown> {
	const {
		id = 'fear-rule',
		label = 'Against fear',
		value = 1,
		img = 'icons/backgrounds/haunted-past.webp',
	} = overrides;

	return {
		type: 'situationalRollMode',
		id,
		label,
		value,
		item: { name: 'Haunted Past', uuid: 'Item.haunted-past', img },
		iconPath: () => img,
		appliesTo: () => true,
		offersAdjustment: () => value !== 0,
		matchesRoll: () => true,
	};
}

function renderWillSave(rules: Array<Record<string, unknown>>, rollMode = 0) {
	const submitRoll = vi.fn();
	const { container } = render(CheckRollDialog, {
		actor: { rules },
		dialog: { submitRoll },
		type: 'savingThrow',
		saveKey: 'will',
		rollMode,
	} as never);

	const formula = () => container.querySelector('.nimble-roll-formula')?.textContent;
	const optionIcons = () =>
		Array.from(container.querySelectorAll('.nimble-situational__icon')).map((icon) =>
			icon.getAttribute('src'),
		);
	const roll = () => fireEvent.click(screen.getByRole('button', { name: /roll/i }));
	const toggle = (name: string) =>
		fireEvent.click(screen.getByRole('checkbox', { name: new RegExp(name) }));

	return { submitRoll, formula, optionIcons, roll, toggle };
}

describe('CheckRollDialog situational roll modes', () => {
	beforeAll(() => {
		// Foundry extends Math with clamp at runtime; the dialog clamps with it.
		(Math as unknown as { clamp: (n: number, min: number, max: number) => number }).clamp = (
			n,
			min,
			max,
		) => Math.min(Math.max(n, min), max);
	});

	beforeEach(() => {
		(game as unknown as { settings: { get: () => boolean } }).settings = { get: () => false };
	});

	it('renders no situational section when the actor offers no options', () => {
		renderWillSave([]);

		expect(screen.queryByRole('checkbox')).toBeNull();
	});

	it('leaves the roll mode alone while the option is unchecked', async () => {
		const { submitRoll, formula, roll } = renderWillSave([createSituationalRule()]);

		expect(formula()).toBe('d20 @ 0');

		await roll();

		expect(submitRoll).toHaveBeenCalledWith(expect.objectContaining({ rollMode: 0 }));
	});

	// The regression this guards: submitting `selectedRollMode` instead of
	// `effectiveRollMode` leaves the checked option out of the roll entirely.
	it('folds a checked option into both the formula and the submitted roll mode', async () => {
		const { submitRoll, formula, roll, toggle } = renderWillSave([createSituationalRule()]);

		await toggle('Against fear');
		await waitFor(() => expect(formula()).toBe('d20 @ 1'));

		await roll();

		expect(submitRoll).toHaveBeenCalledWith(expect.objectContaining({ rollMode: 1 }));
	});

	it('drops the adjustment again when the option is unchecked', async () => {
		const { submitRoll, formula, roll, toggle } = renderWillSave([createSituationalRule()]);

		await toggle('Against fear');
		await waitFor(() => expect(formula()).toBe('d20 @ 1'));

		await toggle('Against fear');
		await waitFor(() => expect(formula()).toBe('d20 @ 0'));

		await roll();

		expect(submitRoll).toHaveBeenCalledWith(expect.objectContaining({ rollMode: 0 }));
	});

	it('sums every checked option, letting a penalty cancel an advantage', async () => {
		const { submitRoll, formula, roll, toggle } = renderWillSave([
			createSituationalRule({ id: 'fear', label: 'Against fear', value: 1 }),
			createSituationalRule({ id: 'cursed', label: 'Cursed', value: -1 }),
		]);

		await toggle('Against fear');
		await toggle('Cursed');
		await waitFor(() => expect(formula()).toBe('d20 @ 0'));

		await roll();

		expect(submitRoll).toHaveBeenCalledWith(expect.objectContaining({ rollMode: 0 }));
	});

	it('adds to a roll mode the save already carries', async () => {
		const { submitRoll, roll, toggle } = renderWillSave([createSituationalRule()], 1);

		await toggle('Against fear');
		await roll();

		expect(submitRoll).toHaveBeenCalledWith(expect.objectContaining({ rollMode: 2 }));
	});

	it("shows each granting item's image beside its label", () => {
		const { optionIcons } = renderWillSave([
			createSituationalRule({ id: 'fear', img: 'icons/backgrounds/haunted-past.webp' }),
			createSituationalRule({ id: 'cursed', img: 'icons/backgrounds/cursed.webp' }),
		]);

		expect(optionIcons()).toEqual([
			'icons/backgrounds/haunted-past.webp',
			'icons/backgrounds/cursed.webp',
		]);
	});

	it('renders no icon when the granting item has no image', () => {
		const { optionIcons } = renderWillSave([createSituationalRule({ img: '' })]);

		expect(optionIcons()).toEqual([]);
	});

	it('clamps the combined roll mode at the slider ceiling', async () => {
		const { submitRoll, formula, roll, toggle } = renderWillSave([createSituationalRule()], 6);

		await toggle('Against fear');
		await waitFor(() => expect(formula()).toBe('d20 @ 6'));

		await roll();

		expect(submitRoll).toHaveBeenCalledWith(expect.objectContaining({ rollMode: 6 }));
	});

	// Unchecking gives back what checking took, not the option's own value: at the
	// ceiling the adjustment is swallowed, so subtracting it would drop the roll
	// below where the roller left the slider.
	it('restores the roll mode when an option clamped at the ceiling is unchecked', async () => {
		const { submitRoll, formula, roll, toggle } = renderWillSave([createSituationalRule()], 6);

		await toggle('Against fear');
		await toggle('Against fear');
		await waitFor(() => expect(formula()).toBe('d20 @ 6'));

		await roll();

		expect(submitRoll).toHaveBeenCalledWith(expect.objectContaining({ rollMode: 6 }));
	});
});
