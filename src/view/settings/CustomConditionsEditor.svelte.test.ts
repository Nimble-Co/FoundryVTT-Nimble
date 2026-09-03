import { fireEvent, render, screen } from '@testing-library/svelte';
import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest';
import GenericDialog from '#documents/dialogs/GenericDialog.svelte.js';
import { SYSTEM_ID } from '#system';
import {
	CUSTOM_CONDITIONS_SETTING_KEY,
	DEFAULT_CUSTOM_CONDITION_ICON,
} from '../../settings/customConditionSettings.js';
import type { ConditionUsage } from '../../settings/findConditionUsage.js';
import CustomConditionsEditor from './CustomConditionsEditor.svelte';
import type { RemoveConditionResult } from './RemoveConditionDialog.types.ts';

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

function nameInput(): HTMLInputElement {
	return screen.getByPlaceholderText('e.g. Hexed') as HTMLInputElement;
}

function idInput(): HTMLInputElement {
	return screen.getByPlaceholderText('e.g. hexed') as HTMLInputElement;
}

function saveButton(): HTMLButtonElement {
	return screen.getByRole('button', { name: 'Save Conditions' }) as HTMLButtonElement;
}

/**
 * The removal dialog is a real ApplicationV2 subclass, so stub the registry accessor and hand back
 * the choice under test. Returns the spy so a test can read the usage the editor discovered.
 */
function stubRemovalDialog(result: RemoveConditionResult | null) {
	return vi.spyOn(GenericDialog, 'getOrCreate').mockReturnValue({
		render: vi.fn().mockResolvedValue(undefined),
		promise: Promise.resolve(result),
	} as never);
}

function discoveredUsage(spy: ReturnType<typeof stubRemovalDialog>): ConditionUsage {
	return (spy.mock.calls[0]?.[2] as { usage: ConditionUsage }).usage;
}

function actorCarrying(name: string, conditionId: string) {
	const actor = {
		uuid: `Actor.${name}`,
		name,
		img: '',
		items: [] as unknown[],
		effects: [] as unknown[],
	};
	actor.effects = [{ id: 'effect-1', statuses: new Set([conditionId]), parent: actor }];
	return actor;
}

function itemNaming(name: string, conditionId: string) {
	return {
		uuid: `Item.${name}`,
		name,
		img: '',
		system: { rules: [{ id: 'rule-1', type: 'applyCondition', condition: conditionId }] },
		update: vi.fn().mockResolvedValue(undefined),
	};
}

describe('CustomConditionsEditor', () => {
	beforeEach(() => {
		(CONFIG as unknown as { NIMBLE: Record<string, unknown> }).NIMBLE = {
			conditions: { ...BUILT_IN_CONDITIONS },
			conditionDescriptions: {},
			conditionDefaultImages: {},
		};
		(game as unknown as { actors: unknown[] }).actors = [];
		(game as unknown as { items: unknown[] }).items = [];
		(game as unknown as { scenes: unknown[] }).scenes = [];
		(CONFIG.NIMBLE as unknown as Record<string, unknown>).ruleTypes = {
			applyCondition: 'Apply Condition',
		};
		// Shared across the file and not auto-cleared, so the call assertions below need a clean slate.
		(foundry.applications.api.DialogV2.confirm as unknown as Mock).mockClear();
		vi.restoreAllMocks();
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

		await fireEvent.input(idInput(), { target: { value: '13' } });
		expect(screen.getByText(/^"13" cannot be used/)).toBeVisible();
		expect(saveButton()).toBeDisabled();

		await fireEvent.input(idInput(), { target: { value: 'length' } });
		expect(screen.getByText(/^"length" cannot be used/)).toBeVisible();
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

	it('locks the id of a stored condition, since effects and rules already carry it', async () => {
		renderEditor([{ id: 'hexed', name: 'Hexed', description: '', img: 'icons/svg/hex.svg' }]);
		expect(idInput()).toHaveAttribute('readonly');

		await fireEvent.click(screen.getByRole('button', { name: /Add Condition/ }));
		expect(screen.getAllByPlaceholderText('e.g. hexed')[1]).not.toHaveAttribute('readonly');
	});

	it('keeps each row with its own values when an earlier row is removed', async () => {
		renderEditor([
			{ id: 'hexed', name: 'Hexed', description: 'Cursed.', img: 'icons/svg/hex.svg' },
			{ id: 'shaken', name: 'Shaken', description: 'Rattled.', img: 'icons/svg/shaken.svg' },
		]);

		await fireEvent.click(screen.getAllByRole('button', { name: 'Remove condition' })[0]);

		expect(screen.getAllByPlaceholderText('e.g. hexed')).toHaveLength(1);
		expect(idInput().value).toBe('shaken');
		expect(
			(screen.getByPlaceholderText(/What this condition does/) as HTMLTextAreaElement).value,
		).toBe('Rattled.');
	});

	it('asks before removing a condition that anything still references', async () => {
		const spy = stubRemovalDialog(null);
		(game as unknown as { actors: unknown[] }).actors = [actorCarrying('Goblin', 'hexed')];
		(game as unknown as { items: unknown[] }).items = [itemNaming('Hex Bolt', 'hexed')];
		renderEditor([{ id: 'hexed', name: 'Hexed', description: '', img: 'icons/svg/hex.svg' }]);

		await fireEvent.click(screen.getByRole('button', { name: 'Remove condition' }));

		// Closing the dialog resolves null, which has to leave the row in place.
		expect(screen.getAllByPlaceholderText('e.g. hexed')).toHaveLength(1);

		const usage = discoveredUsage(spy);
		expect(usage.actors.map(({ name }) => name)).toEqual(['Goblin']);
		expect(usage.items.map(({ name }) => name)).toEqual(['Hex Bolt']);
	});

	it('leaves the references alone when the GM removes the condition only', async () => {
		stubRemovalDialog({ choice: 'keep' });
		const item = itemNaming('Hex Bolt', 'hexed');
		(game as unknown as { items: unknown[] }).items = [item];
		const { settingsMock } = renderEditor([
			{ id: 'hexed', name: 'Hexed', description: '', img: 'icons/svg/hex.svg' },
		]);

		await fireEvent.click(screen.getByRole('button', { name: 'Remove condition' }));
		await fireEvent.click(saveButton());

		expect(settingsMock.set).toHaveBeenCalledWith(SYSTEM_ID, CUSTOM_CONDITIONS_SETTING_KEY, []);
		expect(item.update).not.toHaveBeenCalled();
	});

	it('strips the references on save when the GM removes it everywhere', async () => {
		stubRemovalDialog({ choice: 'clean' });
		const actor = actorCarrying('Goblin', 'hexed');
		const deleteEmbedded = vi.fn();
		(actor as unknown as Record<string, unknown>).deleteEmbeddedDocuments = deleteEmbedded;
		const item = itemNaming('Hex Bolt', 'hexed');
		(game as unknown as { actors: unknown[] }).actors = [actor];
		(game as unknown as { items: unknown[] }).items = [item];
		const { settingsMock } = renderEditor([
			{ id: 'hexed', name: 'Hexed', description: '', img: 'icons/svg/hex.svg' },
		]);

		await fireEvent.click(screen.getByRole('button', { name: 'Remove condition' }));

		// Nothing may change before the save: closing the editor has to leave the world untouched.
		expect(item.update).not.toHaveBeenCalled();
		expect(deleteEmbedded).not.toHaveBeenCalled();

		await fireEvent.click(saveButton());

		expect(settingsMock.set).toHaveBeenCalledWith(SYSTEM_ID, CUSTOM_CONDITIONS_SETTING_KEY, []);
		expect(deleteEmbedded).toHaveBeenCalledWith('ActiveEffect', ['effect-1']);
		expect(item.update).toHaveBeenCalledWith({ 'system.rules': [] });
	});

	it('skips the cleanup when the GM re-adds the id before saving', async () => {
		stubRemovalDialog({ choice: 'clean' });
		const item = itemNaming('Hex Bolt', 'hexed');
		(game as unknown as { items: unknown[] }).items = [item];
		renderEditor([{ id: 'hexed', name: 'Hexed', description: '', img: 'icons/svg/hex.svg' }]);

		await fireEvent.click(screen.getByRole('button', { name: 'Remove condition' }));
		await fireEvent.click(screen.getByRole('button', { name: /Add Condition/ }));
		await fireEvent.input(nameInput(), { target: { value: 'Hexed' } });
		await fireEvent.click(saveButton());

		// The id still exists after the save, so nothing referencing it is stale.
		expect(item.update).not.toHaveBeenCalled();
	});

	it('counts a condition held by a suppressed effect, which Actor#statuses omits', async () => {
		const spy = stubRemovalDialog(null);
		// A disabled effect, or one granted by an unequipped item, keeps its statuses out of
		// `Actor#statuses` while still orphaning on delete.
		(game as unknown as { actors: unknown[] }).actors = [
			{
				uuid: 'Actor.Cleric',
				name: 'Cleric',
				img: '',
				items: [],
				statuses: new Set<string>(),
				effects: [],
				allApplicableEffects: () => [
					{ id: 'effect-9', statuses: new Set(['hexed']), parent: { uuid: 'Item.Amulet' } },
				],
			},
		];
		renderEditor([{ id: 'hexed', name: 'Hexed', description: '', img: 'icons/svg/hex.svg' }]);

		await fireEvent.click(screen.getByRole('button', { name: 'Remove condition' }));

		expect(spy).toHaveBeenCalled();
		expect(discoveredUsage(spy).actors).toHaveLength(1);
	});

	it('removes an unreferenced condition without asking', async () => {
		const spy = stubRemovalDialog(null);
		(game as unknown as { actors: unknown[] }).actors = [actorCarrying('Goblin', 'shaken')];
		renderEditor([{ id: 'hexed', name: 'Hexed', description: '', img: 'icons/svg/hex.svg' }]);

		await fireEvent.click(screen.getByRole('button', { name: 'Remove condition' }));

		expect(spy).not.toHaveBeenCalled();
		expect(screen.queryByPlaceholderText('e.g. hexed')).toBeNull();
	});
});
