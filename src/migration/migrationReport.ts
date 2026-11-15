import type { TitleIndex } from './copyList.js';
import type { Holder, PlanError, PlannedCopy } from './planMigration.js';

interface KeptOutCopy {
	name: string;
	holder: Holder;
	/** The content changes the copy skipped. */
	titles: string[];
}

interface ReportError {
	name: string;
	uuid: string;
	/** The migration that threw. A failed write has none. */
	title: string | null;
	message: string;
}

/** The record of one run of the migrations. */
interface MigrationReport {
	systemVersion: string;
	fromSchema: number;
	toSchema: number;
	date: string;
	/** Documents written. */
	documents: number;
	/** Compendium Copies that took every change. */
	copies: number;
	keptOut: KeptOutCopy[];
	errors: ReportError[];
	/** When a run stopped before it finished, and this run finished it. */
	stoppedRun?: string;
}

interface ReportInput {
	copies: PlannedCopy[];
	excluded: ReadonlySet<string>;
	errors: PlanError[];
	written: number;
	titles: TitleIndex;
	systemVersion: string;
	fromSchema: number;
	toSchema: number;
	date: string;
	stoppedRun?: string;
}

type Words = (key: string, data?: Record<string, string>) => string;

function buildReport(input: ReportInput): MigrationReport {
	const keptOut = input.copies
		.filter((copy) => copy.excludable && input.excluded.has(copy.uuid))
		.map((copy) => ({
			name: copy.name,
			holder: copy.holder,
			titles: copy.versions
				.filter((version) => input.titles.get(version)?.kind === 'content')
				.map((version) => input.titles.get(version)!.title),
		}));
	return {
		systemVersion: input.systemVersion,
		fromSchema: input.fromSchema,
		toSchema: input.toSchema,
		date: input.date,
		documents: input.written,
		copies: input.copies.length - keptOut.length,
		keptOut,
		errors: input.errors.map((error) => ({
			name: error.name,
			uuid: error.uuid,
			title: error.version === null ? null : (input.titles.get(error.version)?.title ?? null),
			message: error.message,
		})),
		...(input.stoppedRun ? { stoppedRun: input.stoppedRun } : {}),
	};
}

/** The report as plain text, for Copy Report. */
function reportText(
	report: MigrationReport,
	words: Words,
	where: (holder: Holder) => string,
): string {
	const lines = [
		words('heading', { version: report.systemVersion }),
		`${words('version')}: ${report.systemVersion} (${report.fromSchema}-${report.toSchema})`,
		`${words('date')}: ${report.date}`,
		`${words('changed')}: ${words('documents', { count: String(report.documents) })}, ${words('copies', { count: String(report.copies) })}`,
		`${words('keptOut')}: ${report.keptOut.length}`,
		`${words('errors')}: ${report.errors.length}`,
	];
	if (report.stoppedRun) lines.push(words('stoppedRun', { date: report.stoppedRun }));
	if (report.keptOut.length > 0) {
		lines.push('', words('keptOutHeading'));
		for (const copy of report.keptOut) {
			lines.push(`- ${copy.name} ${where(copy.holder)}: ${copy.titles.join(', ')}`);
		}
		lines.push(words('structureStillRan'));
	}
	if (report.errors.length > 0) {
		lines.push('', words('errorsHeading'));
		for (const error of report.errors) {
			lines.push(`- ${error.name}${error.title ? ` (${error.title})` : ''}: ${error.message}`);
		}
	}
	return lines.join('\n');
}

export { buildReport, reportText };
export type { KeptOutCopy, MigrationReport, ReportError, Words };
