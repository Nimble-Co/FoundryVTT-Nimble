import { render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
	blankHero,
	heroContext,
	heroTurn,
} from '../../../../../../tests/fixtures/actorSheets/heroFixtures.ts';
import { createSheetUiState } from '../../../shared/sheetUiState.ts';
import { heroRail } from '../../heroRail.ts';
import HeroTurnBox from '../HeroTurnBox.svelte';

const turnWith = (current: number) => {
	const combat = heroTurn({ actions: { current, effectiveMax: 3 } });
	const turn = heroRail(blankHero(), heroContext({ combat })).turn;
	if (!turn) throw new Error('no turn');
	return turn;
};

const cell = (number: number) =>
	screen.getByRole('button', { name: new RegExp(`Action {"number":"${number}"}`) });

describe('HeroTurnBox', () => {
	afterEach(() => {
		vi.useRealTimers();
	});

	it('pulses the cells just spent when the actions left go down', async () => {
		const ui = $state(createSheetUiState('core'));
		const { rerender } = render(HeroTurnBox, { turn: turnWith(3), ui, perform: vi.fn() });
		expect(cell(1)).not.toHaveAttribute('data-just-spent');

		await rerender({ turn: turnWith(1) });

		expect(cell(1)).not.toHaveAttribute('data-just-spent');
		expect(cell(2)).toHaveAttribute('data-just-spent');
		expect(cell(3)).toHaveAttribute('data-just-spent');
	});

	it('does not pulse when an action comes back', async () => {
		const ui = $state(createSheetUiState('core'));
		const { rerender } = render(HeroTurnBox, { turn: turnWith(1), ui, perform: vi.fn() });

		await rerender({ turn: turnWith(2) });

		expect(cell(2)).not.toHaveAttribute('data-just-spent');
	});

	it('clears the pulse after 0.6 s also when no animation runs', async () => {
		vi.useFakeTimers();
		const ui = $state(createSheetUiState('core'));
		const { rerender } = render(HeroTurnBox, { turn: turnWith(3), ui, perform: vi.fn() });
		await rerender({ turn: turnWith(2) });
		expect(cell(3)).toHaveAttribute('data-just-spent');

		await vi.advanceTimersByTimeAsync(600);

		expect(cell(3)).not.toHaveAttribute('data-just-spent');
	});
});
