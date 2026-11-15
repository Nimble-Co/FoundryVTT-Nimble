import localize from '#utils/localize.js';
import { type MigrationReport, reportText } from '../../migration/migrationReport.js';
import type { WorldMigrationDialogProps } from './WorldMigrationDialog.types.ts';
import { reportWord, whereLabel, windowWord } from './worldMigration/worldMigrationWords.js';

export function createWorldMigrationDialogState(getProps: () => WorldMigrationDialogProps) {
	const migration = $derived(getProps().migration);
	const report: MigrationReport | undefined = $derived(migration.reports[migration.shownReport]);

	const leadText = $derived.by(() => {
		if (migration.phase === 'stopped') return localize('NIMBLE.migration.world.stopped');
		const version = game.system.version;
		if (migration.stoppedRun) return windowWord('continueLead', { version });
		return windowWord(migration.actorCount > 0 ? 'lead' : 'leadNoActors', {
			version,
			copies: migration.copyCount,
			actors: migration.actorCount,
		});
	});

	const startLabel = $derived(windowWord(migration.stoppedRun ? 'continue' : 'start'));

	function close(): void {
		void getProps().dialog.close();
	}

	function start(): void {
		void migration.start();
	}

	async function copyReport(): Promise<void> {
		if (!report) return;
		await game.clipboard.copyPlainText(reportText(report, reportWord, whereLabel));
		ui.notifications?.info(reportWord('copied'));
	}

	return {
		get report() {
			return report;
		},
		get leadText() {
			return leadText;
		},
		get startLabel() {
			return startLabel;
		},
		close,
		start,
		copyReport,
	};
}
