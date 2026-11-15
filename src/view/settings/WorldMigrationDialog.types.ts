import type GenericDialog from '#documents/dialogs/GenericDialog.svelte.js';
import type { WorldMigration } from '../../migration/worldMigration.svelte.js';

export interface WorldMigrationDialogProps {
	dialog: GenericDialog;
	migration: WorldMigration;
}
