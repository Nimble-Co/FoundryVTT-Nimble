import localize from '../utils/localize.js';
import { MigrationList } from './MigrationList.js';
import { MigrationRunner } from './MigrationRunner.js';
import { MigrationRunnerBase } from './MigrationRunnerBase.js';
import { WorldMigration, worldSchemaVersion } from './worldMigration.svelte.js';

/** Plans the pending migrations, or none when the world is up to date. */
async function prepareWorldMigration(): Promise<WorldMigration> {
	const fromSchema = worldSchemaVersion();
	if (fromSchema >= MigrationRunnerBase.LATEST_SCHEMA_VERSION) {
		return new WorldMigration(null, null, fromSchema);
	}
	ui.notifications.info(
		localize('NIMBLE.migration.world.checking', { version: game.system.version }),
	);
	const runner = new MigrationRunner(MigrationList.constructFromVersion(fromSchema));
	const plan = await runner.plan();
	return new WorldMigration(runner, plan, fromSchema);
}

/**
 * On a GM's ready: a migration that changes no Compendium Copy runs at once. Otherwise it waits
 * for the GM in the World Migration window.
 */
async function beginWorldMigration(openWindow: (migration: WorldMigration) => void): Promise<void> {
	if (worldSchemaVersion() >= MigrationRunnerBase.LATEST_SCHEMA_VERSION) return;
	const migration = await prepareWorldMigration();
	if (migration.copyCount > 0 || migration.stoppedRun) {
		openWindow(migration);
		return;
	}
	ui.notifications.info(
		localize('NIMBLE.migration.world.starting', { version: game.system.version }),
	);
	const report = await migration.start();
	if (report && report.errors.length > 0) {
		ui.notifications.warn(
			localize('NIMBLE.migration.world.completedWithErrors', {
				count: String(report.errors.length),
			}),
		);
	} else {
		ui.notifications.info(localize('NIMBLE.migration.world.completed'));
	}
}

/** A player is told the world waits for the GM's migration. Nothing is blocked. */
function warnPlayerOfPendingMigration(): void {
	if (worldSchemaVersion() >= MigrationRunnerBase.LATEST_SCHEMA_VERSION) return;
	ui.notifications.info(
		localize('NIMBLE.migration.playerWaiting', { version: game.system.version }),
	);
}

export { beginWorldMigration, prepareWorldMigration, warnPlayerOfPendingMigration };
