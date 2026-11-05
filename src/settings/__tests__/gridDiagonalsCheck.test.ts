import { beforeEach, describe, expect, it, vi } from 'vitest';
import { checkGridDiagonals, diagonalProblem } from '../gridDiagonalsCheck.js';

const { EQUIDISTANT, EXACT, APPROXIMATE, RECTILINEAR, ALTERNATING_1, ALTERNATING_2, ILLEGAL } =
	CONST.GRID_DIAGONALS;

type Globals = {
	game: {
		user: { isGM: boolean };
		settings: { get: ReturnType<typeof vi.fn>; set: ReturnType<typeof vi.fn> };
	};
	foundry: {
		applications: { api: { DialogV2: { wait: ReturnType<typeof vi.fn> } } };
		utils: { debouncedReload?: ReturnType<typeof vi.fn> };
	};
};

function globals() {
	return globalThis as unknown as Globals;
}

function world(diagonals: number, kept: number | null = null) {
	const values: Record<string, unknown> = {
		'core.gridDiagonals': diagonals,
		'nimble.gridDiagonalsKept': kept ?? -1,
	};
	globals().game.settings = {
		get: vi.fn((scope: string, key: string) => values[`${scope}.${key}`]),
		set: vi.fn(async (scope: string, key: string, value: unknown) => {
			values[`${scope}.${key}`] = value;
		}),
	};
	return values;
}

const dialog = () => globals().foundry.applications.api.DialogV2.wait;

function buttonsOf(call: number) {
	const options = dialog().mock.calls[call]?.[0] as { buttons: Array<{ action: string }> };
	return options.buttons.map((button) => button.action);
}

describe('diagonalProblem', () => {
	it('finds no problem with the book rules that measure in whole spaces', () => {
		expect(diagonalProblem(EQUIDISTANT)).toBeNull();
		expect(diagonalProblem(RECTILINEAR)).toBeNull();
		expect(diagonalProblem(ALTERNATING_1)).toBeNull();
		expect(diagonalProblem(ALTERNATING_2)).toBeNull();
	});

	it('flags Illegal, because tokens cannot move diagonally', () => {
		expect(diagonalProblem(ILLEGAL)).toBe('illegal');
	});

	it('flags the fractional rules, which are not in the book', () => {
		expect(diagonalProblem(EXACT)).toBe('notInBook');
		expect(diagonalProblem(APPROXIMATE)).toBe('notInBook');
	});
});

describe('checkGridDiagonals', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		globals().game.user.isGM = true;
		globals().foundry.utils.debouncedReload = vi.fn();
	});

	it('asks the GM about Illegal, with Equidistant, Rectilinear and Keep', async () => {
		world(ILLEGAL);
		dialog().mockResolvedValue('keep');

		await checkGridDiagonals();

		expect(buttonsOf(0)).toEqual(['equidistant', 'rectilinear', 'keep']);
	});

	it('offers Equidistant and Keep for a rule that is not in the book', async () => {
		world(EXACT);
		dialog().mockResolvedValue('keep');

		await checkGridDiagonals();

		expect(buttonsOf(0)).toEqual(['equidistant', 'keep']);
	});

	it('sets the picked rule and reloads', async () => {
		const values = world(ILLEGAL);
		dialog().mockResolvedValue('rectilinear');

		await checkGridDiagonals();

		expect(values['core.gridDiagonals']).toBe(RECTILINEAR);
		expect(globals().foundry.utils.debouncedReload).toHaveBeenCalled();
	});

	it('does not ask again about a value the GM kept, but asks when it changes', async () => {
		const values = world(ILLEGAL);
		dialog().mockResolvedValue('keep');

		await checkGridDiagonals();
		await checkGridDiagonals();
		expect(dialog()).toHaveBeenCalledTimes(1);
		expect(values['nimble.gridDiagonalsKept']).toBe(ILLEGAL);

		values['core.gridDiagonals'] = EXACT;
		await checkGridDiagonals();
		expect(dialog()).toHaveBeenCalledTimes(2);
	});

	it('changes nothing when the GM closes the popup', async () => {
		const values = world(ILLEGAL);
		dialog().mockResolvedValue(null);

		await checkGridDiagonals();

		expect(values['core.gridDiagonals']).toBe(ILLEGAL);
		expect(values['nimble.gridDiagonalsKept']).toBe(-1);
	});

	it('asks nothing for a book rule, or of a player', async () => {
		world(EQUIDISTANT);
		await checkGridDiagonals();

		world(ILLEGAL);
		globals().game.user.isGM = false;
		await checkGridDiagonals();

		expect(dialog()).not.toHaveBeenCalled();
	});
});
