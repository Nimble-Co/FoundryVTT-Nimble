import type GenericDialog from '#documents/dialogs/GenericDialog.svelte.js';
import localize from '#utils/localize.js';
import {
	DEFAULT_CUSTOM_SCHOOL_ICON,
	getBuiltInSpellSchoolKeys,
	getCustomSpellSchools,
	sanitizeSpellSchoolKey,
	setCustomSpellSchools,
} from '../../settings/spellSchoolSettings.js';
import type { SpellSchoolEditorRow } from './CustomSpellSchoolsEditor.types.ts';

const t = (key: string) => localize(`NIMBLE.settings.customSpellSchools.${key}`);

/** Creates reactive state for the CustomSpellSchoolsEditor component. */
export function createCustomSpellSchoolsEditorState(dialog: () => GenericDialog) {
	const builtInKeys = getBuiltInSpellSchoolKeys();

	const rows = $state<SpellSchoolEditorRow[]>(
		getCustomSpellSchools().map(({ key, label, icon }) => ({ key, label, icon, keyEdited: true })),
	);

	const rowErrors = $derived.by(() => {
		const seen = new Set<string>();
		return rows.map((row) => {
			const key = sanitizeSpellSchoolKey(row.key);
			if (!key) return t('errorEmptyKey');
			if (builtInKeys.includes(key)) return t('errorReservedKey');
			if (seen.has(key)) return t('errorDuplicateKey');

			seen.add(key);
			return '';
		});
	});

	const hasErrors = $derived(rowErrors.some((error) => error !== ''));

	function addRow() {
		rows.push({ key: '', label: '', icon: DEFAULT_CUSTOM_SCHOOL_ICON, keyEdited: false });
	}

	function removeRow(index: number) {
		rows.splice(index, 1);
	}

	function onLabelInput(row: SpellSchoolEditorRow, value: string) {
		row.label = value;
		// Auto-fill the key from the label until the GM customizes it themselves.
		if (!row.keyEdited) row.key = sanitizeSpellSchoolKey(value);
	}

	function onKeyInput(row: SpellSchoolEditorRow, value: string) {
		row.keyEdited = true;
		row.key = value;
	}

	function normalizeKey(row: SpellSchoolEditorRow) {
		row.key = sanitizeSpellSchoolKey(row.key);
	}

	function pickIcon(row: SpellSchoolEditorRow) {
		const picker = new FilePicker({
			type: 'image',
			current: row.icon,
			callback: (path: string) => {
				row.icon = path;
			},
		});
		picker.browse();
	}

	async function save() {
		if (hasErrors) return;

		const cleaned = rows
			.map((row) => {
				const key = sanitizeSpellSchoolKey(row.key);
				const label = row.label.trim() || key.charAt(0).toUpperCase() + key.slice(1);
				const icon = row.icon.trim() || DEFAULT_CUSTOM_SCHOOL_ICON;
				return { key, label, icon };
			})
			.filter((row) => row.key);

		await setCustomSpellSchools(cleaned);
		ui.notifications?.info(t('saved'));
		dialog().close();
	}

	return {
		t,
		defaultIcon: DEFAULT_CUSTOM_SCHOOL_ICON,
		get rows() {
			return rows;
		},
		get rowErrors() {
			return rowErrors;
		},
		get hasErrors() {
			return hasErrors;
		},
		addRow,
		removeRow,
		onLabelInput,
		onKeyInput,
		normalizeKey,
		pickIcon,
		save,
	};
}
