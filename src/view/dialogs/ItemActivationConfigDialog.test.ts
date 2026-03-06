import { render, screen } from '@testing-library/svelte';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ItemActivationConfigDialog from './ItemActivationConfigDialog.svelte';

describe('ItemActivationConfigDialog', () => {
	beforeEach(() => {
		(
			game as typeof game & {
				settings: { get: ReturnType<typeof vi.fn> };
				user: { isGM: boolean };
			}
		).settings = {
			get: vi.fn().mockReturnValue(false),
		};
		(game as typeof game & { user: { isGM: boolean } }).user = { isGM: true };
		(Roll as typeof Roll & { replaceFormulaData?: unknown }).replaceFormulaData = undefined;
	});

	it('renders damage formulas even when Roll.replaceFormulaData is unavailable', () => {
		const actor = {
			getRollData: vi.fn().mockReturnValue({
				level: 2,
			}),
		};
		const item = {
			system: {
				activation: {
					effects: [
						{
							id: 'damage-1',
							type: 'damage',
							formula: '1d6+@level',
							damageType: 'fire',
						},
					],
				},
			},
		};
		const dialog = {
			submitActivation: vi.fn(),
		};

		render(ItemActivationConfigDialog, {
			props: {
				actor,
				dialog,
				item,
				rollMode: 0,
			},
		});

		expect(screen.getByText('1d6+2')).toBeInTheDocument();
	});
});
