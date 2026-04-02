import type { NimbleCharacter } from '../../src/documents/actor/character.js';
import type GenericDialog from '../../src/documents/dialogs/GenericDialog.svelte.js';

interface PdfExportDialogProps {
	actor: NimbleCharacter;
	dialog: GenericDialog;
}

export type { PdfExportDialogProps };
