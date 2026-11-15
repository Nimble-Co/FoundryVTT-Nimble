import {
	collectSupportReport,
	selectedActor,
	supportWord,
} from '../../support/collectSupportReport.js';
import { supportLog } from '../../support/installSupportLog.js';
import type { LogEntry } from '../../support/supportLog.js';
import {
	githubIssueUrl,
	type SupportReport,
	supportReportText,
} from '../../support/supportReport.js';
import { supportWindowWord } from './supportReport/supportReportWords.js';
import { formatShortDate } from './worldMigration/worldMigrationWords.js';

const DISCORD_URL = 'https://discord.gg/SxVmHpu34R';

interface AlsoRow {
	icon: string;
	text: string;
}

function alsoRows(report: SupportReport): AlsoRow[] {
	const modules = report.modules.length;
	const settings = report.settings.length;
	return [
		{
			icon: 'fa-solid fa-circle-info',
			text: supportWindowWord('alsoVersions', {
				foundry: report.foundry,
				nimble: report.nimble,
				schema: report.schema,
				browser: report.browser,
			}),
		},
		{
			icon: 'fa-solid fa-puzzle-piece',
			text: supportWindowWord(modules === 1 ? 'alsoModulesOne' : 'alsoModules', {
				count: modules,
			}),
		},
		{
			icon: 'fa-solid fa-sliders',
			text: supportWindowWord(settings === 1 ? 'alsoSettingsOne' : 'alsoSettings', {
				count: settings,
			}),
		},
		{
			icon: 'fa-solid fa-boxes-packing',
			text: report.migration
				? supportWindowWord('alsoMigration', {
						date: formatShortDate(report.migration.date),
						errors: report.migration.errors,
					})
				: supportWindowWord('alsoNoMigration'),
		},
	];
}

/** "2026-11-15-1152", local time. */
function fileStamp(date: Date): string {
	const pad = (value: number) => String(value).padStart(2, '0');
	return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}`;
}

export function createSupportReportDialogState() {
	// The log as it was when the window opened; its entries keep counting after this.
	const entries: LogEntry[] = supportLog.entries.map((entry) => ({ ...entry }));
	const dropped = supportLog.dropped;
	const githubUrl = githubIssueUrl(
		game.release?.version ?? String(game.version),
		game.system.version,
	);

	let report = $state.raw<SupportReport | null>(null);
	let withActor = $state(false);
	let actorName = $state<string | null>(selectedActor()?.name ?? null);
	let request = 0;

	const text = $derived(report ? supportReportText(report, supportWord) : '');
	const also = $derived(report ? alsoRows(report) : []);

	/** Collects again; a later collect wins over an earlier one that ends after it. */
	async function collect(): Promise<void> {
		const ticket = ++request;
		const next = await collectSupportReport({ withActor: withActor && actorName !== null });
		if (ticket === request) report = next;
	}

	function onControlToken(): void {
		actorName = selectedActor()?.name ?? null;
		if (withActor) void collect();
	}

	$effect(() => {
		const hookId = Hooks.on('controlToken', onControlToken);
		return () => Hooks.off('controlToken', hookId);
	});

	void collect();

	function setWithActor(value: boolean): void {
		withActor = value;
		void collect();
	}

	function save(): void {
		if (!report) return;
		const filename = `nimble-report-${fileStamp(new Date())}.txt`;
		foundry.utils.saveDataToFile(text, 'text/plain', filename);
	}

	async function copy(): Promise<void> {
		if (!report) return;
		await game.clipboard.copyPlainText(text);
		ui.notifications.info(supportWindowWord('copied'));
	}

	return {
		entries,
		dropped,
		githubUrl,
		discordUrl: DISCORD_URL,
		get ready() {
			return report !== null;
		},
		get text() {
			return text;
		},
		get also() {
			return also;
		},
		get actorName() {
			return actorName;
		},
		get actorChecked() {
			return withActor && actorName !== null;
		},
		setWithActor,
		save,
		copy,
	};
}
