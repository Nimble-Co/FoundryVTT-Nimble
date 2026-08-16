import type GenericDialog from '#documents/dialogs/GenericDialog.svelte.js';

export interface CustomConditionsEditorProps {
	dialog: GenericDialog;
}

/** A single editable row in the custom conditions editor. */
export interface ConditionEditorRow {
	/** Identity for the `{#each}` key, so removing a row does not shift DOM onto its neighbour. */
	uid: string;
	id: string;
	name: string;
	description: string;
	img: string;
	/** Once the GM edits the id by hand we stop deriving it from the name. */
	idEdited: boolean;
	/** Rows loaded from the setting: their id is locked, because effects and rules store it. */
	persisted: boolean;
}
