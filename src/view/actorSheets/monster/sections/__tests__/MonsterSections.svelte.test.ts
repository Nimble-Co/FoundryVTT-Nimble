import { fireEvent, render, screen } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';
import {
	effectsMonster,
	effectsMonsterContext,
	goblin,
	minion,
	monsterContext,
	soloMonster,
} from '../../../../../../tests/fixtures/actorSheets/monsterFixtures.ts';
import { createSheetUiState } from '../../../shared/sheetUiState.ts';
import { monsterEffectsTab } from '../../monsterEffectsTab.ts';
import { monsterFrame } from '../../monsterFrame.ts';
import { monsterNotesTab } from '../../monsterNotesTab.ts';
import { monsterRail } from '../../monsterRail.ts';
import { monsterSettingsTab } from '../../monsterSettingsTab.ts';
import MonsterEffectsTab from '../MonsterEffectsTab.svelte';
import MonsterNotesTab from '../MonsterNotesTab.svelte';
import MonsterRail from '../MonsterRail.svelte';
import MonsterSettingsTab from '../MonsterSettingsTab.svelte';

const FX = 'NIMBLE.actorSheet.shared.effects';
const RAIL = 'NIMBLE.actorSheet.monster.rail';

function setup(tab: string) {
	const ui = $state(createSheetUiState(tab));
	return { ui, perform: vi.fn() };
}

describe('MonsterRail', () => {
	const renderRail = (actor = soloMonster(), context = monsterContext()) => {
		const { ui, perform } = setup('abilities');
		render(MonsterRail, {
			view: monsterRail(actor, context),
			frame: monsterFrame(actor, context),
			ui,
			perform,
		});
		return { ui, perform };
	};

	it('rolls a save on a click of its tile', async () => {
		const { perform } = renderRail();
		const [, dexterity] = screen
			.getAllByRole('button')
			.filter((button) => button.textContent?.includes('NIMBLE.savingThrowAbbreviations'));

		await fireEvent.click(dexterity);

		expect(perform).toHaveBeenCalledWith({ kind: 'rollSave', save: 'dexterity' });
	});

	it('sets the HP that you type', async () => {
		const { perform } = renderRail();
		const hp = screen.getByRole('spinbutton', { name: /vitalPlate\.hp$/ });

		await fireEvent.input(hp, { target: { value: '40' } });
		await fireEvent.blur(hp);

		expect(perform).toHaveBeenCalledWith({ kind: 'setHp', value: 40 });
	});

	it('shows the minion rules in place of the HP', () => {
		renderRail(minion());

		expect(screen.getByText(`${RAIL}.minion.noHp`)).toBeInTheDocument();
		expect(screen.queryAllByRole('spinbutton')).toHaveLength(0);
	});

	it('shows the VULNERABLE line when the monster has a vulnerability', () => {
		renderRail(goblin({ system: { attributes: { damageVulnerabilities: ['fire'] } } }));

		expect(screen.getByText(`${RAIL}.defenses.vulnerable`)).toBeInTheDocument();
		expect(screen.getByText('Fire')).toBeInTheDocument();
	});

	it('goes to the tab that you pick', async () => {
		const { ui } = renderRail();

		await fireEvent.click(screen.getByRole('tab', { name: /tabs\.effects/ }));

		expect(ui.tab).toBe('effects');
	});
});

describe('MonsterEffectsTab', () => {
	const renderTab = () => {
		const { ui, perform } = setup('effects');
		render(MonsterEffectsTab, {
			view: monsterEffectsTab(effectsMonster(), effectsMonsterContext()),
			ui,
			perform,
		});
		return { ui, perform };
	};

	it('asks before it removes an effect, and removes it on Yes', async () => {
		const { perform } = renderTab();
		const bless = screen.getByRole('button', { name: `${FX}.removeName {"name":"Bless"}` });

		await fireEvent.click(bless);
		expect(perform).not.toHaveBeenCalled();
		await fireEvent.click(screen.getByRole('button', { name: `${FX}.remove` }));

		expect(perform).toHaveBeenCalledWith({ kind: 'removeEffect', effectId: 'bless', itemId: null });
	});

	it('turns a condition on from the grid, and the arrow keys move in it', async () => {
		const { perform } = renderTab();
		const grid = screen.getByRole('group', { name: `${FX}.allConditions` });
		const [dazed, frightened] = [...grid.querySelectorAll('button')];

		await fireEvent.click(frightened);
		dazed.focus();
		await fireEvent.keyDown(dazed, { key: 'End' });

		expect(perform).toHaveBeenCalledWith({
			kind: 'setCondition',
			conditionId: 'frightened',
			active: true,
		});
		expect(document.activeElement?.textContent).toBe('Prone');
	});
});

describe('MonsterNotesTab', () => {
	it('shows the import credit line under the notes', () => {
		const { ui } = setup('notes');
		render(MonsterNotesTab, {
			view: monsterNotesTab(
				goblin(),
				monsterContext({ importCredit: '<a href="https://example.com">Made by Ada</a>' }),
			),
			ui,
		});

		expect(screen.getByRole('link', { name: 'Made by Ada' })).toBeInTheDocument();
	});

	it('says so when there are no notes', () => {
		const { ui } = setup('notes');
		render(MonsterNotesTab, { view: monsterNotesTab(soloMonster(), monsterContext()), ui });

		expect(screen.getByText('NIMBLE.actorSheet.monster.notes.none')).toBeInTheDocument();
	});
});

describe('MonsterSettingsTab', () => {
	it('changes the image settings only in edit mode, and the coins in all modes', async () => {
		const { ui, perform } = setup('settings');
		render(MonsterSettingsTab, {
			view: monsterSettingsTab(goblin(), monsterContext()),
			ui,
			perform,
		});
		const scale = screen.getByRole('spinbutton', {
			name: 'NIMBLE.actorSheet.monster.settings.imageScale',
		});
		const gold = screen.getByRole('spinbutton', { name: /settings\.coin .*gp/ });

		expect(scale).toBeDisabled();
		expect(gold).toBeEnabled();
		await fireEvent.change(gold, { target: { value: '7' } });

		expect(perform).toHaveBeenCalledWith({ kind: 'setCurrency', coin: 'gp', value: 7 });
		expect(screen.getByText('TYPES.Actor.npc')).toBeInTheDocument();
	});
});
