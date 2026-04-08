import type { NimbleCharacter } from '#documents/actor/character.js';
import type GenericDialog from '#documents/dialogs/GenericDialog.svelte.js';

export interface CharacterLevelDownDialogProps {
	document: NimbleCharacter;
	dialog: GenericDialog;
}
