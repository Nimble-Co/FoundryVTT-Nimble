import type { MigrationReport } from '../../../migration/migrationReport.js';
import type { WorldMigration } from '../../../migration/worldMigration.svelte.js';

export interface MigrationReportViewProps {
	migration: WorldMigration;
	/** The report the window shows, or none when the world has no report. */
	report: MigrationReport | undefined;
}
