import type { ReportMigration } from '../../../migration/migrationReport.js';

export interface MigrationReportChangesProps {
	/** The migrations that changed something. An empty list shows nothing. */
	migrations: ReportMigration[];
}
