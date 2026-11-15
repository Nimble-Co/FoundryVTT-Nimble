import type { TitleIndex } from './copyList.js';
import type { MigrationKind } from './MigrationBase.js';
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

/** The copies of one compendium item that a migration changed. */
interface ReportCopyGroup {
	name: string;
	holders: Holder[];
}

/** What one migration changed in the run. */
interface ReportMigration {
	version: number;
	title: string;
	kind: MigrationKind;
	/** Documents written that this migration changed. */
	documents: number;
	/** Compendium Copies this migration changed, by name. */
	copies: ReportCopyGroup[];
}

/** A popup shown while the migration wrote, such as an error from a document's update hook. */
interface ShownMessage {
	level: 'error' | 'warning';
	message: string;
	count: number;
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
	/** Missing in reports saved before this field. */
	migrations?: ReportMigration[];
	/** Missing in reports saved before this field. */
	shown?: ShownMessage[];
	/** When a run stopped before it finished, and this run finished it. */
	stoppedRun?: string;
}

interface ReportInput {
	/** The copies the GM reviewed. */
	copies: PlannedCopy[];
	excluded: ReadonlySet<string>;
	/** The copies as the run changed them, with the kept-out content changes left out. */
	applied: PlannedCopy[];
	/** Documents written per migration version. */
	documents: ReadonlyMap<number, number>;
	shown: ShownMessage[];
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

function migrationsOf(input: ReportInput): ReportMigration[] {
	return [...input.titles]
		.sort(([a], [b]) => a - b)
		.map(([version, { title, kind }]) => {
			const groups = new Map<string, Holder[]>();
			for (const copy of input.applied) {
				if (!copy.versions.includes(version)) continue;
				groups.set(copy.name, [...(groups.get(copy.name) ?? []), copy.holder]);
			}
			return {
				version,
				title,
				kind,
				documents: input.documents.get(version) ?? 0,
				copies: [...groups]
					.map(([name, holders]) => ({ name, holders }))
					.sort((a, b) => a.name.localeCompare(b.name)),
			};
		})
		.filter((migration) => migration.documents > 0 || migration.copies.length > 0);
}

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
		migrations: migrationsOf(input),
		shown: input.shown,
		...(input.stoppedRun ? { stoppedRun: input.stoppedRun } : {}),
	};
}

/** The places of a copy group, with a count on a place that repeats: "on a Cobra token (3)". */
function placesText(holders: Holder[], words: Words, where: (holder: Holder) => string): string {
	const counts = new Map<string, number>();
	for (const holder of holders) counts.set(where(holder), (counts.get(where(holder)) ?? 0) + 1);
	return [...counts]
		.map(([place, count]) =>
			count > 1 ? words('repeated', { where: place, count: String(count) }) : place,
		)
		.join(', ');
}

/** "1 document" or "3 documents": the key with `One` added names the form for one. */
function countText(words: Words, key: 'documents' | 'copies', count: number): string {
	return words(count === 1 ? `${key}One` : key, { count: String(count) });
}

/** "Error, 2 times: Invalid roll formula". */
function shownText(shown: ShownMessage, words: Words): string {
	const level = words(shown.level === 'error' ? 'levelError' : 'levelWarning');
	const times = shown.count > 1 ? `, ${words('times', { count: String(shown.count) })}` : '';
	return `${level}${times}: ${shown.message}`;
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
		`${words('changed')}: ${countText(words, 'documents', report.documents)}, ${countText(words, 'copies', report.copies)}`,
		`${words('keptOut')}: ${report.keptOut.length}`,
		`${words('errors')}: ${report.errors.length}`,
	];
	if (report.stoppedRun) lines.push(words('stoppedRun', { date: report.stoppedRun }));
	if ((report.migrations ?? []).length > 0) lines.push('');
	for (const migration of report.migrations ?? []) {
		const copyCount = migration.copies.reduce((sum, group) => sum + group.holders.length, 0);
		const counts = [
			...(copyCount > 0 ? [countText(words, 'copies', copyCount)] : []),
			countText(words, 'documents', migration.documents),
		];
		lines.push(`${migration.title}: ${counts.join(', ')}`);
		for (const group of migration.copies) {
			lines.push(`- ${group.name}: ${placesText(group.holders, words, where)}`);
		}
	}
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
	if ((report.shown ?? []).length > 0) {
		lines.push('', words('shownHeading'));
		for (const shown of report.shown ?? []) lines.push(`- ${shownText(shown, words)}`);
	}
	return lines.join('\n');
}

export { buildReport, countText, placesText, reportText, shownText };
export type {
	KeptOutCopy,
	MigrationReport,
	ReportCopyGroup,
	ReportError,
	ReportMigration,
	ShownMessage,
	Words,
};
