import { fireEvent, render, screen } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';
import {
	blankHero,
	heroContext,
} from '../../../../../../tests/fixtures/actorSheets/heroFixtures.ts';
import { createSheetUiState } from '../../../shared/sheetUiState.ts';
import { type HeroMeterView, heroRail } from '../../heroRail.ts';
import HeroMeter from '../HeroMeter.svelte';

function meterOf(kind: HeroMeterView['kind'], context = heroContext()) {
	const meter = heroRail(blankHero(), context).meters.find((m) => m.kind === kind);
	if (!meter) throw new Error(`no ${kind} meter`);
	return meter;
}

function renderMeter(meter: HeroMeterView, editing = false) {
	const ui = $state({ ...createSheetUiState('core'), editing });
	const perform = vi.fn();
	render(HeroMeter, { meter, ui, perform });
	return { ui, perform };
}

const furyContext = () =>
	heroContext({
		dicePools: [{ id: 'fury', label: 'Fury Dice', dieSize: 'd6', max: 3, faces: [4, 2] }],
	});

describe('HeroMeter', () => {
	it('opens the menu of a die: Set value and Discard', async () => {
		const { perform } = renderMeter(meterOf('dicePool', furyContext()));

		await fireEvent.click(screen.getByRole('button', { name: /die 2: 2/ }));
		const value = screen.getByRole('spinbutton', { name: 'Set value' });
		await fireEvent.input(value, { target: { value: '5' } });
		await fireEvent.blur(value);
		expect(perform).toHaveBeenCalledWith({ kind: 'setDiceFaces', poolId: 'fury', faces: [4, 5] });

		await fireEvent.click(screen.getByRole('button', { name: /Discard$/ }));
		expect(perform).toHaveBeenCalledWith({ kind: 'setDiceFaces', poolId: 'fury', faces: [4] });
	});

	it('asks before Discard all, and empties the pool on yes', async () => {
		const { perform } = renderMeter(meterOf('dicePool', furyContext()));

		await fireEvent.click(screen.getByRole('button', { name: 'Discard all' }));
		expect(perform).not.toHaveBeenCalled();
		await fireEvent.click(screen.getAllByRole('button', { name: 'Discard all' }).at(-1)!);

		expect(perform).toHaveBeenCalledWith({ kind: 'setDiceFaces', poolId: 'fury', faces: [] });
	});

	it('rolls one more die into the pool', async () => {
		const { perform } = renderMeter(meterOf('dicePool', furyContext()));

		await fireEvent.click(screen.getByRole('button', { name: /Roll one more Fury Dice die/ }));

		expect(perform).toHaveBeenCalledWith({
			kind: 'rollIntoDicePool',
			poolId: 'fury',
			label: 'Fury Dice',
		});
	});

	it('rolls and spends one die of a count pool', async () => {
		const context = heroContext({
			chargePools: [
				{
					id: 'combat',
					label: 'Combat Dice',
					current: 2,
					max: 3,
					dieSize: 'd8',
					hidden: false,
					showAsResource: false,
				},
			],
		});
		const { perform } = renderMeter(meterOf('charges', context));

		await fireEvent.click(screen.getAllByRole('button', { name: /Roll and spend one/ })[0]);

		expect(perform).toHaveBeenCalledWith({
			kind: 'rollPoolCharge',
			poolId: 'combat',
			label: 'Combat Dice',
		});
	});

	it('gives Hit Dice a Roll in play and the configure outline in edit mode', async () => {
		const play = renderMeter(meterOf('hitDice'));
		await fireEvent.click(screen.getByRole('button', { name: /Roll$/ }));
		expect(play.perform).toHaveBeenCalledWith({ kind: 'rollHitDice' });
	});

	it('opens Configure Hit Dice from its outline in edit mode', async () => {
		const { perform } = renderMeter(meterOf('hitDice'), true);

		expect(screen.getByRole('button', { name: /Roll$/ })).toBeDisabled();
		await fireEvent.click(screen.getByRole('button', { name: 'Configure Hit Dice' }));

		expect(perform).toHaveBeenCalledWith({ kind: 'configure', target: 'hitDice' });
	});
});
