import type { LogEntry } from '../../../support/supportLog.js';

export interface SupportReportErrorsProps {
	entries: LogEntry[];
	/** Different entries that came after the log was full. */
	dropped: number;
}
