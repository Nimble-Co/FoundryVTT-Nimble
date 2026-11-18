import type { ShownMessage } from '../../../migration/migrationReport.js';

export interface MigrationReportShownProps {
	/** The popups shown during the run. An empty list shows nothing. */
	shown: ShownMessage[];
}
