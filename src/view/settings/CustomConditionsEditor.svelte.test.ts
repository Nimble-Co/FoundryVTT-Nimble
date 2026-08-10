import { fireEvent, render, screen } from '@testing-library/svelte';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type GenericDialog from '#documents/dialogs/GenericDialog.svelte.js';
import { SYSTEM_ID } from '#system';
import {
	CUSTOM_CONDITIONS_SETTING_KEY,
	DEFAULT_CUSTOM_CONDITION_ICON,
} from '../../settings/customConditionSettings.js';
import CustomConditionsEditor from './CustomConditionsEditor.svelte';

type SettingsMock = {
	get: ReturnType<typeof vi.fn>;
	set: ReturnType<typeof vi.fn>;
};

const BUILT_IN_CONDITIONS = { blinded: 'Blinded', prone: 'Prone' };

function renderEditor(storedConditions: unknown[] = []) {
	const settingsMock: SettingsMock = {
		get: vi.fn().mockReturnValue(storedConditions),
		set: vi.fn().mockResolvedValue(undefined),
	};
	(game as unknown as { settings: SettingsMock }).settings = settingsMock;

	const dialog = { close: vi.fn() } as unknown as GenericDialog;
	const result = render(CustomConditionsEditor, { props: { dialog } });

	return { ...result, settingsMock, dialog };
}

/** The name field of the first (and, in these tests, only) condition card. */
function nameInput(): HTMLInputElement {
	return screen.getByPlaceholderText('e.g. Hexed') as HTMLInputElement;
}

/** The id field of the first condition card. */
function idInput(): HTMLInputElement {
	return screen.getByPlaceholderText('e.g. hexed') as HTMLInputElement;
}

function saveButton(): HTMLButtonElement {
	return screen.getByRole('button', { name: 'Save Conditions' }) as HTMLButtonElement;
}

describe('CustomConditionsEditor', () => {
	beforeEach(() => {
		(CONFIG as unknown as { NIMBLE: Record<string, unknown> }).NIMBLE = {
			conditions: { ...BUILT_IN_CONDITIONS },
			conditionDescriptions: {},
			conditionDefaultImages: {},
		};
	});

	it('shows the empty state until a condition is added', async () => {
		renderEditor();

		expect(screen.getByText('No custom conditions yet. Add one to get started.')).toBeVisible();

		await fireEvent.click(screen.getByRole('button', { name: /Add Condition/ }));

		expect(screen.queryByText('No custom conditions yet. Add one to get started.')).toBeNull();
		expect(nameInput()).toBeVisible();
	});

	it('derives the id from the name until the id is edited by hand', async () => {
		renderEditor();
		await fireEvent.click(screen.getByRole('button', { name: /Add Condition/ }));

		await fireEvent.input(nameInput(), { target: { value: 'Soul Burned' } });
		expect(idInput().value).toBe('soul_burned');

		await fireEvent.input(idInput(), { target: { value: 'seared' } });
		await fireEvent.input(nameInput(), { target: { value: 'Soul Seared' } });

		expect(idInput().value).toBe('seared');
	});

	it('blocks saving while an id is missing, reserved, or duplicated', async () => {
		renderEditor();
		await fireEvent.click(screen.getByRole('button', { name: /Add Condition/ }));

		expect(screen.getByText('Id is required.')).toBeVisible();
		expect(saveButton()).toBeDisabled();

		await fireEvent.input(idInput(), { target: { value: 'Prone' } });
		expect(screen.getByText('That id is reserved by a built-in condition.')).toBeVisible();
		expect(saveButton()).toBeDisabled();

		await fireEvent.input(idInput(), { target: { value: 'hexed' } });
		expect(saveButton()).toBeEnabled();

		await fireEvent.click(screen.getByRole('button', { name: /Add Condition/ }));
		const idFields = screen.getAllByPlaceholderText('e.g. hexed');
		await fireEvent.input(idFields[1], { target: { value: 'hexed' } });

		expect(screen.getByText('Duplicate id.')).toBeVisible();
		expect(saveButton()).toBeDisabled();
	});

	it('persists the edited rows and closes the dialog on save', async () => {
		const { settingsMock, dialog } = renderEditor();
		await fireEvent.click(screen.getByRole('button', { name: /Add Condition/ }));

		await fireEvent.input(nameInput(), { target: { value: 'Hexed' } });
		await fireEvent.input(screen.getByPlaceholderText(/What this condition does/), {
			target: { value: '  Cursed by a hex.  ' },
		});

		await fireEvent.click(saveButton());

		expect(settingsMock.set).toHaveBeenCalledWith(SYSTEM_ID, CUSTOM_CONDITIONS_SETTING_KEY, [
			{
				id: 'hexed',
				name: 'Hexed',
				description: 'Cursed by a hex.',
				img: DEFAULT_CUSTOM_CONDITION_ICON,
			},
		]);
		expect(dialog.close).toHaveBeenCalled();
	});

	it('reports a failed save and keeps the dialog open', async () => {
		const { settingsMock, dialog } = renderEditor();
		settingsMock.set.mockRejectedValue(new Error('world is locked'));
		vi.spyOn(console, 'error').mockImplementation(() => undefined);

		await fireEvent.click(screen.getByRole('button', { name: /Add Condition/ }));
		await fireEvent.input(nameInput(), { target: { value: 'Hexed' } });
		await fireEvent.click(saveButton());

		expect(ui.notifications?.error).toHaveBeenCalledWith(
			'Could not save the custom conditions. See the console for details.',
		);
		expect(dialog.close).not.toHaveBeenCalled();
		// The in-flight guard must clear, or the GM can never retry.
		expect(saveButton()).toBeEnabled();
	});

	it('loads the stored conditions and drops the ones removed before saving', async () => {
		const { settingsMock } = renderEditor([
			{ id: 'hexed', name: 'Hexed', description: 'Cursed.', img: 'icons/svg/hex.svg' },
			{ id: 'shaken', name: 'Shaken', description: '', img: 'icons/svg/shaken.svg' },
		]);

		expect(screen.getAllByPlaceholderText('e.g. hexed')).toHaveLength(2);

		await fireEvent.click(screen.getAllByRole('button', { name: 'Remove condition' })[0]);
		await fireEvent.click(saveButton());

		expect(settingsMock.set).toHaveBeenCalledWith(SYSTEM_ID, CUSTOM_CONDITIONS_SETTING_KEY, [
			{ id: 'shaken', name: 'Shaken', description: '', img: 'icons/svg/shaken.svg' },
		]);
	});
});
