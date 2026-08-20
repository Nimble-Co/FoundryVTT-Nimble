import type GenericDialog from '#documents/dialogs/GenericDialog.svelte.js';

export interface CustomConditionsEditorProps {
	dialog: GenericDialog;
}

export interface ConditionEditorRow {
	/** Keys the `{#each}` block, so removing a row does not shift its DOM onto the next one. */
	uid: string;
	id: string;
	name: string;
	description: string;
	img: string;
	/** Once the GM types an id by hand, it stops being derived from the name. */
	idEdited: boolean;
	/** True for rows loaded from the setting, whose id is locked because effects store it. */
	persisted: boolean;
}
