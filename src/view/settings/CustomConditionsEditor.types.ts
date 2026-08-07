import type GenericDialog from '#documents/dialogs/GenericDialog.svelte.js';

export interface CustomConditionsEditorProps {
	dialog: GenericDialog;
}

/** A single editable row in the custom conditions editor. */
export interface ConditionEditorRow {
	id: string;
	name: string;
	description: string;
	img: string;
	/** Once the GM edits the id by hand we stop deriving it from the name. */
	idEdited: boolean;
}
