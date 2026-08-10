import type GenericDialog from '#documents/dialogs/GenericDialog.svelte.js';
import localize from '#utils/localize.js';
import {
	DEFAULT_CUSTOM_CONDITION_ICON,
	getBuiltInConditionIds,
	getCustomConditions,
	sanitizeConditionId,
	setCustomConditions,
} from '../../settings/customConditionSettings.js';
import type { ConditionEditorRow } from './CustomConditionsEditor.types.ts';

const t = (key: string) => localize(`NIMBLE.settings.customConditions.${key}`);

/** Creates reactive state for the CustomConditionsEditor component. */
export function createCustomConditionsEditorState(dialog: () => GenericDialog) {
	const builtInIds = getBuiltInConditionIds();

	const rows = $state<ConditionEditorRow[]>(
		getCustomConditions().map(({ id, name, description, img }) => ({
			id,
			name,
			description,
			img,
			idEdited: true,
		})),
	);

	const rowErrors = $derived.by(() => {
		const seen = new Set<string>();
		return rows.map((row) => {
			const id = sanitizeConditionId(row.id);
			if (!id) return t('errorEmptyId');
			if (builtInIds.includes(id)) return t('errorReservedId');
			if (seen.has(id)) return t('errorDuplicateId');

			seen.add(id);
			return '';
		});
	});

	const hasErrors = $derived(rowErrors.some((error) => error !== ''));

	let saving = $state(false);

	function addRow() {
		rows.push({
			id: '',
			name: '',
			description: '',
			img: DEFAULT_CUSTOM_CONDITION_ICON,
			idEdited: false,
		});
	}

	function removeRow(index: number) {
		rows.splice(index, 1);
	}

	function onNameInput(row: ConditionEditorRow, value: string) {
		row.name = value;
		// Auto-fill the id from the name until the GM customizes it themselves.
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
		picker.browse();
	}

	async function save() {
		if (hasErrors || saving) return;

		const cleaned = rows
			.map((row) => {
				const id = sanitizeConditionId(row.id);
				const name = row.name.trim() || id.charAt(0).toUpperCase() + id.slice(1);
				const description = row.description.trim();
				const img = row.img.trim() || DEFAULT_CUSTOM_CONDITION_ICON;
				return { id, name, description, img };
			})
			.filter((row) => row.id);

		saving = true;

		try {
			await setCustomConditions(cleaned);
			ui.notifications?.info(t('saved'));
			dialog().close();
		} catch (error) {
			console.error('Nimble | Failed to save the custom conditions:', error);
			ui.notifications?.error(t('saveFailed'));
		} finally {
			saving = false;
		}
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
