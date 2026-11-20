import type { MigrationReport } from '../migration/migrationReport.js';
import type { ChangedSetting, Words } from './changedSettings.js';
import type { LogEntry } from './supportLog.js';

const ISSUES_URL = 'https://github.com/Nimble-Co/FoundryVTT-Nimble/issues/new';

interface MigrationSummary {
	date: string;
	systemVersion: string;
	fromSchema: number;
	toSchema: number;
	documents: number;
	copies: number;
	keptOut: number;
	errors: number;
	shown: number;
}

/** What a user sends with a problem report. */
interface SupportReport {
	made: string;
	user: { name: string; isGM: boolean };
	foundry: string;
	systemVersion: string;
	schema: number;
	browser: string;
	world: { title: string; actors: number; items: number; scenes: number };
	modules: { id: string; version: string }[];
	settings: ChangedSetting[];
	errors: LogEntry[];
	/** Different errors that came after the log was full. */
	dropped: number;
	migration: MigrationSummary | null;
	/** The selected token's actor, when the user adds it. */
	actor: { name: string; type: string; json: string } | null;
}

function migrationSummary(report: MigrationReport | undefined): MigrationSummary | null {
	if (!report) return null;
	return {
		date: report.date,
		systemVersion: report.systemVersion,
		fromSchema: report.fromSchema,
		toSchema: report.toSchema,
		documents: report.documents,
		copies: report.copies,
		keptOut: report.keptOut.length,
		errors: report.errors.length,
		shown: (report.shown ?? []).reduce((sum, shown) => sum + shown.count, 0),
	};
}

/** Every time an error or warning came, not only the different ones. */
function errorTotal(entries: LogEntry[]): number {
	return entries.reduce((sum, entry) => sum + entry.count, 0);
}

/** "Popup", "Nimble", or "Uncaught - monks-tokenbar". */
function sourceText(entry: LogEntry, words: Words): string {
	if (entry.source === 'uncaught' && entry.packageId) {
		return words('uncaughtFrom', { package: entry.packageId });
	}
	return words(`source.${entry.source}`);
}

/** "Error x2 (Popup)". */
function entryHeading(entry: LogEntry, words: Words): string {
	return words('entry', {
		level: words(`level.${entry.level}`),
		count: String(entry.count),
		source: sourceText(entry, words),
	});
}

function settingLine(setting: ChangedSetting): string {
	const name = setting.label === setting.key ? setting.key : `${setting.label} (${setting.key})`;
	return `[${setting.scope}] ${name} = ${setting.value}`;
}

function errorLines(report: SupportReport, words: Words): string[] {
	const lines = report.errors.flatMap((entry) => [
		`${entryHeading(entry, words)}: ${entry.message}`,
		...entry.stack.map((line) => `    at ${line}`),
	]);
	if (report.dropped > 0) lines.push(words('dropped', { count: String(report.dropped) }));
	return lines;
}

function migrationLine(summary: MigrationSummary, words: Words): string {
	return words('migrationLine', {
		date: summary.date,
		version: summary.systemVersion,
		from: String(summary.fromSchema),
		to: String(summary.toSchema),
		documents: String(summary.documents),
		copies: String(summary.copies),
		keptOut: String(summary.keptOut),
		errors: String(summary.errors),
		shown: String(summary.shown),
	});
}

/** The report as the text that Save Report and Copy give. */
function supportReportText(report: SupportReport, words: Words): string {
	const section = (heading: string, lines: string[]) => [
		`== ${heading} ==`,
		...(lines.length > 0 ? lines : [words('none')]),
	];
	const total = errorTotal(report.errors);
	const blocks = [
		[
			words('title'),
			words('made', {
				date: report.made,
				name: report.user.name,
				role: words(report.user.isGM ? 'gm' : 'player'),
			}),
		],
		section(words('section.versions'), [
			`${words('foundry')}: ${report.foundry}`,
			`${words('nimble')}: ${words('schema', { version: report.systemVersion, schema: String(report.schema) })}`,
			`${words('browser')}: ${report.browser}`,
			`${words('world')}: ${words('worldValue', {
				title: report.world.title,
				actors: String(report.world.actors),
				items: String(report.world.items),
				scenes: String(report.world.scenes),
			})}`,
		]),
		section(
			words('section.modules', { count: String(report.modules.length) }),
			report.modules.map((module) => `${module.id} ${module.version}`),
		),
		section(
			words('section.settings', { count: String(report.settings.length) }),
			report.settings.map(settingLine),
		),
		section(
			words('section.errors', { different: String(report.errors.length), total: String(total) }),
			errorLines(report, words),
		),
		section(
			words('section.migration'),
			report.migration ? [migrationLine(report.migration, words)] : [],
		),
	];
	if (report.actor) {
		blocks.push([
			`== ${words('section.actor', { name: report.actor.name, type: report.actor.type })} ==`,
			report.actor.json,
		]);
	}
	return blocks.map((block) => block.join('\n')).join('\n\n');
}

/** The bug form, with the versions filled in. */
function githubIssueUrl(foundry: string, systemVersion: string): string {
	const query = new URLSearchParams({
		template: 'bug.yml',
		'foundry-version': foundry,
		'nimble-version': systemVersion,
	});
	return `${ISSUES_URL}?${query}`;
}

export { errorTotal, githubIssueUrl, migrationSummary, sourceText, supportReportText };
export type { MigrationSummary, SupportReport };
