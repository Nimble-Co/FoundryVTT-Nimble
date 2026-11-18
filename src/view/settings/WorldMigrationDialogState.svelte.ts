import localize from '#utils/localize.js';
import { type MigrationReport, reportText } from '../../migration/migrationReport.js';
import type { WorldMigration } from '../../migration/worldMigration.svelte.js';
import type { WorldMigrationDialogProps } from './WorldMigrationDialog.types.ts';
import {
	type PhrasePart,
	reportWord,
	whereLabel,
	windowPhrase,
	windowWord,
} from './worldMigration/worldMigrationWords.js';

/** ", in the sidebar and in 1 world compendium", or nothing when every copy is on an actor. */
function placesPhrase(migration: WorldMigration): string {
	const copies = migration.plan?.copies ?? [];
	const inSidebar = copies.some((copy) => copy.holder.kind === 'sidebar');
	const packs = new Set(
		copies.filter((copy) => copy.holder.kind === 'compendium').map((copy) => copy.holder.packLabel),
	).size;
	if (packs === 0) return inSidebar ? windowWord('leadSidebar') : '';
	const key = inSidebar ? 'leadSidebarPacks' : 'leadPacks';
	return windowWord(packs === 1 ? `${key}One` : key, { count: packs });
}

function leadParts(migration: WorldMigration): PhrasePart[] {
	const plain = (text: string) => [{ text, strong: false }];
	const version = game.system.version;
	if (migration.phase === 'stopped') return plain(localize('NIMBLE.migration.world.stopped'));
	if (migration.stoppedRun) return plain(windowWord('continueLead', { version }));

	const { copyCount, actorCount } = migration;
	return windowPhrase(
		actorCount > 0 ? 'lead' : 'leadNoActors',
		{
			version,
			copies: windowWord(copyCount === 1 ? 'leadCopiesOne' : 'leadCopies', { count: copyCount }),
			actors: windowWord(actorCount === 1 ? 'leadActorsOne' : 'leadActors', {
				count: actorCount,
			}),
			places: placesPhrase(migration),
		},
		['copies', 'actors'],
	);
}

export function createWorldMigrationDialogState(getProps: () => WorldMigrationDialogProps) {
	const migration = $derived(getProps().migration);
	const report: MigrationReport | undefined = $derived(migration.reports[migration.shownReport]);
	const lead = $derived(leadParts(migration));
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
		get lead() {
			return lead;
		},
		get startLabel() {
			return startLabel;
		},
		close,
		start,
		copyReport,
	};
}
