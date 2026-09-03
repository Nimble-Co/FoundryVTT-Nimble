import GenericDialog from '#documents/dialogs/GenericDialog.svelte.js';
import localize from '#utils/localize.js';
import {
	DEFAULT_CUSTOM_CONDITION_ICON,
	getBuiltInConditionIds,
	getCustomConditions,
	isUnsafeConditionId,
	sanitizeConditionId,
	setCustomConditions,
} from '../../settings/customConditionSettings.js';
import findConditionUsage, { type ConditionUsage } from '../../settings/findConditionUsage.js';
import removeConditionReferences from '../../settings/removeConditionReferences.js';
import type { ConditionEditorRow } from './CustomConditionsEditor.types.ts';
import RemoveConditionDialog from './RemoveConditionDialog.svelte';
import type { RemoveConditionResult } from './RemoveConditionDialog.types.ts';

const t = (key: string, data?: Record<string, string>) =>
	localize(`NIMBLE.settings.customConditions.${key}`, data);

export function createCustomConditionsEditorState(dialog: () => GenericDialog) {
	const builtInIds = getBuiltInConditionIds();

	const rows = $state<ConditionEditorRow[]>(
		getCustomConditions().map(({ id, name, description, img }) => ({
			uid: foundry.utils.randomID(),
			id,
			name,
			description,
			img,
			idEdited: true,
			persisted: true,
		})),
	);

	const rowErrors = $derived.by(() => {
		const seen = new Set<string>();
		return rows.map((row) => {
			const id = sanitizeConditionId(row.id);
			if (!id) return t('errorEmptyId');
			if (isUnsafeConditionId(id)) return t('errorInvalidId', { id });
			if (builtInIds.includes(id)) return t('errorReservedId');
			if (seen.has(id)) return t('errorDuplicateId');

			seen.add(id);
			return '';
		});
	});

	const hasErrors = $derived(rowErrors.some((error) => error !== ''));

	let saving = $state(false);

	/**
	 * Cleanups the GM opted into, applied on save rather than on removal. Closing the editor without
	 * saving has to leave the world untouched, or the dialog's own promise would be a lie.
	 */
	const pendingCleanups = new Map<string, ConditionUsage>();

	function addRow() {
		rows.push({
			uid: foundry.utils.randomID(),
			id: '',
			name: '',
			description: '',
			img: DEFAULT_CUSTOM_CONDITION_ICON,
			idEdited: false,
			persisted: false,
		});
	}

	async function removeRow(row: ConditionEditorRow) {
		// Only a saved condition can have anything pointing at it. An unsaved row has never been in
		// CONFIG, so no effect carries its status and no rule could have chosen it.
		if (row.persisted) {
			const usage = findConditionUsage(row.id);

			if (usage.total > 0) {
				const dialog = GenericDialog.getOrCreate(
					localize('NIMBLE.settings.customConditions.removeDialog.windowTitle'),
					RemoveConditionDialog as never,
					{ conditionName: row.name, conditionImg: row.img, usage },
					{
						uniqueId: `nimble-remove-condition-${row.uid}`,
						icon: 'fa-solid fa-triangle-exclamation',
						width: 460,
						resizable: true,
					},
				);

				await dialog.render(true);
				const result = (await dialog.promise) as RemoveConditionResult | null;
				// Closing the dialog resolves null, which is the cancel path: leave the row alone.
				if (!result) return;

				if (result.choice === 'clean') pendingCleanups.set(row.id, usage);
			}
		}

		const index = rows.indexOf(row);
		if (index !== -1) rows.splice(index, 1);
	}

	function onNameInput(row: ConditionEditorRow, value: string) {
		row.name = value;
		if (!row.idEdited) row.id = sanitizeConditionId(value);
	}

	function onIdInput(row: ConditionEditorRow, value: string) {
		row.idEdited = true;
		row.id = value;
	}

	function normalizeId(row: ConditionEditorRow) {
		row.id = sanitizeConditionId(row.id);
	}

	function pickIcon(row: ConditionEditorRow) {
		const picker = new foundry.applications.apps.FilePicker.implementation({
			type: 'image',
			current: row.img,
			callback: (path: string) => {
				row.img = path;
			},
		});
		picker.browse().catch((error: unknown) => {
			console.error('Nimble | Failed to open the condition icon picker:', error);
			ui.notifications?.error(t('iconPickerFailed'));
		});
	}

	async function save() {
		if (hasErrors || saving) return;

		const cleaned = rows.map((row) => {
			const id = sanitizeConditionId(row.id);
			const name = row.name.trim() || id.charAt(0).toUpperCase() + id.slice(1);
			const description = row.description.trim();
			const img = row.img.trim() || DEFAULT_CUSTOM_CONDITION_ICON;
			return { id, name, description, img };
		});

		saving = true;

		try {
			await setCustomConditions(cleaned);
			await applyPendingCleanups(new Set(cleaned.map((row) => row.id)));
			ui.notifications?.info(t('saved'));
			dialog().close();
		} catch (error) {
			console.error('Nimble | Failed to save the custom conditions:', error);
			ui.notifications?.error(t('saveFailed'));
		} finally {
			saving = false;
		}
	}

	/** Runs the opted-in cleanups, skipping any id the GM re-added under a new row before saving. */
	async function applyPendingCleanups(savedIds: Set<string>) {
		for (const [conditionId, usage] of pendingCleanups) {
			if (savedIds.has(conditionId)) continue;

			const documentCount = usage.actors.length + usage.items.length;

			try {
				await removeConditionReferences(usage, conditionId);
				ui.notifications?.info(
					t('removeDialog.cleanedUp', { name: conditionId, count: String(documentCount) }),
				);
			} catch (error) {
				console.error(`Nimble | Failed to clean up the ${conditionId} references:`, error);
				ui.notifications?.error(t('removeDialog.cleanupFailed', { name: conditionId }));
			}
		}

		pendingCleanups.clear();
	}

	return {
		t,
		defaultIcon: DEFAULT_CUSTOM_CONDITION_ICON,
		get rows() {
			return rows;
		},
		get rowErrors() {
			return rowErrors;
		},
		get hasErrors() {
			return hasErrors;
		},
		get saving() {
			return saving;
		},
		addRow,
		removeRow,
		onNameInput,
		onIdInput,
		normalizeId,
		pickIcon,
		save,
	};
}
