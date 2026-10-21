import { fireEvent, render, screen, within } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type GenericDialog from '#documents/dialogs/GenericDialog.svelte.js';
import { SYSTEM_ID } from '#system';
import { AUTOMATION_SETTING_KEYS } from '../../settings/automationSettings.js';
import AutomationSettingsDialog from './AutomationSettingsDialog.svelte';

type GameStub = { settings?: unknown; user?: unknown };

const gameStub = () => game as unknown as GameStub;

let stored: Record<string, boolean>;
let settingsSet: ReturnType<typeof vi.fn>;
let previous: GameStub;

function renderDialog() {
	const dialog = { close: vi.fn() } as unknown as GenericDialog;
	render(AutomationSettingsDialog, { props: { dialog } });
	return dialog;
}

function checkbox(name: string): HTMLInputElement {
	return screen.getByRole('checkbox', { name }) as HTMLInputElement;
}

function section(legend: string): HTMLElement {
	return screen.getByRole('group', { name: legend });
}

describe('AutomationSettingsDialog', () => {
	beforeEach(() => {
		previous = { settings: gameStub().settings, user: gameStub().user };
		stored = {};
		settingsSet = vi.fn(async (_namespace: string, key: string, value: boolean) => {
			stored[key] = value;
		});
		gameStub().settings = {
			get: vi.fn((_namespace: string, key: string) => stored[key]),
			set: settingsSet,
		};
		gameStub().user = { isGM: true };
	});

	afterEach(() => {
		gameStub().settings = previous.settings;
		gameStub().user = previous.user;
	});

	it('shows the intro line', () => {
		renderDialog();

		expect(
			screen.getByText(
				'Choose what the system does for you. Everything is on by default. Core rules, such as Last Stand and defeat, are always on.',
			),
		).toBeVisible();
	});

	it('puts each setting in its group, in order', () => {
		renderDialog();

		const names = (legend: string) =>
			within(section(legend))
				.getAllByRole('checkbox')
				.map((input) => input.getAttribute('id'));

		expect(names('Features and Effects')).toEqual([
			'nimble-automation-applyRuleEffects',
			'nimble-automation-derivedConditions',
		]);
		expect(names('Resources')).toEqual([
			'nimble-automation-resourceRecovery',
			'nimble-automation-resourceSpending',
		]);
		expect(names('Combat')).toEqual([
			'nimble-automation-actionTracking',
			'nimble-automation-healthStateSync',
			'nimble-automation-combatConvenience',
		]);
		expect(names('Movement')).toEqual([
			'nimble-automation-movementTracking',
			'nimble-automation-movementOffers',
		]);
		expect(names('Chat')).toEqual(['nimble-automation-chatNotifications']);
	});

	it('labels every toggle with its new name and checks them all by default', () => {
		renderDialog();

		for (const name of [
			'Feature Effects',
			'Linked Conditions',
			'Refills',
			'Costs',
			'Action Spending',
			'Bloodied Status',
			'Initiative for Heroes',
			'Movement Count',
			'Pushes, Pulls and Moves for Free',
			'Chat Notes',
		]) {
			expect(checkbox(name)).toBeChecked();
		}
		expect(screen.getAllByRole('checkbox')).toHaveLength(
			Object.keys(AUTOMATION_SETTING_KEYS).length,
		);
	});

	it('shows an Off line only for the settings that have one, and ties it to the checkbox', () => {
		renderDialog();

		expect(screen.getAllByText(/^Off: /)).toHaveLength(4);
		expect(checkbox('Feature Effects')).toHaveAccessibleDescription(
			'Features apply their conditions, marks and rerolls by themselves, and their effects end on time. Casting a Concentration spell starts Concentration. Off: the chat card shows a button for each one.',
		);
		expect(checkbox('Costs')).toHaveAccessibleDescription(
			'Spells, items and rerolls spend their mana and charges, and stop when there is not enough. Charges that an attack refills on a hit or a crit count as costs too. Off: only heroic reactions are spent. Track other costs by hand.',
		);
		expect(checkbox('Refills')).toHaveAccessibleDescription(
			'Charges and dice pools refill at their set times, such as a rest or the end of an encounter.',
		);
	});

	it('disables Pushes, Pulls and Moves for Free while Movement Count is unchecked', async () => {
		renderDialog();
		const movementCount = checkbox('Movement Count');
		const child = checkbox('Pushes, Pulls and Moves for Free');

		expect(child).toBeEnabled();

		await fireEvent.click(movementCount);
		expect(child).toBeDisabled();
		expect(child).toBeChecked();

		await fireEvent.click(movementCount);
		expect(child).toBeEnabled();
	});

	it('disables the child when Movement Count is stored as off', () => {
		stored[AUTOMATION_SETTING_KEYS.movementTracking] = false;
		renderDialog();

		expect(checkbox('Movement Count')).not.toBeChecked();
		expect(checkbox('Pushes, Pulls and Moves for Free')).toBeDisabled();
	});

	it('saves only the toggles that changed, and keeps the child value while it is disabled', async () => {
		const dialog = renderDialog();

		await fireEvent.click(checkbox('Movement Count'));
		await fireEvent.click(checkbox('Costs'));
		await fireEvent.click(screen.getByRole('button', { name: 'Save Automation Settings' }));

		await vi.waitFor(() => expect(dialog.close).toHaveBeenCalled());
		expect(settingsSet).toHaveBeenCalledTimes(2);
		expect(settingsSet).toHaveBeenCalledWith(
			SYSTEM_ID,
			AUTOMATION_SETTING_KEYS.resourceSpending,
			false,
		);
		expect(settingsSet).toHaveBeenCalledWith(
			SYSTEM_ID,
			AUTOMATION_SETTING_KEYS.movementTracking,
			false,
		);
	});

	it('saves nothing for a player who is not a GM', async () => {
		gameStub().user = { isGM: false };
		const dialog = renderDialog();

		await fireEvent.click(checkbox('Costs'));
		await fireEvent.click(screen.getByRole('button', { name: 'Save Automation Settings' }));

		expect(settingsSet).not.toHaveBeenCalled();
		expect(dialog.close).not.toHaveBeenCalled();
	});
});
