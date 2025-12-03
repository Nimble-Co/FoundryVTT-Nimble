import type { MigrationBase } from './MigrationBase.js';
import { MigrationRunner } from './MigrationRunner.js';
import * as Migrations from './migrations/index.js';

type MigrationConstructor = { new (): MigrationBase; version: number };

const migrationList: MigrationConstructor[] = Object.values(Migrations);

function getLatestVersion(): number {
	return Math.max(...migrationList.map((m) => m.version));
}

function constructAll(): MigrationBase[] {
	return migrationList.map((M) => new M());
}

function constructFromVersion(version?: number): MigrationBase[] {
	const minVersion = Number(version) || MigrationRunner.RECOMMENDED_SAFE_VERSION;

	return migrationList.reduce((acc, M) => {
		if (M.version > minVersion) acc.push(new M());
		return acc;
	}, [] as MigrationBase[]);
}

function constructRange(min: number, max = Number.POSITIVE_INFINITY): MigrationBase[] {
	return migrationList.reduce((acc, M) => {
		if (M.version >= min && M.version <= max) acc.push(new M());
		return acc;
	}, [] as MigrationBase[]);
}

export const MigrationList = {
	get latestVersion() {
		return getLatestVersion();
	},
	constructAll,
	constructFromVersion,
	constructRange,
};
