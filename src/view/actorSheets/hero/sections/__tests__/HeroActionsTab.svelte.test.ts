import { fireEvent, render, screen, within } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';
import {
	blankHero,
	dicePoolContext,
	dicePoolHero,
	heroContext,
	heroTurn,
	itemState,
} from '../../../../../../tests/fixtures/actorSheets/heroFixtures.ts';
import { createSheetUiState, revealIn } from '../../../shared/sheetUiState.ts';
import { heroActionsTab } from '../../heroActionsTab.ts';
import type { HeroActorLike, HeroSheetContext } from '../../heroSource.ts';
import HeroActionsTab from '../HeroActionsTab.svelte';

const ACTIONS = 'NIMBLE.actorSheet.hero.actions';
const REACTIONS = 'NIMBLE.ui.heroicActions.reactions';

function renderTab(
	actor: HeroActorLike = dicePoolHero(),
	context: HeroSheetContext = dicePoolContext(),
	options: { editing?: boolean; columns?: 1 | 2 } = {},
) {
	const ui = $state({ ...createSheetUiState('actions'), editing: options.editing ?? false });
	const perform = vi.fn();
	const view = heroActionsTab(actor, context);
	render(HeroActionsTab, { view, ui, perform, columns: options.columns ?? 2 });
	return { ui, perform };
}

const rowOf = (id: string) => {
	const row = document.querySelector<HTMLElement>(`[data-row-id="${id}"]`);
	if (!row) throw new Error(`no row ${id}`);
	return row;
};

const chooseLabel = (name: RegExp) => new RegExp(`${ACTIONS}.chooseUse.*${name.source}`);

describe('HeroActionsTab', () => {
	it('sends the intent of a row', async () => {
		const { perform } = renderTab();

		await fireEvent.click(screen.getByRole('button', { name: /row\.use.*Greataxe/ }));

		expect(perform).toHaveBeenCalledWith({ kind: 'activate', itemId: 'greataxe' });
	});

	it('shows the reason of a blocked row and sends nothing', async () => {
		const gate = {
			code: 'insufficientCharges' as const,
			poolLabel: 'Rage',
			poolMax: 1,
			per: 'round' as const,
		};
		const { perform } = renderTab(
			dicePoolHero(),
			dicePoolContext({
				itemState: { ...dicePoolContext().itemState, rage: itemState({ actionCost: 1, gate }) },
			}),
		);
		const use = within(rowOf('rage')).getByRole('button', { name: /Rage\. .*usedThis/ });

		expect(use).toHaveAttribute('aria-disabled', 'true');
		expect(within(rowOf('rage')).getByText(/usedThis/)).toBeInTheDocument();
		await fireEvent.click(use);
		expect(perform).not.toHaveBeenCalled();
	});

	it('opens the choice step of Defend, names the target, and sends the reaction', async () => {
		const { ui, perform } = renderTab(blankHero(), heroContext({ targets: ['Goblin'] }));
		const use = screen.getByRole('button', { name: chooseLabel(/defend/) });

		await fireEvent.click(use);
		expect(ui.choiceStep).toBe('heroic-defend');
		expect(use).toHaveAttribute('aria-expanded', 'true');
		const step = within(rowOf('heroic-defend')).getByRole('group');
		expect(within(step).getByText(/actions\.target .*Goblin/)).toBeInTheDocument();

		await fireEvent.click(
			within(step).getByRole('button', { name: `${REACTIONS}.defend.confirm` }),
		);
		expect(perform).toHaveBeenCalledWith({ kind: 'reaction', reaction: 'defend' });
		expect(ui.choiceStep).toBeNull();
	});

	it('lists the equipped melee weapons and Unarmed Strike for an Opportunity Attack', async () => {
		const { perform } = renderTab();

		await fireEvent.click(screen.getByRole('button', { name: chooseLabel(/opportunity/) }));
		const step = within(rowOf('heroic-opportunity')).getByRole('group');
		expect(within(step).queryByRole('button', { name: 'Javelin' })).toBeNull();
		expect(
			within(step).getByRole('button', { name: 'NIMBLE.ui.heroicActions.unarmedStrike' }),
		).toBeInTheDocument();

		await fireEvent.click(within(step).getByRole('button', { name: 'Greataxe' }));
		expect(perform).toHaveBeenCalledWith({ kind: 'opportunityAttack', weaponId: 'greataxe' });
	});

	it('Assess: picks an option, goes back, then picks an option and a skill', async () => {
		const { ui, perform } = renderTab(blankHero(), heroContext());

		await fireEvent.click(screen.getByRole('button', { name: chooseLabel(/assess/) }));
		const step = () => within(rowOf('heroic-assess')).getByRole('group');
		await fireEvent.click(within(step()).getByRole('button', { name: /askQuestion\.title/ }));
		await fireEvent.click(within(step()).getByRole('button', { name: `${ACTIONS}.back` }));
		const options = within(step()).getAllByRole('button');
		expect(options).toHaveLength(3);

		await fireEvent.click(options[1]);
		await fireEvent.click(within(step()).getByRole('button', { name: /NIMBLE\.skills\.might/ }));
		expect(perform).toHaveBeenCalledWith({
			kind: 'assess',
			option: 'create-opening',
			skill: 'might',
		});
		expect(ui.choiceStep).toBeNull();
	});

	it('opens the dice step from outside, spends the dice that you pick, and cancels', async () => {
		const { ui, perform } = renderTab(dicePoolHero(), dicePoolContext({ combat: heroTurn() }));
		expect(within(rowOf('bloodlust')).queryByRole('group')).toBeNull();

		revealIn(ui, { tab: 'actions', rowId: 'bloodlust', step: 'choice' });
		const step = await within(rowOf('bloodlust')).findByRole('group', {
			name: `${ACTIONS}.pickDice`,
		});
		const spend = within(step).getByRole('button', { name: `${ACTIONS}.spend` });
		expect(spend).toHaveAttribute('aria-disabled', 'true');

		const dice = within(step).getAllByRole('button', { pressed: false });
		await fireEvent.click(dice[1]);
		await fireEvent.click(dice[0]);
		expect(dice[0]).toHaveAttribute('aria-pressed', 'true');
		await fireEvent.click(spend);
		expect(perform).toHaveBeenCalledWith({
			kind: 'spendDice',
			itemId: 'bloodlust',
			ruleId: 'bloodlustDice',
			poolId: 'fury',
			indices: [0, 1],
		});
		expect(ui.choiceStep).toBeNull();

		revealIn(ui, { tab: 'actions', rowId: 'bloodFrenzy', step: 'choice' });
		const frenzy = await within(rowOf('bloodFrenzy')).findByRole('group', {
			name: `${ACTIONS}.pickDice`,
		});
		const faces = within(frenzy).getAllByRole('button', { pressed: false });
		expect(faces[1]).toBeDisabled();
		await fireEvent.click(within(frenzy).getByRole('button', { name: `${ACTIONS}.cancel` }));
		expect(ui.choiceStep).toBeNull();
		expect(perform).toHaveBeenCalledTimes(1);
	});

	it('shows the note of an empty pool and nothing to pick', async () => {
		const { ui } = renderTab(
			dicePoolHero(),
			dicePoolContext({
				dicePools: [{ id: 'fury', label: 'Fury Dice', dieSize: 'd6', max: 3, faces: [] }],
			}),
		);

		revealIn(ui, { tab: 'actions', rowId: 'bloodlust', step: 'choice' });
		const step = await within(rowOf('bloodlust')).findByRole('group', {
			name: `${ACTIONS}.pickDice`,
		});
		expect(within(step).getByText(/spendRequestEmptyPool/)).toBeInTheDocument();
		expect(within(step).queryByRole('button', { name: `${ACTIONS}.spend` })).toBeNull();
	});

	it('opens every row with Expand all, and closes them with Collapse all', async () => {
		const { ui } = renderTab();
		const ids = [...document.querySelectorAll('[data-row-id]')].map((row) =>
			row.getAttribute('data-row-id'),
		);

		await fireEvent.click(screen.getByRole('button', { name: 'Expand all' }));
		expect([...ui.openRows].sort()).toEqual([...ids].sort());
		expect(within(rowOf('heroic-defend')).getByRole('button', { expanded: true })).toBeTruthy();

		await fireEvent.click(screen.getByRole('button', { name: 'Collapse all' }));
		expect(ui.openRows).toEqual([]);
	});

	it('types the charges of a pool in edit mode, and the row does not act', async () => {
		const pool = { id: 'ragePool', label: 'Rage', current: 2, max: 3, need: 1, per: null };
		const { perform } = renderTab(
			dicePoolHero(),
			dicePoolContext({
				itemState: { ...dicePoolContext().itemState, rage: itemState({ pools: [pool] }) },
			}),
			{ editing: true },
		);
		expect(screen.queryByRole('button', { name: /row\.use.*Rage/ })).toBeNull();
		const field = within(rowOf('rage')).getByRole('spinbutton', { name: /usesOf/ });

		await fireEvent.input(field, { target: { value: '1' } });
		await fireEvent.blur(field);

		expect(perform).toHaveBeenCalledWith({ kind: 'setPoolCharges', poolId: 'ragePool', value: 1 });
	});

	it('gives HeroicAction and Item drag data, and stops a touch drag outside edit mode', async () => {
		renderTab();
		const setData = vi.fn();

		await fireEvent.dragStart(rowOf('heroic-defend'), { dataTransfer: { setData } });
		expect(JSON.parse(setData.mock.calls[0][1])).toMatchObject({
			type: 'HeroicAction',
			actionId: 'defend',
			actionType: 'reaction',
		});

		await fireEvent.dragStart(rowOf('greataxe'), { dataTransfer: { setData } });
		expect(JSON.parse(setData.mock.calls[1][1])).toEqual({
			type: 'Item',
			uuid: 'Actor.blankHero00000001.Item.greataxe',
		});

		await fireEvent.pointerDown(rowOf('greataxe'), { pointerType: 'touch' });
		const stopped = await fireEvent.dragStart(rowOf('greataxe'), { dataTransfer: { setData } });
		expect(stopped).toBe(false);
		expect(setData).toHaveBeenCalledTimes(2);
	});

	it('shows the reactions first in one column when it is not your turn', () => {
		renderTab(blankHero(), heroContext({ combat: heroTurn({ isTurn: false }) }), { columns: 1 });
		const headings = screen.getAllByRole('heading').map((heading) => heading.textContent);

		expect(headings[0]).toBe(`${ACTIONS}.groups.reactions`);
	});

	it('changes the UI state from its rows with no Svelte ownership warning', async () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
		const { ui } = renderTab();

		await fireEvent.click(screen.getByRole('button', { name: chooseLabel(/defend/) }));
		await fireEvent.click(
			within(rowOf('heroic-defend')).getByRole('button', { name: `${REACTIONS}.defend.confirm` }),
		);
		await fireEvent.click(within(rowOf('greataxe')).getAllByRole('button')[0]);
		await fireEvent.click(screen.getByRole('button', { name: 'Expand all' }));
		revealIn(ui, { tab: 'actions', rowId: 'bloodlust', step: 'choice' });
		const step = await within(rowOf('bloodlust')).findByRole('group', {
			name: `${ACTIONS}.pickDice`,
		});
		await fireEvent.click(within(step).getAllByRole('button', { pressed: false })[0]);
		await fireEvent.click(within(step).getByRole('button', { name: `${ACTIONS}.spend` }));

		expect(warn.mock.calls.flat().join('\n')).not.toMatch(/ownership_invalid_mutation/);
		warn.mockRestore();
	});
});
