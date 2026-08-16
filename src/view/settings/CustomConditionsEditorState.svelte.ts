import type GenericDialog from '#documents/dialogs/GenericDialog.svelte.js';
import localize from '#utils/localize.js';
import {
	DEFAULT_CUSTOM_CONDITION_ICON,
	getBuiltInConditionIds,
	getCustomConditions,
	isUnsafeConditionId,
	sanitizeConditionId,
	setCustomConditions,
} from '../../settings/customConditionSettings.js';
import type { ConditionEditorRow } from './CustomConditionsEditor.types.ts';

const t = (key: string, data?: Record<string, string>) =>
	localize(`NIMBLE.settings.customConditions.${key}`, data);

type ActorWithStatuses = { statuses?: Set<string> };

/** Every actor a condition could currently be sitting on, including unlinked token actors. */
function collectActors(): Set<ActorWithStatuses> {
	const actors = new Set<ActorWithStatuses>();

	for (const actor of (game.actors ?? []) as Iterable<ActorWithStatuses>) actors.add(actor);

	for (const scene of (game.scenes ?? []) as Iterable<{
		tokens?: Iterable<{ actor?: ActorWithStatuses | null }>;
	}>) {
		for (const token of scene.tokens ?? []) {
			if (token.actor) actors.add(token.actor);
		}
	}

	return actors;
}

function countActorsWithCondition(conditionId: string): number {
	let count = 0;
	for (const actor of collectActors()) {
		if (actor.statuses?.has(conditionId)) count += 1;
	}
	return count;
}

/** Creates reactive state for the CustomConditionsEditor component. */
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
			if (isUnsafeConditionId(id)) return t('errorInvalidId');
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
		// Deleting a condition orphans every effect still carrying its status: the sheet's
		// Conditions tab and the token HUD's Clear All both skip statuses they cannot resolve,
		// so the GM would have to hunt them down in the effects lists.
		if (row.persisted) {
			const inUse = countActorsWithCondition(row.id);
			if (inUse > 0) {
				const confirmed = await foundry.applications.api.DialogV2.confirm({
					window: { title: t('removeInUseTitle') },
					content: `<p>${foundry.utils.escapeHTML(
						t('removeInUseWarning', { name: row.name, count: String(inUse) }),
					)}</p>`,
					yes: { label: t('removeInUseConfirm') },
					no: { label: t('removeInUseCancel') },
					rejectClose: false,
				});
				if (confirmed !== true) return;
			}
		}

		const index = rows.indexOf(row);
		if (index !== -1) rows.splice(index, 1);
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
		picker.browse().catch((error: unknown) => {
			console.error('Nimble | Failed to open the condition icon picker:', error);
			ui.notifications?.error(t('iconPickerFailed'));
		});
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
