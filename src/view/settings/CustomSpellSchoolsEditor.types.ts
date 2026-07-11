import type GenericDialog from '#documents/dialogs/GenericDialog.svelte.js';

export interface CustomSpellSchoolsEditorProps {
	dialog: GenericDialog;
}

/** A single editable row in the custom spell schools editor. */
export interface SpellSchoolEditorRow {
	key: string;
	label: string;
	icon: string;
	/** Once the GM edits the key by hand we stop deriving it from the label. */
	keyEdited: boolean;
}
