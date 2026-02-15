import { fireEvent, render, screen } from '@testing-library/svelte';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import CombatTrackerControls from './CombatTrackerControls.svelte';

type TestGlobals = {
	game: {
		combat?: {
			id: string;
			delete: ReturnType<typeof vi.fn>;
			previousRound: ReturnType<typeof vi.fn>;
			previousTurn: ReturnType<typeof vi.fn>;
			nextRound: ReturnType<typeof vi.fn>;
			nextTurn: ReturnType<typeof vi.fn>;
		};
	};
	foundry: {
		applications: {
			api: {
				DialogV2: {
					confirm: ReturnType<typeof vi.fn>;
				};
			};
		};
	};
};

function globals() {
	return globalThis as unknown as TestGlobals;
}

function createCombatMock(id = 'combat-1') {
	return {
		id,
		delete: vi.fn().mockResolvedValue(undefined),
		previousRound: vi.fn(),
		previousTurn: vi.fn(),
		nextRound: vi.fn(),
		nextTurn: vi.fn(),
	};
}

describe('CombatTrackerControls', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('ends combat when confirmation resolves true', async () => {
		const combat = createCombatMock();
		globals().game.combat = combat;
		globals().foundry.applications.api.DialogV2.confirm.mockResolvedValue(true);

		render(CombatTrackerControls);
		await fireEvent.click(screen.getByRole('button', { name: 'End Combat' }));

		expect(combat.delete).toHaveBeenCalledTimes(1);
	});

	it('does not end combat when confirmation resolves false', async () => {
		const combat = createCombatMock();
		globals().game.combat = combat;
		globals().foundry.applications.api.DialogV2.confirm.mockResolvedValue(false);

		render(CombatTrackerControls);
		await fireEvent.click(screen.getByRole('button', { name: 'End Combat' }));

		expect(combat.delete).not.toHaveBeenCalled();
	});

	it('does not end combat when confirmation resolves a non-boolean value', async () => {
		const combat = createCombatMock();
		globals().game.combat = combat;
		globals().foundry.applications.api.DialogV2.confirm.mockResolvedValue('no');

		render(CombatTrackerControls);
		await fireEvent.click(screen.getByRole('button', { name: 'End Combat' }));

		expect(combat.delete).not.toHaveBeenCalled();
	});
});
