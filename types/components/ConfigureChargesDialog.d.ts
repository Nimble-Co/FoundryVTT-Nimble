import type { NimbleCharacter } from '../../src/documents/actor/character.js';
import type GenericDialog from '../../src/documents/dialogs/GenericDialog.svelte.js';
import type { ChargeIndicatorPoolState } from './ChargeIndicator.d.ts';

export interface ConfigureChargesDialogProps {
	document: NimbleCharacter;
	dialog: GenericDialog;
	pools: ChargeIndicatorPoolState[];
}
