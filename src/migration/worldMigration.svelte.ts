import { SYSTEM_ID } from '#system';
import localize from '../utils/localize.js';
import {
	type CopyGroup,
	type CopyRow,
	type CopySort,
	copyGroups,
	toggleCopies,
} from './copyList.js';
import { MigrationList } from './MigrationList.js';
import { MigrationRunner, type RunProgress } from './MigrationRunner.js';
import { MigrationRunnerBase } from './MigrationRunnerBase.js';
import { buildReport, type MigrationReport } from './migrationReport.js';
import type { MigrationPlan } from './planMigration.js';

const REPORTS_SETTING = 'migrationReports';
const RUN_SETTING = 'migrationRun';

/** A run the GM started: saved first, so a run that stops continues with the same choices. */
interface SavedRun {
	toSchema: number;
	excluded: string[];
	startedAt: string;
}

type Phase = 'review' | 'running' | 'report';

type RowState = 'done' | 'now' | 'waiting' | 'off';

function setting<T>(key: string): T {
	return game.settings.get(SYSTEM_ID as 'core', key as 'rollMode') as unknown as T;
}

async function setSetting(key: string, value: unknown): Promise<void> {
	await game.settings.set(SYSTEM_ID as 'core', key as 'rollMode', value as never);
}

function worldSchemaVersion(): number {
	return Number(setting<number>('worldSchemaVersion')) || 0;
}

function readReports(): MigrationReport[] {
	const reports = setting<MigrationReport[] | null>(REPORTS_SETTING);
	return Array.isArray(reports) ? reports : [];
}

function readRun(): SavedRun | null {
	const run = setting<Partial<SavedRun> | null>(RUN_SETTING);
	if (!run || run.toSchema !== MigrationRunnerBase.LATEST_SCHEMA_VERSION) return null;
	return {
		toSchema: run.toSchema,
		excluded: Array.isArray(run.excluded) ? run.excluded : [],
		startedAt: String(run.startedAt ?? ''),
	};
}

function registerMigrationSettings(): void {
	game.settings.register(
		SYSTEM_ID as 'core',
		REPORTS_SETTING as 'rollMode',
		{
			scope: 'world',
			config: false,
			type: Array,
			default: [],
		} as unknown as Parameters<typeof game.settings.register>[2],
	);
	game.settings.register(
		SYSTEM_ID as 'core',
		RUN_SETTING as 'rollMode',
		{
			scope: 'world',
			config: false,
			type: Object,
			default: {},
		} as unknown as Parameters<typeof game.settings.register>[2],
	);
}

/** What the World Migration window shows and does. */
class WorldMigration {
	readonly runner: MigrationRunner | null;

	plan = $state.raw<MigrationPlan | null>(null);

	readonly fromSchema: number;

	readonly stoppedRun: SavedRun | null;

	phase = $state<Phase>('review');

	sort = $state<CopySort>('item');

	choose = $state(false);

	excluded = $state.raw<Set<string>>(new Set());

	progress = $state.raw<RunProgress | null>(null);

	reports = $state.raw<MigrationReport[]>(readReports());

	shownReport = $state(0);

	#writing = $state.raw<Set<string>>(new Set());

	#written = $state.raw<Set<string>>(new Set());

	readonly titles = new Map(
		MigrationList.constructAll().map((migration) => [
			migration.version,
			{ title: migration.title, kind: migration.kind },
		]),
	);

	readonly groups: CopyGroup[] = $derived(
		this.plan ? copyGroups(this.plan.copies, this.sort, this.titles) : [],
	);

	constructor(
		runner: MigrationRunner | null,
		plan: MigrationPlan | null,
		fromSchema: number,
		stoppedRun: SavedRun | null,
	) {
		this.runner = runner;
		this.plan = plan;
		this.fromSchema = fromSchema;
		this.stoppedRun = stoppedRun;
		if (stoppedRun) {
			this.excluded = new Set(stoppedRun.excluded);
			this.choose = stoppedRun.excluded.length > 0;
		}
		if (!runner) this.phase = 'report';
	}

	/** The GM's choices of a run that stopped stay as they were. */
	get locked(): boolean {
		return this.stoppedRun !== null || this.phase !== 'review';
	}

	get actorCount(): number {
		return new Set(
			(this.plan?.copies ?? [])
				.filter((copy) => copy.holder.kind === 'actor' || copy.holder.kind === 'token')
				.map(
					(copy) => copy.holder.actorUuid ?? `${copy.holder.sceneName}|${copy.holder.actorName}`,
				),
		).size;
	}

	get copyCount(): number {
		return this.plan?.copies.length ?? 0;
	}

	toggle(uuids: string[]): void {
		if (this.locked) return;
		this.excluded = toggleCopies(this.excluded, uuids);
	}

	rowState(row: CopyRow): RowState {
		if (row.excludable && row.uuids.every((uuid) => this.excluded.has(uuid))) return 'off';
		if (row.rootUuids.some((uuid) => this.#writing.has(uuid))) return 'now';
		if (row.rootUuids.every((uuid) => this.#written.has(uuid))) return 'done';
		return 'waiting';
	}

	groupState(group: CopyGroup): RowState {
		const states = group.rows.map((row) => this.rowState(row));
		if (states.includes('now')) return 'now';
		if (states.every((state) => state === 'done' || state === 'off')) return 'done';
		return 'waiting';
	}

	/** Plans again with the copies kept out, writes the plan, and saves the report. */
	async start(): Promise<MigrationReport | null> {
		if (!this.runner || this.phase !== 'review') return null;
		this.phase = 'running';
		const excluded = new Set(this.excluded);
		const startedAt = this.stoppedRun?.startedAt || new Date().toISOString();
		const toSchema = MigrationRunnerBase.LATEST_SCHEMA_VERSION;
		await setSetting(RUN_SETTING, { toSchema, excluded: [...excluded], startedAt });

		const plan = await this.runner.plan(excluded);
		const result = await this.runner.apply(plan, (progress) => {
			this.progress = progress;
			this.#writing = new Set(progress.writing);
			if (progress.written.length > 0) {
				this.#written = new Set([...this.#written, ...progress.written]);
			}
		});

		const report = buildReport({
			copies: this.plan?.copies ?? plan.copies,
			excluded,
			errors: result.errors,
			written: result.written,
			titles: this.titles,
			systemVersion: game.system.version,
			fromSchema: this.fromSchema,
			toSchema,
			date: new Date().toISOString(),
			...(this.stoppedRun ? { stoppedRun: this.stoppedRun.startedAt } : {}),
		});
		await setSetting(REPORTS_SETTING, [report, ...readReports()]);
		await setSetting(RUN_SETTING, {});
		this.reports = readReports();
		this.shownReport = 0;
		this.phase = 'report';
		return report;
	}
}

/** Plans the pending migrations, or none when the world is up to date. */
async function prepareWorldMigration(): Promise<WorldMigration> {
	const fromSchema = worldSchemaVersion();
	if (fromSchema >= MigrationRunnerBase.LATEST_SCHEMA_VERSION) {
		return new WorldMigration(null, null, fromSchema, null);
	}
	ui.notifications.info(
		localize('NIMBLE.migration.world.checking', { version: game.system.version }),
	);
	const runner = new MigrationRunner(MigrationList.constructFromVersion(fromSchema));
	const plan = await runner.plan();
	return new WorldMigration(runner, plan, fromSchema, readRun());
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

export {
	beginWorldMigration,
	prepareWorldMigration,
	registerMigrationSettings,
	WorldMigration,
	warnPlayerOfPendingMigration,
};
export type { Phase, RowState, SavedRun };
