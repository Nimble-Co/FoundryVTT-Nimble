import type { WorldMigration } from '../../../migration/worldMigration.svelte.js';
import type { MigrationCopyListState } from './MigrationCopyListState.svelte.ts';

export interface MigrationGroupViewProps {
	migration: WorldMigration;
	copyList: MigrationCopyListState;
}
